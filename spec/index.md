# ERDL Protocol Specification v1.0

> **Entity-Rule Definition Language — Agent 行为规则层开放标准**
>
> 版本：1.0 (Community Preview) · 2026-07-10
> 维护者：OpenOBA
> 许可证：MIT
> 状态：Request for Comments
>
> **声明式规则描述语言，兼容 MCP 和 A2A 生态。**

---

## 1. 引言

### 1.1 背景：Agent 生态的标准化

AI Agent 生态正在快速标准化。两个协议定义了 Agent 互操作的基础：

- **MCP**（Model Context Protocol，Anthropic → Linux Foundation）：Agent 与外部工具的连接标准——"Agent 的 USB"
- **A2A**（Agent-to-Agent Protocol，Google → Linux Foundation）：Agent 之间的通信标准——"Agent 的 HTTP"

Cisco Research 在 2025 年提出分层 Agent 协议架构（arXiv:2511.19699），定义了 L8（Agent Communication Layer）和 L9（Agent Semantic Negotiation Layer）。L8 正在被 MCP 和 A2A 实现。L9 "does not exist today"（原文）。

**ERDL 填补了 L9 的空白——Agent 语义规则层。**

### 1.2 ERDL 是什么

ERDL（Entity-Rule Definition Language，实体-规则定义语言）是一个开放的、声明式的 Agent 行为规则标准。它定义了 AI Agent 在执行操作时应遵循的约束、策略和纠偏逻辑。

**ERDL 不是 Prompt 工程。** 它是确定性引擎。规则由 SafeExpr 表达式引擎执行——递归下降解析，零代码注入。Agent 无法绕过。

**ERDL 不是 Agent 框架。** 它不取代 LangGraph、CrewAI、OpenClaw。它集成到这些框架中，作为它们缺失的规则层。

**ERDL 通过标准路径融入现有 Agent 生态：**

- **ERDL → MCP Tool**：规则自动生成为 MCP Tool，Agent 通过标准 MCP 协议调用
- **ERDL → A2A Agent Card 扩展**：Agent Card 中声明 `erdl` 扩展，携带规则文件和 Guardian Agent 信息

三层协同工作：

```
┌──────────────────────────────────┐
│  A2A  — Agent ↔ Agent 通信标准   │  Google · LF · 150+ orgs
├──────────────────────────────────┤
│  ERDL — Agent 行为规则描述语言   │  OpenOBA · MIT
│         (MCP Server + A2A Card)  │
├──────────────────────────────────┤
│  MCP  — Agent ↔ Tool 连接标准    │  Anthropic · LF · 97M 下载/月
└──────────────────────────────────┘
```

### 1.3 设计原则

| 原则 | 说明 |
|------|------|
| **声明式** | 规则用 when/then YAML 表达，不需要写代码 |
| **确定性** | 规则由引擎执行，不依赖 LLM 自觉遵守 |
| **协议层拦截** | Action Guard 在 Tool Call 执行前拦截，不是 Prompt 建议 |
| **可审计** | 每条规则的触发、拦截、纠偏都有结构化记录 |
| **可热更新** | 规则变更无需重启 Agent 运行时 |
| **框架无关** | 不绑定任何 Agent 框架或 LLM 提供商 |
| **MCP/A2A 互补** | 通过 MCP Server 和 A2A Card 扩展两种标准路径融入生态 |
| **翻译 + 向导 + 纠偏** | 不只是一刀切拦截。纠正路径、建议策略、指导 Agent 回到正轨 |
| **多方语义层** | 人、LLM、Agent、系统、审计共享同一套语义约定 |
| **默认安全** | 无规则匹配时默认 ALLOW。但 Guard 规则默认加载 |

### 1.4 与 IEEE/ISO/NIST/GB 的关系

ERDL 旨在与以下框架对齐：

- **IEEE P3395** — Recommended Practice for Agentic AI Practices (制定中)
- **ISO/IEC 42001** — AI 管理系统
- **NIST AI RMF 1.0** — AI 风险管理框架
- **OWASP Top 10 for Agentic Applications (2026)** — 每项风险对应 ERDL 规则
- **EU AI Act (2026-08-02 全面生效)** — 高风险 AI 系统的透明度和人工监督要求
- **GB/Z 185-2026 《人工智能 智能体互联》系列国家标准** — 中国首套智能体互联标准体系（7 部分），2026-05-22 发布，2028 年前升级为强制国标（GB）
- **中国信通院「可信 AI 智能体评估体系 2.0」**（2026-04-15 发布）— 面向企业级智能体的八大维度全链路评估框架

### 1.5 本文档约定

本文档使用 RFC 2119 关键词：MUST（必须）、MUST NOT（禁止）、SHOULD（应该）、SHOULD NOT（不应该）、MAY（可选）。

ERDL 规则使用 YAML 1.2 语法。规则文件命名为 `*.erdl.yaml` 或 `*.erdl.yml`。

---

## 2. 架构

### 2.1 Agent 运行时架构

```
┌──────────────────────────────────────────────────────┐
│                  Agent Runtime                       │
│                                                     │
│  ┌──────────┐   ┌──────────┐   ┌───────────────┐   │
│  │   LLM    │   │  Memory  │   │  ERDL Engine   │   │
│  │ (推理)   │   │ (状态)   │   │  (规则执行)    │   │
│  └────┬─────┘   └────┬─────┘   └───────┬───────┘   │
│       │              │                  │           │
│       └──────────────┼──────────────────┘           │
│                      ▼                              │
│            ┌──────────────────┐                     │
│            │   Tool Router    │                     │
│            │  (工具调度)       │                     │
│            └────────┬─────────┘                     │
│                     │                               │
│          ┌──────────┴──────────┐                    │
│          ▼                     ▼                    │
│   ┌────────────┐       ┌────────────┐              │
│   │ MCP Client │       │ A2A Client │              │
│   │ (工具连接) │       │ (Agent通信)│              │
│   └────────────┘       └────────────┘              │
└──────────────────────────────────────────────────────┘
```

### 2.2 ERDL 引擎组件

