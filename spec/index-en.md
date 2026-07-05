# ERDL Protocol Specification v1.0

> **Entity-Rule Definition Language — Open Standard for Agent Behavioral Rules**
>
> Version: 1.0 (Community Preview) · 2026-07-04
> Maintainer: OpenOBA
> License: MIT
> Status: Request for Comments
>
> **MCP manages tools. A2A manages communication. ERDL manages rules.**

---

## 1. Introduction

### 1.1 The Agent Protocol Stack

The AI Agent ecosystem is rapidly standardizing. Two protocols define the foundation of agent interoperability:

- **MCP** (Model Context Protocol, Anthropic → Linux Foundation): The standard for connecting agents to external tools — "USB for Agents"
- **A2A** (Agent-to-Agent Protocol, Google → Linux Foundation): The standard for inter-agent communication — "HTTP for Agents"

Cisco Research proposed a layered agent protocol architecture in 2025 (arXiv:2511.19699), defining L8 (Agent Communication Layer) and L9 (Agent Semantic Negotiation Layer). L8 is being implemented by MCP and A2A. **L9 "does not exist today" (original quote).**

**ERDL is L9 — the Agent Semantic Rules Layer.**

### 1.2 What Is ERDL

ERDL (Entity-Rule Definition Language) is an open, declarative standard for agent behavioral rules. It defines the constraints, policies, and corrective logic that AI agents must follow when executing operations.

**ERDL is not prompt engineering.** It is a deterministic engine. Rules are executed by the SafeExpr expression engine — recursive descent parsing, zero code injection. Agents cannot bypass it.

**ERDL is not an agent framework.** It does not replace LangGraph, CrewAI, or OpenClaw. It integrates into these frameworks as their missing rules layer.

**ERDL does not compete with MCP/A2A.** The three layers complement each other to form a complete agent interoperability infrastructure:

```
┌──────────────────────────────────┐
│  A2A  — Agent ↔ Agent Comm Std   │  Google · LF · 150+ orgs
├──────────────────────────────────┤
│  ERDL — Agent Behavior Rules Std │  OpenOBA · MIT
├──────────────────────────────────┤
│  MCP  — Agent ↔ Tool Conn Std    │  Anthropic · LF · 97M downloads/mo
└──────────────────────────────────┘
```

### 1.3 Design Principles

| Principle | Description |
|------|------|
| **Declarative** | Rules expressed in when/then YAML; no code required |
| **Deterministic** | Rules enforced by engine, not reliant on LLM compliance |
| **Protocol-level interception** | Action Guard intercepts before Tool Call execution, not a prompt suggestion |
| **Auditable** | Every rule trigger, block, and correction is structurally logged |
| **Hot-reloadable** | Rule changes take effect without restarting the agent runtime |
| **Framework-agnostic** | Not bound to any agent framework or LLM provider |
| **Layered complementarity** | Cooperates with MCP/A2A; neither replaces nor conflicts |
| **Translate + Guide + Correct** | Not just hard blocks. Corrects paths, suggests strategies, guides agents back on track |
| **Multi-party semantic layer** | Humans, LLMs, agents, systems, and auditors share one semantic contract |
| **Secure by default** | Default ALLOW when no rule matches. But Guard rules load by default |

### 1.4 Relationship to IEEE/ISO/NIST

ERDL aims to align with the following frameworks:

- **IEEE P3395** — Recommended Practice for Agentic AI Practices (in development)
- **ISO/IEC 42001** — AI Management System
- **NIST AI RMF 1.0** — AI Risk Management Framework
- **OWASP Top 10 for Agentic Applications (2026)** — Each risk maps to ERDL rules
- **EU AI Act (effective 2026-08-02)** — Transparency and human oversight requirements for high-risk AI systems

### 1.5 Document Conventions

This document uses RFC 2119 keywords: MUST, MUST NOT, SHOULD, SHOULD NOT, MAY.

ERDL rules use YAML 1.2 syntax. Rule files are named `*.erdl.yaml` or `*.erdl.yml`.

---

## 2. Architecture

