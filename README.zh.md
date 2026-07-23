<p align="center">
  <img src="https://raw.githubusercontent.com/openoba/erdl-spec/main/assets/erdl-logo.svg" alt="ERDL Logo" width="120" />
</p>

<h1 align="center">ERDL（Entity-Rule Definition Language）</h1>

<p align="center">
  <strong>AI Agent 的确定性行为规则层。不是 Prompt 工程。</strong>
</p>

<p align="center">
  <a href="https://github.com/OpenOBA/erdl-landing/releases"><img src="https://img.shields.io/badge/Version-1.1%20Final-blue?style=flat-square" alt="Version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/Status-Frozen%20%26%20Audited-success?style=flat-square" alt="Status"></a>
  <a href="#"><img src="https://img.shields.io/badge/Layer-L9%20Semantic-orange?style=flat-square" alt="Layer"></a>
</p>

<p align="center">
  <a href="#-快速开始">快速开始</a> •
  <a href="#-核心概念">核心概念</a> •
  <a href="#-v11-亮点">v1.1 亮点</a> •
  <a href="#-合规与审计">合规与审计</a> •
  <a href="#-生态">生态</a>
</p>

---

## 什么是 ERDL？

在 Agentic AI 时代，LLM 是概率性的，而企业级业务需要**确定性**。

**ERDL（Entity-Rule Definition Language）** 是一个开放的、声明式的 Agent 行为规则标准。它定义了 AI Agent 在执行工具调用时必须遵循的约束、策略和纠偏逻辑。

- 🚫 **不是 Prompt 工程**：Prompt 是"建议"，Agent 可能会幻觉或绕过。ERDL 是确定性执行门禁，Agent 无法绕过。
- 🚫 **不是 Agent 框架**：ERDL 不取代 LangGraph、CrewAI 或 AutoGen。它是这些框架缺失的**规则治理层**。
- ✅ **L9 语义规则层**：ERDL 填补了 MCP（L8，工具连接）和 A2A（L8，Agent 通信）之间的治理空白。

### 三层协议栈

```
┌──────────────────────────────────────────────────┐
│  A2A — Agent ↔ Agent 通信标准 (L8)                │  Google · Linux Foundation
├──────────────────────────────────────────────────┤
│  ERDL — Agent 行为规则描述语言 (L9)               │  OpenOBA · MIT License
│  (MCP Server + A2A Card Extension)                │  <--- 你在这里
├──────────────────────────────────────────────────┤
│  MCP — Agent ↔ Tool 连接标准 (L8)                 │  Anthropic · Linux Foundation
└──────────────────────────────────────────────────┘
```

---

## 快速开始

ERDL 规则使用 YAML 编写——人类和 LLM 都易读。

### 1. 编写第一条规则

```yaml
# rules/security.yaml
# 阻止非 DBA 人员删除生产数据库
- name: "SEC-001-protect-prod-db"
  description: "保护生产环境数据库不被误删"
  priority: 100
  category: security

  # unless 豁免（v1.1：优先评估，短路求值）
  unless:
    logic: AND
    conditions:
      - field: "caller.role"
        operator: eq
        value: "DBA_ADMIN"

  # 触发条件
  when:
    logic: AND
    conditions:
      - field: "tool.name"
        operator: eq
        value: "execute_sql"
      - field: "tool.args.query"
        operator: match
        value: "(?i)DROP\\s+TABLE"

  # 确定性动作
  then: DENY

  # 强制反馈（v1.1：指导 LLM 自我纠正）
  message: "DROP TABLE 已拦截。请使用 data_archive_tool 或联系 DBA 团队。"
```

### 2. 验证规则

```bash
# 安装 CLI
npm install -g @openoba/erdl-engine-js

# 运行质量门禁检查
npx erdl-engine check ./rules/
```

输出示例：
```
✔ SEC-001-protect-prod-db: Passed (Determinism, Completeness)
⚠ SEC-002-api-rate-limit: Warning [empty-message-on-blocking-rule]
  阻断类规则缺少 message 字段，LLM 将无法理解拒绝原因。
```

---

## 核心概念

| 概念 | 说明 |
|------|------|
| **13 种运算符** | `eq` `ne` `gt` `gte` `lt` `lte` `in` `not_in` `contains` `not_contains` `match` `exists` `within` |
| **17 种 Then 动作** | `ALLOW` `CORRECT` `NOTIFY` `DENY` `EMERGENCY_HALT` `ROLLBACK` `QUARANTINE` `REQUEST_HUMAN` `ESCALATE` `DELEGATE` `STRATEGIZE` `AUDIT` `CALCULATE` `VALIDATE` `WORKFLOW` `WORKFLOW_WAITING` `WORKFLOW_PROGRESS` |
| **4 级执行环** | Ring 0（安全）→ Ring 1（合规）→ Ring 2（运营）→ Ring 3（执行） |
| **44 条验证向量** | 37 决策引擎 + 7 审计哈希 = 跨实现逐字节一致 |
| **JCS + SHA-256 审计链** | RFC 8785 规范化序列化，防篡改、可追溯 |