```
┌───────────────────────────────────────┐
│           ERDL Engine                 │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │   Parser    │  │  Rule Engine   │ │
│  │  YAML+Zod   │─▶│  when/then     │ │
│  └─────────────┘  │  evaluation    │ │
│                   └───────┬────────┘ │
│  ┌─────────────┐          │          │
│  │  SafeExpr   │          │          │
│  │  表达式引擎  │◀─────────┘          │
│  └─────────────┘                     │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │ Action Guard│  │  Audit Logger  │ │
│  │ Tool Call   │  │  结构化记录     │ │
│  │ 拦截层      │  │                │ │
│  └─────────────┘  └────────────────┘ │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │ Hot Reload  │  │ Snapshot Mgr   │ │
│  │ 实时规则更新 │  │ 版本+回滚      │ │
│  └─────────────┘  └────────────────┘ │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │ Proposal    │  │  Agent State   │ │
│  │ Engine      │  │  Manager       │ │
│  │ 规则治理     │  │ 运行时状态追踪  │ │
│  └─────────────┘  └────────────────┘ │
└───────────────────────────────────────┘
```

### 2.3 执行流程

```
Agent Tool Call
     │
     ▼
Action Guard ─── Guard 规则评估
     │
  ┌──┴─────────────────────┐
  ▼                        ▼
ALLOW/CORRECT           BLOCK/HALT/ESCALATE/
  │                      REQUEST_HUMAN/QUARANTINE
  ▼                        │
修正后的 Tool Call       返回拦截/纠偏原因到 Agent
  │
  ▼
Rule Engine ─── 策略规则评估
  │
  ▼
Audit Logger ─── 结构化记录
  │
  ▼
返回结果到 Agent
```

### 2.4 集成模型

ERDL 支持三种集成深度：

| 模式 | 深度 | 确定性 | 适用人群 | 平台覆盖 |
|------|:---:|:---:|------|:---:|
| **SKILL.md** | 浅 — Prompt 注入 | 🟡 依赖 LLM | 任何人 | 任何 Agent |
| **MCP Tool** | 中 — Agent 调用 | 🟡 代理模式可强制 | 开发者 | 300+ MCP 平台 |
| **SDK / Middleware** | 深 — 代码级拦截 | ✅ 协议层 | 框架开发者 | 特定框架 |

---

## 3. 核心概念

### 3.1 Entity（实体）

Entity 是 ERDL 规则作用的主体。在 Agent 场景中：

| Entity 类型 | 说明 |
|------|------|
| `agent` | 单个 Agent 实例 |
| `tool` | Agent 调用的工具 |
| `task` | Agent 执行的任务 |
| `workflow` | 多 Agent 编排流程 |
| `human` | 人类审批者 |
| `guardian` | Guardian Agent（监管者） |

Entity 通过 context 传递给规则引擎。规则引擎匹配 context 中的字段与 when 条件。

### 3.2 Rule（规则）

Rule 是 ERDL 的核心单元：

```
Rule = Metadata + When (条件) + Then (动作) + Audit (审计)
```

**优先级与冲突解决**：

1. 按 `priority` 从小到大排序（值越小越先）
2. 同 priority 的，有 `override` 标记的排在前面
3. override 级别：`critical` > `high` > `normal` > `low`
4. 同 priority 且同 override 的，按定义顺序

### 3.3 When（条件）

**11 个 Operator**：

| Operator | 说明 | 示例 |
|------|------|------|
| `eq` | 等于 | `value: "exec"` |
| `ne` | 不等于 | `value: "exec"` |
| `gt` | 大于 | `value: 100` |
| `gte` | 大于等于 | `value: 3` |
| `lt` | 小于 | `value: 0.8` |
| `lte` | 小于等于 | `value: 10` |
| `in` | 值在列表中 | `value: ["rm", "sudo"]` |
| `contains` | 字符串包含 | `value: "delete"` |
| `match` | 正则匹配 | `value: "(rm -rf|sudo)"` |
| `exists` | 字段存在且非空 | — |
| `within` | 时间窗口约束 | `within: "5m"` 🆕 |

**`within` 时间窗口**（v1.0 新增）：

```yaml
when:
  logic: AND
  conditions:
    - field: "agent.consecutive_errors"
      operator: gte
      value: 3
      within: "1m"    # 1 分钟内连错 3 次
```

支持的时间单位：`s`（秒）、`m`（分钟）、`h`（小时）、`d`（天）。

**速率限制**（v1.0 新增）：

```yaml
when:
  field: "tool.name"
  operator: eq
  value: "api_call"
  rate: "10/1m"       # 每分钟最多 10 次
```

### 3.4 Then（动作）

| 动作 | 层级 | 说明 |
|------|:---:|------|
| `ALLOW` | Ring 3 | 放行，正常执行 |
| `CORRECT` | Ring 3 | 纠正参数后放行 |
| `STRATEGIZE` | Ring 3 | 建议替代策略 |
| `AUDIT` | Ring 3 | 仅记录日志 |
| `CALCULATE` | Ring 3 | 安全计算 |
| `VALIDATE` | Ring 3 | 校验不通过则拒绝 |
| `NOTIFY` | Ring 3 | 发送通知 |
| `REQUEST_HUMAN` | Ring 2 | 请求人类审批 |
| `ESCALATE` | Ring 2 | 升级到上级 Agent |
| `DELEGATE` | Ring 2 | 委派给指定 Agent |
| `ROLLBACK` | Ring 1 | 回滚当前操作 |
| `QUARANTINE` | Ring 1 | 隔离，禁止后续操作直到审核 |
| `BLOCK` | Ring 0 | 直接拒绝 |
| `EMERGENCY_HALT` | Ring 0 | 紧急终止，全局生效 |

### 3.5 Execution Rings（执行环）

ERDL 借鉴了操作系统 CPU 特权环模型，将 Agent 操作分为四个 Ring：

```
Ring 0 (最高限制)  ← EMERGENCY_HALT, BLOCK
Ring 1 (高限制)    ← ROLLBACK, QUARANTINE
Ring 2 (中限制)    ← REQUEST_HUMAN, ESCALATE, DELEGATE
Ring 3 (低限制)    ← ALLOW, CORRECT, STRATEGIZE, AUDIT
```

Guardian Agent 默认运行在 Ring 0。普通 Agent 默认运行在 Ring 3。规则可以将特定操作提升到更高的 Ring。

### 3.6 Guard（防线）

Guard 是一类特殊的规则——它在 Agent 的 Tool Call 执行前被调用。**Agent 无法绕过 Guard。**

Guard 的 then 仅支持 Ring 0-2 的动作：`BLOCK`、`EMERGENCY_HALT`、`QUARANTINE`、`ROLLBACK`、`REQUEST_HUMAN`、`ESCALATE`、`CORRECT`。