### 2.1 Agent Runtime Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Agent Runtime                       │
│                                                     │
│  ┌──────────┐   ┌──────────┐   ┌───────────────┐   │
│  │   LLM    │   │  Memory  │   │  ERDL Engine   │   │
│  │(Reasoning)│  │ (State)  │   │(Rule Execution)│   │
│  └────┬─────┘   └────┬─────┘   └───────┬───────┘   │
│       │              │                  │           │
│       └──────────────┼──────────────────┘           │
│                      ▼                              │
│            ┌──────────────────┐                     │
│            │   Tool Router    │                     │
│            │(Tool Dispatch)   │                     │
│            └────────┬─────────┘                     │
│                     │                               │
│          ┌──────────┴──────────┐                    │
│          ▼                     ▼                    │
│   ┌────────────┐       ┌────────────┐              │
│   │ MCP Client │       │ A2A Client │              │
│   │(Tool Conn.)│       │(Agent Comm)│              │
│   └────────────┘       └────────────┘              │
└──────────────────────────────────────────────────────┘
```

### 2.2 ERDL Engine Components

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
│  │ Expr Engine │◀─────────┘          │
│  └─────────────┘                     │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │ Action Guard│  │  Audit Logger  │ │
│  │ Tool Call   │  │  Structured    │ │
│  │ Interceptor │  │  Logging       │ │
│  └─────────────┘  └────────────────┘ │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │ Hot Reload  │  │ Snapshot Mgr   │ │
│  │ Live Rule   │  │ Version +      │ │
│  │ Updates     │  │ Rollback       │ │
│  └─────────────┘  └────────────────┘ │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │ Proposal    │  │  Agent State   │ │
│  │ Engine      │  │  Manager       │ │
│  │ Rule        │  │ Runtime State  │ │
│  │ Governance  │  │ Tracking       │ │
│  └─────────────┘  └────────────────┘ │
└───────────────────────────────────────┘
```

### 2.3 Execution Flow

```
Agent Tool Call
     │
     ▼
Action Guard ─── Guard Rule Evaluation
     │
  ┌──┴─────────────────────┐
  ▼                        ▼
ALLOW/CORRECT           BLOCK/HALT/ESCALATE/
  │                      REQUEST_HUMAN/QUARANTINE
  ▼                        │
Corrected Tool Call     Return block/correction reason to Agent
  │
  ▼
Rule Engine ─── Policy Rule Evaluation
  │
  ▼
Audit Logger ─── Structured Logging
  │
  ▼
Return Result to Agent
```

### 2.4 Integration Models

ERDL supports three integration depths:

| Mode | Depth | Determinism | Target Audience | Platform Coverage |
|------|:---:|:---:|------|:---:|
| **SKILL.md** | Shallow — Prompt injection | 🟡 LLM-dependent | Anyone | Any Agent |
| **MCP Tool** | Medium — Agent invocation | 🟡 Enforceable via proxy mode | Developers | 300+ MCP platforms |
| **SDK / Middleware** | Deep — Code-level interception | ✅ Protocol-level | Framework developers | Specific frameworks |

---

## 3. Core Concepts

### 3.1 Entity

An Entity is the subject upon which ERDL rules act. In the agent context:

| Entity Type | Description |
|------|------|
| `agent` | A single agent instance |
| `tool` | A tool invoked by an agent |
| `task` | A task executed by an agent |
| `workflow` | A multi-agent orchestration flow |
| `human` | A human approver |
| `guardian` | A Guardian Agent (supervisor) |

Entities are passed to the rule engine via context. The rule engine matches fields in the context against when conditions.

### 3.2 Rule

A Rule is the core unit of ERDL:

```
Rule = Metadata + When (conditions) + Then (actions) + Audit
```

**Priority and Conflict Resolution**:

1. Sort by `priority` ascending (lower values first)
2. Among equal priority, rules with `override` flag come first
3. Override levels: `critical` > `high` > `normal` > `low`
4. Among equal priority and override level, definition order applies

### 3.3 When (Conditions)

**11 Operators**:

| Operator | Description | Example |
|------|------|------|
| `eq` | Equals | `value: "exec"` |
| `ne` | Not equals | `value: "exec"` |
| `gt` | Greater than | `value: 100` |
| `gte` | Greater than or equal | `value: 3` |
| `lt` | Less than | `value: 0.8` |
| `lte` | Less than or equal | `value: 10` |
| `in` | Value in list | `value: ["rm", "sudo"]` |
| `contains` | String contains | `value: "delete"` |
| `match` | Regex match | `value: "(rm -rf|sudo)"` |
| `exists` | Field exists and is non-empty | — |
| `within` | Time window constraint | `within: "5m"` 🆕 |

