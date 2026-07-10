# ERDL Decision Object v1.0

> **规范草案** · 2026-07-10 · 版本 1.0.0-draft
> 维护方：OpenOBA (openoba.com)
> 许可证：MIT

---

## 1. 范围

本文档定义了 ERDL（Entity-Rule Definition Language）规则的**决策接口**——即规则评估的输入格式、输出格式和语义。

任何声称兼容 ERDL Decision Object v1.0 的实现必须：给定相同的规则集和上下文，产生**逐字节一致**的 `expected` 输出。

---

## 2. 输入

### 2.1 规则定义

每个规则包含以下字段：

| 字段 | 类型 | 必需 | 说明 |
|------|------|:---:|------|
| `id` | string | ✅ | 规则全局唯一标识 |
| `name` | string | ✅ | 人类可读名称 |
| `description` | string | — | 一行描述 |
| `category` | string | ✅ | 分类：`coding` / `engineering` / `writing` / `design` / `security` / `performance` / `testing` / `compliance` / `accessibility` / `custom` |
| `triggers` | string[] | — | 触发工具列表（用于条件匹配） |
| `when` | string | ✅ | ERDL when 表达式（条件） |
| `then` | string | ✅ | ERDL then 表达式（动作） |
| `priority` | number | ✅ | 优先级（1-1000，数字越小越优先） |
| `enabled` | boolean | ✅ | 规则是否启用 |
| `override` | boolean | — | 是否允许覆盖更高优先级的限制（仅 BLOCK→ALLOW 方向） |
| `ring` | number | — | 执行环级别（0-3，默认 3） |

### 2.2 上下文

上下文是一个扁平化的 JSON 对象，包含 Agent 当前工具调用的所有信息。标准字段：

| 字段 | 说明 |
|------|------|
| `tool.name` | 当前调用的工具名 |
| `tool.args` | 工具参数的完整对象 |
| `tool.args.<param>` | 工具参数的扁平化字段（如 `tool.args.command`） |
| `agent.id` | Agent 身份标识（可选） |
| `session.id` | 会话标识（可选） |

### 2.3 When 表达式（条件）

ERDL when 表达式支持以下运算符：

| 运算符 | 语法 | 示例 |
|--------|------|------|
| `=` | 等于 | `field = "value"` |
| `!=` | 不等于 | `field != "value"` |
| `>` | 大于 | `field > 3` |
| `<` | 小于 | `field < 500` |
| `>=` | 大于等于 | `field >= 10` |
| `<=` | 小于等于 | `field <= 3` |
| `in` | 在列表中 | `field in ("a","b")` |
| `contains` | 包含子串 | `field contains "rm"` |
| `match` | 正则匹配 | `field match "^/(etc\|var)"` |
| `exists` | 字段存在 | `field exists` |
| `AND` | 逻辑与 | `A AND B` |
| `OR` | 逻辑或 | `A OR B` |
| `NOT` | 逻辑非 | `NOT field exists` |
| `()` | 括号分组 | `(A OR B) AND C` |

---

## 3. 输出

### 3.1 评估结果

```json
{
  "decision": "DENY",
  "matchedRules": [
    { "ruleId": "SEC-001", "decision": "DENY", "reason": "exec blocked" }
  ],
  "totalEvaluated": 2,
  "totalMatched": 1
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `decision` | string | 最终决策（见 3.2） |
| `matchedRules` | array | 匹配的规则列表 |
| `matchedRules[].ruleId` | string | 规则 ID |
| `matchedRules[].decision` | string | 该规则的决策 |
| `matchedRules[].reason` | string | 拒绝/暂停原因（DENY/REQUEST_HUMAN/EMERGENCY_HALT 时） |
| `matchedRules[].instruction` | string | 建议说明（ALLOW 时） |
| `matchedRules[].correction` | string | 纠正说明（CORRECT 时） |
| `totalEvaluated` | number | 评估的规则总数（不含 disabled） |
| `totalMatched` | number | 匹配的规则总数 |

### 3.2 决策类型

| 决策 | 含义 | Agent 行为 |
|------|------|-----------|
| `ALLOW` | 放行，附建议 | 继续执行 |
| `DENY` | 硬拦截 | 停止执行，须修改 |
| `PASS` | 无规则匹配 | 继续执行 |
| `CORRECT` | 自动纠正 | 参数修正后放行 |
| `REQUEST_HUMAN` | 请求人工审批 | 暂停等待确认 |
| `EMERGENCY_HALT` | 紧急终止 | 全局停止 |

### 3.3 决策严重性排序

```
EMERGENCY_HALT (0)
  → DENY (1)
    → REQUEST_HUMAN (2)
      → CORRECT (3)
        → ALLOW (4)
          → PASS (5)
```

高严重性决策不能被低严重性决策覆盖。

---

## 4. 执行环

规则分为四个执行环：

| Ring | 用途 | 包含的决策类型 |
|:---:|------|--------------|
| **0** | 全局安全 | EMERGENCY_HALT, DENY |
| **1** | 组织合规 | ROLLBACK, QUARANTINE（Pro） |
| **2** | 运营管控 | ESCALATE, NOTIFY（Pro） |
| **3** | 个人规则 | ALLOW, CORRECT, REQUEST_HUMAN（Free） |

Ring 0 先评估，Ring 3 最后。Ring 0 HALT 可立即短路所有后续评估。

---

## 5. override 语义

`override: true` 允许规则在**安全方向**覆盖更高优先级的决策：

| 场景 | 允许 | 理由 |
|------|:---:|------|
| DENY → ALLOW | ✅ | 限制放松，安全 |
| DENY → DENY | ✅ | 同方向 |
| ALLOW → DENY | ❌ | 不安全，被拒绝 |
| REQUEST_HUMAN → ALLOW | ✅ | 安全方向 |
| EMERGENCY_HALT → 任何 | ❌ | Ring 0 HALT 不可覆盖 |

---

## 6. 跨实现验证

向量集位于：[decision-object-vectors-v1.0.json](./decision-object-vectors-v1.0.json)

任何 ERDL 兼容实现必须：
1. 加载向量集中定义的规则
2. 使用向量集中定义的上下文
3. 产生与 `expected` 字段逐字节一致的输出
4. 在向量集中提供的中立仓库提交验证结果（如 [#2038](https://github.com/a2aproject/A2A/issues/2038)）

---

> 确定性架构，而非 Prompt 工程。
> OpenOBA · 2026