### 3.7 Observable / Guardian Agent 模型

ERDL 定义了两种 Agent 角色：

| 角色 | 职责 | Ring |
|------|------|:---:|
| **Observed Agent** | 被监管的 Agent，执行用户任务 | Ring 3 |
| **Guardian Agent** | 监管 Agent，执行规则校验 | Ring 0 |

Guardian Agent 可以拦截 Observed Agent 的所有 Tool Call。一个 Guardian Agent 可以监管多个 Observed Agent。

```yaml
agent:
  role: guardian
  observes:
    - agent-alpha
    - agent-beta
  ruleset: enterprise-compliance.erdl.yaml
```

### 3.8 Audit（审计）

每条规则触发生成一条审计记录（Audit Record）：

```
audit_id            — 唯一标识（UUID v7）
rule_ref            — 规则名称 + 版本
timestamp           — ISO 8601 带纳秒精度
context_snapshot    — 触发时的完整 context（敏感字段脱敏）
decision            — 放行/拦截/纠偏/升级
reason              — 决策原因（人类可读 + 规则引用）
agent_id            — 触发的 Agent Identity
session_id          — 会话标识
parent_audit_id     — 跨 Agent 审计链的上级记录（可选）
ring_level          — 触发时所在执行环
trace_id            — OpenTelemetry Trace ID
```

**跨 Agent 审计链**：

```
Agent A: audit_001 → Agent B: audit_002 (parent: audit_001)
  → Agent C: audit_003 (parent: audit_002)
```

**合规输出**：审计日志支持导出为 OCSF (Open Cybersecurity Schema Framework) 和 OpenTelemetry OTLP 格式。

---

## 4. Agent 身份与信任

### 4.1 Agent Identity

每个 Agent MUST 具有唯一身份标识：

```yaml
agent:
  id: "did:erdl:agent-alpha"
  name: "Order Processing Agent"
  version: "2.1.0"
  vendor: "openoba"
```

支持的身份机制：
- **DID**（Decentralized Identifier）— `did:erdl:` 前缀
- **SPIFFE/SPIRE** — 企业级工作负载身份
- **OAuth 2.0 / OpenID Connect** — 标准 Web 身份

### 4.2 Agent BOM (Bill of Materials)

每个 Agent SHOULD 声明其组件清单（AgBOM）：

```yaml
bom:
  llm:
    provider: "deepseek"
    model: "deepseek-v4-pro"
    version: "2026.06"
  tools:
    - name: "exec"
      version: "1.0.0"
      sha256: "abc123..."
    - name: "web_search"
      version: "2.1.0"
      sha256: "def456..."
  skills:
    - name: "browser-automation"
      version: "0.3.0"
      author: "openoba"
  sdks:
    erdl-engine: "1.0.0"
```

支持的 BOM 格式：CycloneDX、SPDX、SWID。

ERDL 规则可以校验 BOM 合规性：

```yaml
rule: "require-audited-tools"
when:
  logic: AND
  conditions:
    - field: "agent.bom.tools[*].sha256"
      operator: exists
      value: true
then: ALLOW
message: "所有 Tool 都有校验和"
```

### 4.3 Trust Scoring

Agent 之间的信任评分（1-1000）：

```
0–199    不信任（Untrusted）
200–499  低信任（Low）
500–749  中信任（Medium）
750–899  高信任（High）
900–1000 完全信任（Full）
```

Trust Score 由 Guardian Agent 根据以下因素动态计算：
- 历史违规次数
- 规则合规率
- BOM 完整性
- 请求频率异常

```yaml
rule: "require-trust-for-delete"
when:
  logic: AND
  conditions:
    - field: "tool.name"
      operator: eq
      value: "exec"
    - field: "tool.args.command"
      operator: match
      value: "(delete|remove|purge)"
    - field: "caller.reputation_score"
      operator: lt
      value: 750
then: REQUEST_HUMAN  # reputation_score 仅为声誉参考信号，非治理依据
```

---

## 5. 规则文件格式

### 5.1 完整模板

```yaml
# agent.erdl.yaml
protocol: "erdl/v1"
version: "1.0.0"

metadata:
  name: "agent-alpha-rules"
  description: "Agent Alpha 的行为规则"
  author: "security-team@openoba.com"
  tags: [production, pci-dss, agent-guard]
  owasp_alignment: [A01, A02, A06]  # OWASP Agentic Top 10

agent:
  id: "did:erdl:agent-alpha"
  role: observed
  guardian: "did:erdl:guardian-main"

bom:
  llm:
    provider: "deepseek"
    model: "deepseek-v4-pro"
  tools:
    - name: "exec"
      version: "1.0.0"

config:
  default_then: "ALLOW"
  audit_enabled: true
  hot_reload: true
  otlp_endpoint: "https://otel.example.com/v1/traces"

entities:
  - type: agent
    name: agent-alpha
  - type: tool
    name: exec
  - type: tool
    name: web_search

rules:
  - name: "emergency-kill"
    description: "全局紧急停止"
    priority: 0
    override: critical
    when:
      logic: OR
      conditions:
        - field: "signal.type"
          operator: eq
          value: "emergency"
        - field: "agent.threat_level"
          operator: gte
          value: 900
    then: EMERGENCY_HALT
    message: "🚨 紧急终止：Agent 行为异常"

  - name: "dangerous-command-intercept"
    description: "拦截危险 Shell 命令"
    priority: 10
    override: high
    owasp: "A02"  # Tool Misuse
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: eq
          value: "exec"
        - field: "tool.args.command"
          operator: match
          value: "(rm -rf|sudo|chmod 777|> /dev/|mkfs)"
    then: CORRECT
    message: "⚠️ 危险命令已拦截。路径已纠正到安全区域。"

  - name: "loop-detection"
    description: "检测 Agent 执行循环"
    priority: 20
    owasp: "A07"  # Infinite Loops
    when:
      logic: AND
      conditions:
        - field: "agent.consecutive_errors"
          operator: gte
          value: 3
          within: "1m"
    then: STRATEGIZE
    message: "🔄 检测到执行循环。建议更换策略或检查输入。"

  - name: "rate-limit-api"
    description: "限制 API 调用频率"
    priority: 30
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: eq
          value: "api_call"
          rate: "10/1m"
    then: REQUEST_HUMAN
    message: "⏱️ API 调用频率超限，需要人工确认"

  - name: "weekend-write-lock"
    description: "非工作时间写操作需审批"
    priority: 40
    owasp: "A06"  # Excessive Agency
    when:
      logic: AND
      conditions:
        - field: "time.is_weekend"
          operator: eq
          value: true
        - field: "tool.name"
          operator: in
          value: ["write", "exec", "delete"]
    then: REQUEST_HUMAN
    message: "🔒 非工作时间，写操作需审批"

  - name: "workspace-boundary"
    description: "限制文件操作在工作区内"
    priority: 50
    when:
      logic: AND
      conditions:
        - field: "tool.args.path"
          operator: match
          value: "^/(etc|var|sys|proc|dev)"
    then: CORRECT
    message: "📁 路径已纠正到工作区。操作系统目录不可访问。"

  - name: "trust-requirement"
    description: "低信任 Agent 不能执行高风险操作"
    priority: 60
    when:
      logic: AND
      conditions:
        - field: "caller.reputation_score"
          operator: lt
          value: 500  # 声誉参考信号，非合规治理输入
        - field: "action.risk_level"
          operator: gte
          value: 3
    then: ESCALATE
    message: "🔐 信任度不足，操作已升级到 Guardian Agent"

  - name: "pii-audit"
    description: "涉及个人数据的操作强制审计"
    priority: 100
    owasp: "A03"  # Data Leakage
    when:
      logic: AND
      conditions:
        - field: "data.contains_pii"
          operator: eq
          value: true
    then: AUDIT
    audit_level: "FULL"
    message: "📋 操作涉及个人数据，已记录完整审计日志"
```