**`within` Time Window** (new in v1.0):

```yaml
when:
  logic: AND
  conditions:
    - field: "agent.consecutive_errors"
      operator: gte
      value: 3
      within: "1m"    # 3 consecutive errors within 1 minute
```

Supported time units: `s` (seconds), `m` (minutes), `h` (hours), `d` (days).

**Rate Limiting** (new in v1.0):

```yaml
when:
  field: "tool.name"
  operator: eq
  value: "api_call"
  rate: "10/1m"       # Max 10 calls per minute
```

### 3.4 Then (Actions)

| Action | Ring | Description |
|------|:---:|------|
| `ALLOW` | Ring 3 | Permit; proceed normally |
| `CORRECT` | Ring 3 | Correct parameters then permit |
| `STRATEGIZE` | Ring 3 | Suggest alternative strategy |
| `AUDIT` | Ring 3 | Log only |
| `CALCULATE` | Ring 3 | Safe computation |
| `VALIDATE` | Ring 3 | Reject if validation fails |
| `NOTIFY` | Ring 3 | Send notification |
| `REQUEST_HUMAN` | Ring 2 | Request human approval |
| `ESCALATE` | Ring 2 | Escalate to superior agent |
| `DELEGATE` | Ring 2 | Delegate to designated agent |
| `ROLLBACK` | Ring 1 | Roll back current operation |
| `QUARANTINE` | Ring 1 | Isolate; block subsequent operations until review |
| `BLOCK` | Ring 0 | Deny outright |
| `EMERGENCY_HALT` | Ring 0 | Emergency shutdown; global effect |

### 3.5 Execution Rings

ERDL borrows from the OS CPU privilege ring model, classifying agent operations into four rings:

```
Ring 0 (Most Restricted)  ← EMERGENCY_HALT, BLOCK
Ring 1 (Highly Restricted)← ROLLBACK, QUARANTINE
Ring 2 (Moderately Restricted) ← REQUEST_HUMAN, ESCALATE, DELEGATE
Ring 3 (Least Restricted) ← ALLOW, CORRECT, STRATEGIZE, AUDIT
```

Guardian Agents run in Ring 0 by default. Regular agents run in Ring 3 by default. Rules can promote specific operations to higher rings.

### 3.6 Guard

A Guard is a special class of rule — it is invoked before an agent's Tool Call executes. **Agents cannot bypass Guards.**

Guard `then` clauses support only Ring 0–2 actions: `BLOCK`, `EMERGENCY_HALT`, `QUARANTINE`, `ROLLBACK`, `REQUEST_HUMAN`, `ESCALATE`, `CORRECT`.

### 3.7 Observable / Guardian Agent Model

ERDL defines two agent roles:

| Role | Responsibility | Ring |
|------|------|:---:|
| **Observed Agent** | Supervised agent; executes user tasks | Ring 3 |
| **Guardian Agent** | Supervising agent; enforces rule validation | Ring 0 |

A Guardian Agent can intercept all Tool Calls from Observed Agents. One Guardian Agent can supervise multiple Observed Agents.

```yaml
agent:
  role: guardian
  observes:
    - agent-alpha
    - agent-beta
  ruleset: enterprise-compliance.erdl.yaml
```

### 3.8 Audit

Each rule trigger generates an Audit Record:

```
audit_id            — Unique identifier (UUID v7)
rule_ref            — Rule name + version
timestamp           — ISO 8601 with nanosecond precision
context_snapshot    — Full context at trigger time (sensitive fields redacted)
decision            — Allow / Block / Correct / Escalate
reason              — Decision rationale (human-readable + rule reference)
agent_id            — Identity of the triggering agent
session_id          — Session identifier
parent_audit_id     — Parent record in cross-agent audit chain (optional)
ring_level          — Execution ring at trigger time
trace_id            — OpenTelemetry Trace ID
```

**Cross-Agent Audit Chain**:

```
Agent A: audit_001 → Agent B: audit_002 (parent: audit_001)
  → Agent C: audit_003 (parent: audit_002)
```

**Compliance Output**: Audit logs support export to OCSF (Open Cybersecurity Schema Framework) and OpenTelemetry OTLP formats.

---

## 4. Agent Identity and Trust

### 4.1 Agent Identity

Every agent MUST have a unique identity:

```yaml
agent:
  id: "did:erdl:agent-alpha"
  name: "Order Processing Agent"
  version: "2.1.0"
  vendor: "openoba"
```

Supported identity mechanisms:
- **DID** (Decentralized Identifier) — `did:erdl:` prefix
- **SPIFFE/SPIRE** — Enterprise-grade workload identity
- **OAuth 2.0 / OpenID Connect** — Standard web identity

### 4.2 Agent BOM (Bill of Materials)

Every agent SHOULD declare its component manifest (AgBOM):

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

Supported BOM formats: CycloneDX, SPDX, SWID.

ERDL rules can validate BOM compliance:

```yaml
rule: "require-audited-tools"
when:
  logic: AND
  conditions:
    - field: "agent.bom.tools[*].sha256"
      operator: exists
      value: true
then: ALLOW
message: "All tools have checksums"
```

### 4.3 Trust Scoring

Inter-agent trust scores (1–1000):

```
0–199    Untrusted
200–499  Low
500–749  Medium
750–899  High
900–1000 Full Trust
```

Trust Score is dynamically computed by the Guardian Agent based on:
- Historical violation count
- Rule compliance rate
- BOM completeness
- Request frequency anomalies

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
then: REQUEST_HUMAN  # reputation_score: advisory reputation signal, not a governance input
```

---

## 5. Rule File Format

### 5.1 Complete Template

```yaml
# agent.erdl.yaml
protocol: "erdl/v1"
version: "1.0.0"

metadata:
  name: "agent-alpha-rules"
  description: "Behavioral rules for Agent Alpha"
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
    description: "Global emergency halt"
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
    message: "🚨 Emergency halt: Abnormal agent behavior detected"

  - name: "dangerous-command-intercept"
    description: "Intercept dangerous shell commands"
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
    message: "⚠️ Dangerous command intercepted. Path corrected to safe zone."

  - name: "loop-detection"
    description: "Detect agent execution loops"
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
    message: "🔄 Execution loop detected. Consider switching strategy or checking input."

  - name: "rate-limit-api"
    description: "Limit API call frequency"
    priority: 30
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: eq
          value: "api_call"
          rate: "10/1m"
    then: REQUEST_HUMAN
    message: "⏱️ API call rate limit exceeded. Human confirmation required."

  - name: "weekend-write-lock"
    description: "Write operations outside business hours require approval"
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
    message: "🔒 Outside business hours. Write operations require approval."

  - name: "workspace-boundary"
    description: "Restrict file operations to workspace"
    priority: 50
    when:
      logic: AND
      conditions:
        - field: "tool.args.path"
          operator: match
          value: "^/(etc|var|sys|proc|dev)"
    then: CORRECT
    message: "📁 Path corrected to workspace. OS directories are not accessible."

  - name: "trust-requirement"
    description: "Low-trust agents cannot perform high-risk operations"
    priority: 60
    when:
      logic: AND
      conditions:
        - field: "caller.reputation_score"
          operator: lt
          value: 500  # advisory reputation signal
        - field: "action.risk_level"
          operator: gte
          value: 3
    then: ESCALATE
    message: "🔐 Insufficient trust level. Operation escalated to Guardian Agent."

  - name: "pii-audit"
    description: "Mandatory audit for operations involving personal data"
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
    message: "📋 Operation involves personal data. Full audit log recorded."