📄 完整规范：[English](spec/erdl-spec-v1.1.en.md) | [中文版](spec/erdl-spec-v1.1.md)

---

## v1.1 核心亮点

v1.1 是基于真实企业级 Agent 生产环境痛点打磨的防御性版本：

| 特性 | 说明 | 解决的痛点 |
|------|------|-----------|
| **unless 短路豁免** | unless 评估优先于 when，支持安全的空值传播 | 解决"一刀切"拦截，支持白名单/黑名单等复杂业务逻辑 |
| **强制 message 纠偏** | 阻断类规则（DENY/CORRECT）必须携带结构化反馈 | 解决 Agent 被拦截后"不知道为什么"导致的死循环或幻觉 |
| **质量门禁** | 加载时自动拦截 `when: 'true'` + `DENY` 等危险规则 | 防止单条错误规则导致整个 Agent 系统停摆 |
| **JCS+SHA-256 审计链** | Decision Object 采用 RFC 8785 规范化序列化 | 确保跨语言、跨平台的审计日志具备比特级一致性 |
| **结构化命名规范** | 强制 `[CAT]-[NNN]-描述` 格式 | 将规则从"临时脚本"升级为企业级"可审计资产" |

> 完整变更参见 [CHANGELOG.md](CHANGELOG.md)

---

## 合规与审计

ERDL 不仅仅是技术工具，更是企业 AI 治理的合规基础设施。v1.1 的 Decision Object 和审计证据链设计，直接对齐以下国际/国内标准：

- 🇪🇺 **EU AI Act (Art. 15)**：满足高风险 AI 系统的透明度、可解释性与人工监督要求
- 🇺🇸 **NIST AI RMF 1.0**：提供 Measure/Map 阶段所需的量化风险管控凭证
- 🇨🇳 **GB/Z 185-2026**：对齐《人工智能 智能体互联》国家标准中的行为审计与安全条款
- 🏢 **信通院「可信 AI 2.0」**：覆盖"关键能力-决策"与"平台支撑"维度的评估要求

> 💡 对于 RegTech（监管科技）开发者：ERDL 的 Decision Object 是机器可读的法定证据格式。您可以直接解析 ERDL 审计日志，自动生成合规报告。

---

## 生态集成

ERDL 坚持框架无关原则。我们鼓励社区构建各种 Runner、IDE 插件和中间件：

- **LangChain / LangGraph**：作为 Tool Router 的 Middleware 注入
- **CrewAI / AutoGen**：作为 Agent 实例化时的 Guard 层
- **MCP（Model Context Protocol）**：ERDL 规则可自动编译为 MCP Server，供任何 MCP Client 调用
- **IDE 支持**：社区驱动的 VS Code 插件（YAML 补全、Lint 提示、Trace 可视化）

---

## 路线图（v1.2）

ERDL v1.1 已冻结。v1.2 将重点解决分布式与高级治理场景：

| 优先级 | 特性 | 说明 |
|:---:|------|------|
| 🔴 P0 | 分布式一致性 | 跨节点 EMERGENCY_HALT 全局生效与状态同步 |
| 🟡 P1 | Message 模板插值 | 支持 `{{context.amount}}` 等动态变量注入纠偏信息 |
| 🟡 P1 | 自定义质量门禁 | 允许企业通过插件扩展 `erdl-lint` 规则 |
| 🟡 P1 | DELEGATE 决策类型 | 正式支持多 Agent 间的权限委托审计 |

> 完整 v1.2 规划见 [附录 E](spec/erdl-spec-v1.1.md#附录-ev12-规划目标)

---

## 参与贡献

ERDL 是一个由社区驱动的中立标准。欢迎以下形式的贡献：

- **提交规则模式**：在 `examples/` 目录贡献特定行业（金融、医疗、制造）的最佳实践规则集
- **构建工具链**：开发针对特定语言（Rust、Go、Python）的 SafeExpr 解析器或 IDE 插件
- **完善测试向量集**：在 `spec/vectors/` 中补充边缘场景测试用例

---

## 许可证

ERDL 规范基于 [MIT License](LICENSE) 开源。

> 确定性架构，而非 Prompt 工程。
> OpenOBA · 2026