### 5.2 A2A Agent Card 扩展

ERDL 兼容 A2A v1.0 的 Agent Card：

```json
{
  "name": "Order Processing Agent",
  "description": "Handles order creation and discount application",
  "url": "https://agents.example.com/order-agent",
  "version": "1.0.0",
  "capabilities": {
    "actions": ["create_order", "apply_discount", "delete_order"]
  },
  "extensions": {
    "erdl": {
      "protocol": "erdl/v1",
      "rules_file": "https://agents.example.com/agent.erdl.yaml",
      "audit_endpoint": "https://agents.example.com/erdl/audit",
      "guardian": "did:erdl:guardian-main",
      "reputation_score": 850
    }
  }
}
```

> 注意: `reputation_score` 仅为参考 -- 这是声誉信号("该 Agent 总体是否可信？")，不是合规/治理依据。合规要求的是逐决策验证：每个受治理的操作绑定 (规则版本, 输入, 判定) 为可重新计算的内容寻址记录，任何第三方可离线验证(见第6节 审计追踪)。合规回答的是："本次具体操作是否被允许？依据哪个规则版本？可否证伪？"

### 5.3 MCP Tool 声明

ERDL 作为 MCP Tool 暴露：

```json
{
  "name": "erdl_evaluate",
  "description": "Evaluate ERDL rules against an agent tool call",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tool_name": { "type": "string" },
      "tool_args": { "type": "object" },
      "agent_id": { "type": "string" },
      "session_id": { "type": "string" }
    }
  }
}
```

---

## 6. 安全模型

### 6.1 SafeExpr 表达式引擎

ERDL 使用自研 SafeExpr 引擎——纯递归下降解析器。不使用 `eval`、`new Function`、`Function()` 或任何形式的动态代码执行。

支持的操作：算术（`+` `-` `*` `/` `%` `()`）、逻辑比较、字符串操作。每次求值严格校验 AST 节点类型。不支持原型链访问。不支持 `require`、`import`、`process`。

**安全保证**：即使 ERDL 规则文件被恶意篡改，SafeExpr 引擎不会执行注入的代码。

### 6.2 规则隔离

- 规则文件加载路径 MUST 显式声明。引擎 MUST NOT 自动扫描或加载未经声明的规则文件
- Guardian Agent 的规则域（Policy Domain）与 Observed Agent 隔离
- 策略域变更 MUST 经过 Proposal 审批流程

### 6.3 审计安全

- 审计记录包含 context_snapshot。敏感字段在进入审计记录前 MUST 自动脱敏
- 审计日志 SHOULD 不可篡改（append-only，可选用区块链或 WAL 实现）
- 审计记录 MUST NOT 包含 API key、密码、token 等凭证

### 6.4 Emergency HALT

- Guardian Agent 可以在任何时间发送 EMERGENCY_HALT 信号
- EMERGENCY_HALT MUST 在 1 秒内生效
- 被 HALT 的 Agent 进入 QUARANTINE 状态，所有操作被冻结直到 Guardian Agent 手动解除

---

## 7. 合规对齐

### 7.1 OWASP Top 10 for Agentic Applications (2026)

| OWASP 风险 | ERDL 应对 |
|------|------|
| **A01: Goal Hijacking** | Action Guard 拦截非预期 Tool Call |
| **A02: Tool Misuse** | Guard 规则 + Execution Rings |
| **A03: Data Leakage** | PII 检测 + AUDIT 强制记录 |
| **A04: Memory Poisoning** | BOM 校验 + Audit Chain 追溯 |
| **A05: Identity Abuse** | Agent Identity + Trust Scoring |
| **A06: Excessive Agency** | Execution Rings + REQUEST_HUMAN |
| **A07: Infinite Loops** | within 时间窗口 + STRATEGIZE |
| **A08: Cascading Failures** | Rollback + 跨 Agent 审计链 |
| **A09: Rogue Agents** | Guardian Agent + EMERGENCY_HALT |
| **A10: Supply Chain Risk** | Agent BOM 校验 |

### 7.2 EU AI Act (2026-08-02)

| 要求 | ERDL 覆盖 |
|------|:---:|
| 透明度（Transparency） | ✅ 结构化审计日志 + 自然语言规则 |
| 人工监督（Human Oversight） | ✅ REQUEST_HUMAN + ESCALATE |
| 风险管理（Risk Management） | ✅ Execution Rings + Trust Scoring |
| 技术文档（Technical Documentation） | ✅ Agent BOM + RuleRecord |
| 准确性（Accuracy） | ✅ CORRECT + STRATEGIZE 纠偏 |

### 7.3 NIST AI RMF 1.0

| 功能 | ERDL 映射 |
|------|------|
| Map | ERDL Entity 定义 = 风险映射 |
| Measure | Trust Scoring + 规则合规率 = 度量 |
| Manage | Execution Rings + Guardian Agent = 管理 |
| Govern | Proposal Engine + Snapshot = 治理 |