```

### 5.2 A2A Agent Card Extension

ERDL is compatible with the A2A v1.0 Agent Card:

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

> NOTE: `reputation_score` is advisory only -- it is a reputation signal ("is this agent generally trusted?"), NOT a compliance/governance input. For compliance, use per-decision content-addressed receipts: each governed action binds (rule_version, inputs, verdict) into a recomputable record any third party can verify offline (see Section 6: Audit Trail). Compliance answers: "was THIS specific action allowed, under which rule version, and can I prove it?"

### 5.3 MCP Tool Declaration

ERDL exposed as an MCP Tool:

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

## 6. Security Model

### 6.1 SafeExpr Expression Engine

ERDL uses a custom-built SafeExpr engine — a pure recursive descent parser. It does not use `eval`, `new Function`, `Function()`, or any form of dynamic code execution.

Supported operations: arithmetic (`+` `-` `*` `/` `%` `()`), logical comparisons, string operations. Every evaluation strictly validates AST node types. Prototype chain access is not supported. `require`, `import`, and `process` are not supported.

**Security guarantee**: Even if an ERDL rule file is maliciously tampered with, the SafeExpr engine will not execute injected code.

### 6.2 Rule Isolation

- Rule file loading paths MUST be explicitly declared. The engine MUST NOT automatically scan or load undeclared rule files
- The Guardian Agent's Policy Domain is isolated from Observed Agents
- Policy domain changes MUST go through the Proposal approval process

### 6.3 Audit Security

- Audit records include context_snapshot. Sensitive fields MUST be automatically redacted before entering the audit record
- Audit logs SHOULD be tamper-proof (append-only; optionally implemented via blockchain or WAL)
- Audit records MUST NOT contain credentials such as API keys, passwords, or tokens

### 6.4 Emergency HALT

- A Guardian Agent can send an EMERGENCY_HALT signal at any time
- EMERGENCY_HALT MUST take effect within 1 second
- A halted agent enters QUARANTINE state; all operations are frozen until manually released by the Guardian Agent

---

## 7. Compliance Alignment

### 7.1 OWASP Top 10 for Agentic Applications (2026)

| OWASP Risk | ERDL Countermeasure |
|------|------|
| **A01: Goal Hijacking** | Action Guard intercepts unintended Tool Calls |
| **A02: Tool Misuse** | Guard rules + Execution Rings |
| **A03: Data Leakage** | PII detection + mandatory AUDIT logging |
| **A04: Memory Poisoning** | BOM validation + Audit Chain traceability |
| **A05: Identity Abuse** | Agent Identity + Trust Scoring |
| **A06: Excessive Agency** | Execution Rings + REQUEST_HUMAN |
| **A07: Infinite Loops** | `within` time window + STRATEGIZE |
| **A08: Cascading Failures** | Rollback + cross-agent audit chain |
| **A09: Rogue Agents** | Guardian Agent + EMERGENCY_HALT |
| **A10: Supply Chain Risk** | Agent BOM validation |

### 7.2 EU AI Act (2026-08-02)

| Requirement | ERDL Coverage |
|------|:---:|
| Transparency | ✅ Structured audit logs + natural-language rules |
| Human Oversight | ✅ REQUEST_HUMAN + ESCALATE |
| Risk Management | ✅ Execution Rings + Trust Scoring |
| Technical Documentation | ✅ Agent BOM + RuleRecord |
| Accuracy | ✅ CORRECT + STRATEGIZE corrections |

### 7.3 NIST AI RMF 1.0

| Function | ERDL Mapping |
|------|------|
| Map | ERDL Entity definitions = risk mapping |
| Measure | Trust Scoring + rule compliance rate = measurement |
| Manage | Execution Rings + Guardian Agent = management |
| Govern | Proposal Engine + Snapshot = governance |

---

## 8. Protocol Interoperability

### 8.1 Relationship to MCP

ERDL can be exposed as an MCP Tool. Agents invoke ERDL via the MCP protocol for rule validation.

**Proxy Mode** (recommended): Point the MCP endpoint of dangerous tools to an ERDL proxy. ERDL validates first, then forwards to the actual tool implementation. Agents cannot bypass it — they have no direct access to the original tool. This is the most reliable way to implement deterministic Guards.

### 8.2 Relationship to A2A

ERDL extends the A2A Agent Card (`extensions.erdl` field). In A2A Task delegation:

1. Pre-delegation: Agent A validates via ERDL whether the delegation is compliant
2. Post-delegation: Agent B validates via ERDL whether it has authority to execute
3. Post-completion: Agent A validates via ERDL whether the result is trustworthy

### 8.3 Relationship to OpenTelemetry

ERDL audit records are output as OTLP Spans. Each rule trigger generates one Span. Cross-agent audit chains map via `parent_audit_id` → OTLP `parentSpanId`.

### 8.4 Relationship to OCSF

Audit logs support export to OCSF (Open Cybersecurity Schema Framework) format, compatible with SIEM systems.

---

## 9. Version Compatibility

### 9.1 Protocol Version

Declared via the `protocol` field: `"erdl/v1"`. The engine MUST validate the protocol version when loading rule files. Unsupported versions MUST be rejected with a clear error message.

### 9.2 Rule File Version

Uses SemVer via the `version` field. Defaults to `"0.0.0"` if undeclared.

### 9.3 Backward Compatibility

- v1 engines MUST support v1 rule files
- New operators do not break existing rules
- Deprecated operators SHALL be documented and retain compatibility for at least one major version

---

## 10. Reference Implementation

The reference implementation of the ERDL engine is located at `@openoba/erdl-engine` (TypeScript).

**Capability Matrix**:

| Feature | v1.0 Spec | Reference Implementation |
|------|:---:|:---:|
| YAML parsing + Zod validation | ✅ | ✅ |
| 11 operators + AND/OR nesting | ✅ | ✅ (10 operators; `within` planned) |
| SafeExpr expression engine | ✅ | ✅ |
| Action Guard (protocol-level interception) | ✅ | ✅ |
| Hot Reload | ✅ | ✅ |
| Audit logging (RuleRecord) | ✅ | ✅ |
| Snapshot + Rollback | ✅ | ✅ |
| Proposal Engine (rule governance) | ✅ | ✅ |
| Agent Identity + Trust Scoring | ✅ | 🚧 Planned |
| Agent BOM | ✅ | 🚧 Planned |
| Execution Rings | ✅ | 🚧 Planned |
| Observable / Guardian model | ✅ | 🚧 Planned |
| EMERGENCY_HALT | ✅ | 🚧 Planned |
| OpenTelemetry integration | ✅ | 🚧 Planned |
| MCP Tool proxy mode | ✅ | 🚧 Planned |
| A2A Agent Card extension | ✅ | 🚧 Planned |

---

## 11. Contributing

ERDL is a community-driven open standard. Contributions are welcome via:

- **GitHub Issues** — Submit suggestions, bug reports, use cases
- **GitHub Discussions** — Discuss protocol design, extension proposals
- **Rule template contributions** — Submit rule templates for agent scenarios
- **Adapter development** — LangGraph / CrewAI / AutoGen / OpenClaw adapters

**Repository**: [github.com/openoba/erdl](https://github.com/openoba/erdl)
**Website**: [openoba.com/erdl](https://openoba.com/erdl)
**License**: MIT

---

## Appendix A: Glossary

| Term | Description |
|------|------|
| Entity | The subject upon which rules act |
| Rule | Behavioral constraint defined by when/then |
| Guard | Mandatory pre-Tool-Call rule |
| Execution Ring | Operation privilege tier borrowed from CPU privilege rings |
| Guardian Agent | Agent that enforces rule validation |
| Observed Agent | Regular agent under supervision |
| Proxy Mode | ERDL proxies MCP endpoints of dangerous tools |
| Audit Record | Structured record of a rule trigger |
| AgBOM | Agent Bill of Materials |
| Trust Score | Dynamic inter-agent trust level |

## Appendix B: Cisco L8/L9 Reference

The Cisco research team proposed a layered architecture for agent protocols in arXiv:2511.19699:

- **L8 (Agent Communication Layer)** — Standardized message envelopes, Speech-Act Performatives (REQUEST, INFORM, etc.), interaction patterns (request-reply, publish-subscribe)
- **L9 (Agent Semantic Negotiation Layer)** — **"does not exist today"**. Enables agents to discover, negotiate, and lock in Shared Context.

ERDL's Entity definitions directly implement L9's Shared Context functionality. ERDL's `then` semantics (DELEGATE, QUERY, INFORM) correspond to L8's Speech-Act Performatives.

## Appendix C: References

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

---

> *"Deterministic architecture, not prompt engineering.*
> *MCP manages tools. A2A manages communication. ERDL manages rules.*
> *A complete agent interoperability stack."*
>
> -- OpenOBA · 2026-07-04

---

## 11. Community Acknowledgments

ERDL v1.0 was improved through open community discussion.

- **chopmob-cloud / AlgoVoi (Christopher Hopley)** -- Critical feedback on trust_score vs. compliance evidence. The distinction between reputation (advisory) and compliance (per-decision recomputable record) was contributed through A2A Discussion #2031, as was the content-address receipt model (RFC 8785 JCS canonicalization -> SHA-256 frame). This materially improved both the spec's architectural clarity and the whitepaper's evidence-first architecture.
- **Abhishek Tiwari** -- The four-layer agent governance model (guardrails, action gate, harness, governance) independently validated the Action Gate layer that ERDL implements.

We welcome further community review through GitHub Issues and A2A Discussions.