### 7.4 GB/Z 185-2026 《人工智能 智能体互联》

GB/Z 185-2026 是中国首套智能体互联国家级标准体系，2026 年 5 月 22 日批准发布。由中国电子技术标准化研究院（CESI）牵头，华为、清华大学等 30 余家单位联合研制。系列标准共 7 部分，构建从"身份可信、能力可见、发现匹配、交互协作"到"工具调用、任务完成"的全流程标准化体系。标准的核心原则：**不仅要"连得上"，还要"信得过、管得住、可追溯"**。

GB/Z 185 定义了智能体互联的**四层通用模型**（GB/Z 185.1）：感知层 → 决策层 → 执行层 → 协作层。ERDL 与四层模型的对应关系：

| 层级 | 国标定义 | ERDL 覆盖 |
|------|---------|:---:|
| 感知层 | 上下文获取与环境感知 | ✅ Entity 定义（§3.1）提供结构化上下文输入 |
| 决策层 | 策略决策与行为推理 | ✅ when/then 规则引擎是决策层的声明式实现 |
| 执行层 | 操作执行与安全控制 | ✅ Guard 规则（§3.6）提供协议级拦截 |
| 协作层 | 跨 Agent 通信与协同 | ✅ A2A Agent Card 扩展（§5.2）提供规则声明 |

#### 7.4.1 身份与描述

| 国标要求 | ERDL 覆盖 |
|------|:---:|
| **唯一身份码**（GB/Z 185.2）— 28 位 AID 编码（企业信用代码 + 类型 + 序列号 + 安全分级 + 校验码）| ✅ Agent Identity（§4.1）支持 DID / SPIFFE / OAuth 多种身份机制；28 位 AID 作为可选身份方案，通过 `aid` 扩展字段承载 |
| **身份全生命周期管理**（GB/Z 185.3）— 注册 → 认证 → 分级 → 变更 → 冻结 → 注销 | ✅ Agent Identity 支持版本化与状态标记；Guardian Agent 可强制执行身份策略 |
| **审计日志留存 ≥36 个月**（GB/Z 185.3）| ✅ 审计记录（§3.8）包含完整时间戳；Snapshot（§2.2）支持合规归档策略 |
| **ACDL 能力描述语言**（GB/Z 185.4）— JSON Schema 格式，强制标注功能、I/O、权限、依赖、环境约束 | ✅ Entity 定义（§3.1）+ Agent BOM（§4.2）结构语义等价；支持输出为 ACDL JSON Schema |

#### 7.4.2 交互与协作

| 国标要求 | ERDL 覆盖 |
|------|:---:|
| **智能体发现**（GB/Z 185.5）— 同步查询 + 异步发布/订阅；本地局域网无中心发现 | ✅ 发现属于 L8 通信层职责（§1.1）— 由 A2A / 注册中心实现；ERDL 在 Agent Card 扩展中声明规则可用性 |
| **gRPC+Protobuf 交互协议**（GB/Z 185.6）— 同步调用 + 异步事件推送 + 长会话上下文传递 | ✅ ERDL 独立于传输协议（§8）；规则引擎通过框架适配层对接任意传输协议 |
| **溯源 AID 链条**（GB/Z 185.6）— 每条报文携带完整协作链 | ✅ 跨 Agent 审计链（§3.8）通过 `parent_audit_id` 实现等价溯源；`trace_chain` 映射到审计记录链路 |

#### 7.4.3 工具调用安全

| 国标要求 | ERDL 覆盖 |
|------|:---:|
| **工具注册**（GB/Z 185.7）— 上线前 MUST 登记所有可用工具 | ✅ Agent BOM（§4.2）声明工具清单，含名称、版本、SHA-256 校验和 |
| **参数校验**（GB/Z 185.7）— 调用前 MUST 校验参数合法性 | ✅ Guard 规则（§3.6）在 Tool Call 执行前拦截并校验参数；SafeExpr（§6.1）确保校验逻辑零注入 |
| **权限拦截**（GB/Z 185.7）— 未登记工具 MUST 直接拦截 | ✅ BLOCK + EMERGENCY_HALT（§3.4）提供协议级拒绝 |
| **调用日志**（GB/Z 185.7）— 每次调用 MUST 记录 | ✅ 审计记录（§3.8）为每次规则触发生成结构化日志 |
| **异常熔断**（GB/Z 185.7）— 异常时 MUST 熔断 | ✅ QUARANTINE（§3.4）+ Guardian Agent（§3.7）提供隔离与熔断机制 |

#### 7.4.4 ERDL 与 GB/Z 185 的互补关系

GB/Z 185 定义了 Agent 互联的**基础设施规范**（身份、通信、发现、工具调用）。ERDL 在此基础上提供了 GB/Z 185 未覆盖的**语义规则层**：

| 能力 | GB/Z 185 | ERDL |
|------|:--:|:--:|
| 身份标识 | ✅ 28 位 AID | ✅ 多身份机制 + AID 兼容 |
| 通信协议 | ✅ gRPC+Protobuf | 传输无关，适配任意协议 |
| 能力描述 | ✅ ACDL JSON Schema | ✅ 可执行的 when/then 规则 |
| 工具安全 | ✅ 五重安全机制 | ✅ Execution Rings 四级分级控制 |
| 决策规则 | — | ✅ 11 operators + Guard + override 硬约束 |
| 决策审计 | ✅ trace_chain 溯源 | ✅ 结构化审计记录（为什么做这个决策）|
| 人工监督 | — | ✅ REQUEST_HUMAN + ESCALATE |
| 规则治理 | — | ✅ Proposal Engine + Snapshot/Rollback |

ERDL 与 GB/Z 185 的关系是**遵守对齐补充**：GB/Z 185 定义 Agent 之间"如何连通"，ERDL 定义 Agent "应遵循什么规则"。两者共同构成完整的 Agent 互操作基础设施——MCP 管工具连接，A2A 管 Agent 通信，GB/Z 185 管互联规范，ERDL 管行为规则。

---

### 7.5 中国信通院「可信 AI 智能体评估体系 2.0」

中国信通院（CAICT）于 2026 年 4 月 15 日发布「可信 AI 智能体评估体系 2.0」，构建面向企业级智能体的全生命周期、多层次、可量化的综合评价框架。评估体系覆盖**八大维度**，为技术选型、项目验收、行业监管与规模化落地提供标准化支撑。

#### 7.5.1 八大维度对应

| 评估维度 | 信通院关注点 | ERDL 覆盖 |
|----------|-------------|:---:|
| 基础设施 | 运行环境、硬件适配、异构兼容、弹性扩展 | 不涉及 — 基础设施由部署平台提供 |
| 数据资源 | 数据开发、数据工程、DataOps | ✅ Entity 定义（§3.1）提供类型安全的数据语义建模 |
| **核心组件** | **协作协议、RAG、Skills、编排** | ✅ ERDL 核心优势区 — Guard 规则协同协议 + fn Skills 注册 + chain/combine 编排 |
| 平台支撑 | 开发、测试、运营、优化全生命周期工具链 | ✅ Hot Reload + Parse/Lint + Snapshot/Rollback + Proposal Engine |
| **关键能力** | **感知、决策、生成、交互、多智能体协同** | ✅ 决策（when/then）+ 生成（Entity 实例化）+ 交互（规则输出）+ 多智能体（Guardian/Observed 模型）|
| 典型应用 | 个人、企业、行业（金融、工业、教育）应用案例 | ✅ §5.1 完整规则模板覆盖工具拦截、安全审计、速率限制等工作负载 |
| 运营管理 | 运维制度与能力 | ✅ 审计日志（§3.8）+ Snapshot 回滚（§2.2）+ Proposal Engine 规则治理 |
| 价值评价 | 业务价值、服务质量、应用效能、应用成熟度 | ✅ 四实验全链路验证 + 开源 ERP 规则覆盖率实证（51–68%）|

#### 7.5.2 核心组件维度深度对齐

信通院明确将"协作协议、RAG、Skills、编排"列为核心组件重点评估项。ERDL 在此维度的对应机制：

| 信通院子项 | ERDL 机制 | 说明 |
|-----------|----------|------|
| 协作协议 | A2A Agent Card 扩展（§5.2）+ Entity 语义约定（§3.1） | `.erdl.yaml` 作为多方共享的规则协议，人 · LLM · Agent · 系统 · 审计共享同一语义约定 |
| Skills | `fn` 函数注册 + 热插拔 Skill 架构（§5 扩展层） | within / state / combine / override / fn 五种元属性天然映射到 Skills 维度 |
| 编排 | `chain` 规则链 + `combine` 多规则聚合（§2.3） | when/then 编排逻辑 + Guardian/Observed Agent 角色编排 |

---

### 7.6 ISO/IEC 42001:2023 — AI 管理系统

ISO/IEC 42001 是全球首个 AI 管理系统（AIMS）国际标准，采用 Plan-Do-Check-Act (PDCA) 循环，与 ISO 9001 / 27001 / 14001 共用 Annex SL 高层结构，可直接集成到现有企业管理体系中。

| 42001 要求 | ERDL 映射 |
|-----------|----------|
| **A.5.2 AI 方针** — 组织必须建立与战略一致的 AI 方针 | `policies[]`（版本化 YAML 规则文件）→ 企业 AI 治理方针的可执行形式 |
| **A.7.5 文件化信息** — 管理系统文件须受控（创建、更新、分发、保留、处置） | `proposal_id` + Snapshot Manager → 规则变更有完整的提案→审批→版本→回滚生命周期 |
| **A.9.1 监测、测量、分析与评估** — 组织须评估 AI 系统性能和效果 | `matched_rules[]`（每条决策可追溯到策略、上下文、结果）+ `total_evaluated` / `total_matched` |
| **A.9.2 内部审计** — 按计划间隔开展内部审计 | `audit.hash` + `audit.previous_hash`（防篡改审计链）+ 结构化审计日志（§3.8） |
| **A.9.3 管理评审** — 最高管理者定期评审 AIMS | `result.severity` + `result.action_taken`（提供管理层可见的风险处置证据） |
| **A.10.1 持续改进** — 不符合项与纠正措施 | CORRECT + Rollback 机制 → 自动纠正 + 规则迭代闭环 |

ERDL 通过将 AI 方针转化为可执行的 when/then 规则，将 42001 的 PDCA 循环自动化：**Plan**（规则提案）→ **Do**（规则引擎执行）→ **Check**（审计日志验证）→ **Act**（纠正与回滚）。

### 7.7 IEEE P3395 — Recommended Practice for Agentic AI Practices

IEEE P3395 是 IEEE 正在制定的 Agentic AI 实践推荐标准，旨在为 AI Agent 的设计、部署和治理提供行业指导。标准目前处于早期阶段，但 ERDL 已在前述关键方向上与之对齐：

| P3395 方向（预期） | ERDL 前置对齐 |
|-------------------|-------------|
| Agent 行为的可追溯性 | `decision_id` (UUID v7) + `audit.chain`（防篡改） |
| 决策的责任归属 | `agent.role` (guardian/operator/observer) + `agent.id` |
| 多 Agent 协作的边界定义 | Guardian/Observed 模型 + Execution Rings 分层治理 |
| 基于风险的 Agent 分级管控 | `result.severity` (none/low/medium/high/critical) + Execution Rings (Ring 0-3) |

P3395 正式发布后，ERDL 将更新本节以反映最终标准的具体要求。

---

## 8. 协议互操作

### 8.1 与 MCP 的关系

ERDL 可以作为 MCP Tool 暴露。Agent 通过 MCP 协议调用 ERDL 进行规则校验。

**代理模式**（推荐）：将危险 Tool 的 MCP 端点指向 ERDL 代理，由 ERDL 校验后再转发到真正的 Tool 实现。Agent 无法绕过——它调不到原始 Tool。这是实现确定性 Guard 的最可靠方式。

### 8.2 与 A2A 的关系

ERDL 扩展了 A2A 的 Agent Card（`extensions.erdl` 字段）。在 A2A Task 委派中：

1. 委派前：Agent A 通过 ERDL 校验委派是否合规
2. 委派后：Agent B 通过 ERDL 校验自己是否有权执行
3. 完成后：Agent A 通过 ERDL 校验结果是否可信

### 8.3 与 OpenTelemetry 的关系

ERDL 审计记录输出为 OTLP Span。每个规则触发生成一个 Span。跨 Agent 审计链通过 `parent_audit_id` → OTLP `parentSpanId` 映射。

### 8.4 与 OCSF 的关系

审计日志支持导出为 OCSF (Open Cybersecurity Schema Framework) 格式，兼容 SIEM 系统。

---

## 9. 版本兼容性

### 9.1 协议版本

通过 `protocol` 字段声明：`"erdl/v1"`。引擎在加载规则文件时 MUST 校验协议版本。不支持的版本 MUST 拒绝加载并给出明确错误信息。

### 9.2 规则文件版本

通过 `version` 字段使用 SemVer。不声明则默认为 `"0.0.0"`。

### 9.3 向后兼容

- v1 引擎 MUST 支持 v1 规则文件
- 新增 operator 不破坏现有规则
- 废弃的 operator SHALL 在文档中标注，至少保留一个大版本的兼容期

---

## 10. 参考实现

ERDL 引擎的参考实现位于 `@openoba/erdl-engine`（TypeScript）。

**能力矩阵**：

| 特性 | v1.0 规范 | 参考实现 |
|------|:---:|:---:|
| YAML 解析 + Zod 校验 | ✅ | ✅ |
| 11 operators + AND/OR 嵌套 | ✅ | ✅ (10 operators, within 规划中) |
| SafeExpr 表达式引擎 | ✅ | ✅ |
| Action Guard (协议层拦截) | ✅ | ✅ |
| Hot Reload | ✅ | ✅ |
| 审计日志 (RuleRecord) | ✅ | ✅ |
| Snapshot + Rollback | ✅ | ✅ |
| Proposal Engine (规则治理) | ✅ | ✅ |
| Agent Identity + Trust Scoring | ✅ | 🚧 规划中 |
| Agent BOM | ✅ | 🚧 规划中 |
| Execution Rings | ✅ | 🚧 规划中 |
| Observable / Guardian 模型 | ✅ | 🚧 规划中 |
| EMERGENCY_HALT | ✅ | 🚧 规划中 |
| OpenTelemetry 集成 | ✅ | 🚧 规划中 |
| MCP Tool 代理模式 | ✅ | 🚧 规划中 |
| A2A Agent Card 扩展 | ✅ | 🚧 规划中 |
| GB/Z 185 国标 AID 身份码 | ✅ | 🚧 规划中 |
| GB/Z 185 ACDL 能力描述输出 | ✅ | 🚧 规划中 |
| 审计日志 ≥36 月留存 | ✅ | 🚧 规划中 |
| 工具白名单注册表（GB/Z 185.7）| ✅ | 🚧 规划中 |
| 规则治理 — 数量指南 + 冲突检测 + 遮蔽检测 | ✅ | 🚧 规划中 |
| 规则治理 — Registry 全局视图（加载审计日志）| ✅ | 🚧 规划中 |

---

## 11. 规则治理

ERDL 不仅定义规则怎么写，还定义规则之间的交互行为。规则治理是 L9 协议层的职责——不由应用层实现、不由 Agent 代劳、不由用户手动维护。引擎在加载规则时自动执行以下治理检测。

### 11.1 规则数量指南

ERDL 引擎的确定性求值在 10,000 条规则内保持 <20ms P99 延迟（Node.js v22 环境实测）。

规则文件的上限不由引擎性能决定，而由以下可审计性约束共同决定：

- **人类审阅能力**：200 条规则（约 3,000 行 YAML）是一次代码评审（Code Review）可覆盖的上限。超过 200 条后，人类无法在一次审阅中追溯完所有规则的交互效应。
- **LLM 审计能力**：当前主流 LLM（DeepSeek/Qwen/GPT-4o）提供 128K tokens 上下文窗口，是标准规范参考的最小实施条件。200 条规则占用约 22% 的窗口（~28KB），为任务上下文保留 78% 的空间。如实施环境使用更大窗口（如 Gemini 2.5 Pro 的 1M tokens 或持续增长的上下文），可在部署者评估后适当提高上限。

| 条件 | 推荐单文件上限 | 依据 |
|------|:--:|------|
| 最小实施条件（128K 上下文 + 人类审阅） | **200 条规则** | 人类 Code Review 可覆盖 + LLM 审计窗口充裕 |
| 充分实施条件（≥1M 上下文 + 自动化审计工具链） | 部署者自定 | 在分片审计和自动化冲突检测支持下可突破 200 条 |
| 理论极限 | 10,000 条 | 引擎性能保证（<20ms P99），但可审计性不再保证 |

**声明**：
- **推荐单文件上限：200 条规则**。超过 200 条时引擎发出 info 级别提示，建议拆分规则文件或使用决策表。
- **推荐单 Agent 上限：1,000 条规则（最多 5 个文件）**。超过 1,000 条时引擎发出 warning，建议增加 Agent 分担规则职责。
- **不设硬性上限**。引擎不阻止加载超过推荐上限的规则文件，由部署者自行决策。
- **核心原则：超过 1,000 条 → 加 Agent，不加规则。** 每个 Agent 独立维护自己的规则文件，通过 Guardian Agent（§3.7）协调跨 Agent 规则交互。

### 11.2 多 Agent 规则分治

当单一 Agent 的规则超过 1,000 条时，不增加规则，而是增加 Agent。每个 Agent 管理一个职责域的规则文件：

```
Agent-A (OrderValidator)     → order_rules.yaml     (180 条)
Agent-B (PaymentGuard)       → payment_rules.yaml    (150 条)
Agent-C (ComplianceAuditor)  → compliance_rules.yaml ( 80 条)
Agent-D (LogisticsRouter)    → logistics_rules.yaml  (120 条)
                              ─────────────────────
                              合计 530 条，4 个 Agent
```

每个 Agent 只求值自己的规则文件，不跨 Agent 合并求值。Agent 间通过任务链传递决策结果，而非共享全局规则表。

如果两个 Agent 的规则产生矛盾（如 Agent-A 要求 CORRECT，Agent-B 要求 BLOCK），矛盾由 Guardian Agent（§3.7）收集冲突审计记录，触发 REQUEST_HUMAN 由人工裁决。**不引入独立的 Rule MAIN Agent**——冲突裁决是治理问题，不是调度问题。调度逻辑（优先级、第一条匹配、override）已由 ERDL Engine 的求值机制完成。

### 11.3 Registry 全局视图

ERDL Registry（§3.1）在规则加载阶段提供全局视图，但不参与运行时决策：

| 检测项 | 触发条件 | 行为 |
|------|------|------|
| **冲突检测** | 两条规则的条件域重叠（intersection ≠ ∅）AND then 结果不同 | ⚠️ warning：记录到加载审计日志，按 priority 裁决 |
| **遮蔽检测** | 规则 B 的条件域被规则 A 的条件域完全包含（B ⊆ A）AND A 的 priority ≥ B | ⚠️ warning：B 永远不会触发 |
| **冗余检测** | 两条规则的条件域相同（A = B）AND then 结果相同 | ℹ️ info：建议合并 |
| **上限告警** | 规则文件超过 200 条 | ℹ️ info：建议拆分文件 |
| **总量告警** | 单 Agent 注册规则超过 1,000 条 | ⚠️ warning：建议增加 Agent |

所有检测结果写入规则加载审计日志（`RuleLoadAudit`），人可读、Agent 可解析。

### 11.4 规则执行优先级

ERDL Engine 按以下顺序处理规则：

1. 所有规则按 `priority` 升序排列（数字越小越优先）
2. 顺序求值每条规则的 `when` 条件
3. 第一条条件全部匹配的规则决定最终动作（`then`）
4. 如果没有规则匹配，默认动作是 `ALLOW`（默认放行）
5. 标记 `override: true` 的规则可以覆盖之前匹配的结果（仅覆盖 `BLOCK` → `ALLOW` 方向，不允许覆盖到更不安全的状态）

**注意**：步骤 3 意味着高优先级的 BLOCK 规则阻止后续规则的评估。如果一个高优先级规则将所有请求标记为 BLOCK，后续规则不会被执行。这与 AWS IAM 的 deny-by-default 和 iptables 的第一条匹配策略一致。

---

## 12. 贡献

ERDL 是一个社区驱动的开放标准。欢迎通过以下方式参与：

- **GitHub Issues** — 提交建议、bug 报告、用例
- **GitHub Discussions** — 讨论协议设计、扩展提案
- **规则模板贡献** — 提交 Agent 场景的规则模板
- **适配器开发** — LangGraph / CrewAI / AutoGen / OpenClaw 适配器

**仓库**：[github.com/OpenOBA/erdl](https://github.com/OpenOBA/erdl)
**网站**：[openoba.com/erdl](https://openoba.com/erdl)
**许可证**：MIT

---

## 附录 A：术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 实体 | Entity | 规则作用的主体 |
| 规则 | Rule | when/then 定义的行为约束 |
| 防线 | Guard | Tool Call 前的强制规则 |
| 执行环 | Execution Ring | 借鉴 CPU 特权环的操作分级 |
| 监管 Agent | Guardian Agent | 执行规则校验的 Agent |
| 受监管 Agent | Observed Agent | 被监管的普通 Agent |
| 代理模式 | Proxy Mode | ERDL 代理危险 Tool 的 MCP 端点 |
| 审计记录 | Audit Record | 规则触发的结构化记录 |
| 组件清单 | AgBOM | Agent Bill of Materials |
| 信任评分 | Trust Score | Agent 之间的动态信任度 |

## 附录 B：Cisco L8/L9 参考

Cisco 研究团队在 arXiv:2511.19699 中提出 Agent 协议的分层架构：

- **L8 (Agent Communication Layer)** — 标准化消息信封、Speech-Act Performatives（REQUEST、INFORM 等）、交互模式（request-reply、publish-subscribe）
- **L9 (Agent Semantic Negotiation Layer)** — **"does not exist today"**。使 Agent 能够发现、协商并锁定 Shared Context。

ERDL 的 Entity 定义直接实现了 L9 的 Shared Context 功能。ERDL 的 then 语义（DELEGATE、QUERY、INFORM）对应了 L8 的 Speech-Act Performatives。

## 附录 C：参考

- Anthropic, "Model Context Protocol (MCP)", 2024. modelcontextprotocol.io
- Google, "Agent-to-Agent Protocol (A2A) v1.0", 2026. a2a-protocol.org
- Fleming et al., "A Layered Protocol Architecture for the Internet of Agents", arXiv:2511.19699, 2025
- OWASP, "Top 10 for Agentic Applications", 2026. genai.owasp.org
- NIST, "AI Agent Standards Initiative", 2026. nist.gov
- EU, "AI Act", Regulation 2024/1689, effective 2026-08-02
- ISO/IEC 42001:2023, "AI Management System"
- IEEE P3395, "Recommended Practice for Agentic AI Practices"
- Agent Control Standard (ACS), github.com/Agent-Control-Standard
- Microsoft, "Agent Governance Toolkit", 2026. github.com/microsoft/agent-governance-toolkit
- GB/Z 185-2026, 《人工智能 智能体互联》系列国家标准（7 部分），国家市场监督管理总局、国家标准化管理委员会，2026
- 中国信通院，《可信 AI 智能体评估体系 2.0》，2026-04-15
- 国家互联网信息办公室、国家发展和改革委员会、工业和信息化部，《智能体规范应用与创新发展实施意见》，2026-05-08

---

> *"确定性架构，而非 Prompt 工程。*
> *声明式规则描述语言，兼容 MCP 和 A2A 生态。*
> *人、LLM、系统、审计共享的语义约定层。"*
>
> -- OpenOBA · 2026.07.10

---

## 13. 社区致谢

ERDL v1.0 在开放的社区讨论中得到完善。

- **Erik Newton (Concordia)** -- 在 A2A Discussion #2031 中提出并验证了"中立性不是宣称的，是测出来的"这一核心原则。Concordia 作为 ERDL Decision Object 的第二个独立 runner，在 A2A #2038 提交了全部 22 条合规向量的逐字节验证结果。其提出的"三个独立实现、一个开放规范、没有单一所有者"的标准化路径为 ERDL 从开源项目走向基础设施标准奠定了方法论基础。
- **chopmob-cloud / AlgoVoi (Christopher Hopley)** -- 在 A2A Discussion #2031 中提出了关键贡献：合规 substrate 模型与跨验证愿景（"two L2s targeting the same JCS+SHA-256 discipline"）；声誉（advisory）与合规证据（per-decision 可重新计算的记录）的本质区分；content-address receipt 模型（RFC 8785 JCS 规范化 -> SHA-256 帧）；以及其提出的 Agent 治理四层模型（guardrails, action gate, harness, governance）独立验证了 ERDL 所实现的 Action Gate 层。这些反馈实质性地改进了 spec 的架构清晰度和白皮书的证据优先架构。

欢迎通过 GitHub Issues 和 A2A Discussions 继续参与社区审阅。
