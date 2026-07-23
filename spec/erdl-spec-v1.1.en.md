<!--
  Copyright (c) 2026 唐启鑫 (Tang Qixin)
  Licensed under MIT. See LICENSE file.
-->

﻿# ERDL Protocol Specification v1.1

> **Entity-Rule Definition Language — Open Standard for Agent Behavioral Rules**
>
> Version: 1.1 (Final) · 2026-07-22 · Frozen
> Maintainer: OpenOBA
> License: MIT
> Status: Final
>
> **A declarative rule description language, compatible with the MCP and A2A ecosystems.**
>
> **A Shared Semantic Contract Layer for Humans, LLMs, Systems, and Auditors.**
>
> **This version was finalized following two independent third-party reviews. Reviewers: Technical Self-Consistency Audit (v1.1 draft) · Engineering Feasibility Audit (v1.1 draft).**

---

## Version Notes

This document was consolidated from the following sources and finalized after two rounds of independent third-party review:

| Source | Version | Date | Role |
|--------|---------|------|------|
| `index.md` | v1.0 (Community Preview) | 2026-07-10 | Core specification skeleton (§1–§13) |
| `erdl-spec-v1.1-draft.md` | v1.1 (Draft) | 2026-07-21 | v1.1 incremental sections (§3.2.1–§3.2.4, §3.4.1, §11.5) |
| `decision-object-v1.0.md` | v1.0 (Frozen) | 2026-07-15 · Frozen | Full audit subset integration (§12 Decision Object) |
| External Audit #1 | Technical Self-Consistency Deep Audit | 2026-07-22 | Cross-section consistency, edge conflicts, semantic gap detection |
| External Audit #2 | Engineering Feasibility Audit | 2026-07-22 | Business scenario validation, engineering implementation assessment, toolchain recommendations |

### v1.1 New Sections

| Section | Content | Rationale | Compatibility |
|---------|---------|-----------|:---:|
| **§3.2.1** | Minimum `when` Completeness Requirements | Prevent `when: 'true'` + `then: DENY` from causing system-wide unavailability | Non-breaking |
| **§3.2.2** | `unless` Exemption Mechanism | Rules need exceptions; `unless` is evaluated before `when` | Non-breaking |
| **§3.2.3** | Mandatory `message` Requirement | Empty messages cause exponential increases in operational troubleshooting costs | Non-breaking |
| **§3.2.4** | Rule Naming Conventions | Unstructured naming makes rule bases unmaintainable | Non-breaking |
| **§3.4.1** | Priority of `metadata.decision` vs. `rules[].then` | Resolve semantic conflicts between two decision-bearing fields | Non-breaking |
| **§11.5** | Rule Quality Gates | Automatically detect dangerous/low-quality rules at load time | Non-breaking |
| **§12** | Decision Object (Audit Subset) | Full integration of decision-object-v1.0 (frozen 2026-07-15) | Non-breaking |

### v1.1 Inherited Sections with Adjustments (Based on v1.0, 2026-07-10)

> **Note**: The following sections inherit their core content from v1.0, with minor adjustments in v1.1 (such as new subsections, revised referenced concepts, or supplementary audit behavior definitions), but without structural rewrites. Specific changes are noted in parentheses.

§1 Introduction · §2 Architecture · §3.1 Entity · §3.3 When · §3.4 Then (excluding §3.4.1 new addition) · §3.5 Execution Rings · §3.6 Guard (CORRECT exception revision) · §3.7 Guardian/Observed Agent Model · §3.8 Audit (new `unless` audit behavior subsection) · §4 Agent Identity and Trust · §5 Rule File Format · §6 Security Model (§6.1 new null propagation + resource quota subsections) · §7 Compliance Alignment (§7.5.2 revised referenced concepts) · §8 Protocol Interoperability · §9 Version Compatibility · §10 Reference Implementation · §11.1–§11.4 Rule Governance · §13 Contributing · §14 Acknowledgments · Appendix A–E

### Audit Statement

The v1.1 final specification has undergone the following reviews:
- **Technical Self-Consistency Audit**: Cross-section semantic consistency, edge conflict resolution, specification completeness
- **Engineering Feasibility Audit**: Business scenario validation, engineering implementation assessment, toolchain roadmap
- **Review Date**: 2026-07-22
- **Conclusion**: v1.1 has reached the engineering preview stage and is suitable as the specification baseline for reference implementation development

---

## 1. Introduction

### 1.1 Background: Standardization of the Agent Ecosystem

The AI Agent ecosystem is rapidly standardizing. Two protocols define the foundation of Agent interoperability:

- **MCP** (Model Context Protocol, Anthropic → Linux Foundation): The standard for connecting Agents to external tools — "the USB of Agents"
- **A2A** (Agent-to-Agent Protocol, Google → Linux Foundation): The standard for communication between Agents — "the HTTP of Agents"

Cisco Research proposed a layered Agent protocol architecture in 2025 (arXiv:2511.19699), defining L8 (Agent Communication Layer) and L9 (Agent Semantic Negotiation Layer). L8 is being implemented by MCP and A2A. L9 "does not exist today" (original quote).

**ERDL fills the L9 gap — the Agent Semantic Rule Layer.**

### 1.2 What Is ERDL

ERDL (Entity-Rule Definition Language) is an open, declarative standard for Agent behavioral rules. It defines the constraints, policies, and corrective logic that AI Agents MUST follow when performing operations.

**ERDL is not Prompt Engineering.** It is a deterministic engine. Rules are executed by the SafeExpr expression engine — recursive descent parsing, zero code injection. Agents cannot bypass it.

**ERDL is not an Agent framework.** It does not replace LangGraph, CrewAI, or OpenClaw. It integrates into these frameworks as the missing rule layer they lack.

**ERDL integrates into the existing Agent ecosystem through standard paths:**

- **ERDL → MCP Tool**: Rules are automatically exposed as MCP Tools, invoked by Agents through the standard MCP protocol
- **ERDL → A2A Agent Card Extension**: The Agent Card declares an `erdl` extension, carrying rule files and Guardian Agent information

The three layers work in concert:

```
┌──────────────────────────────────┐
│  A2A  — Agent ↔ Agent Communication  │  Google · LF · 150+ orgs
├──────────────────────────────────┤
│  ERDL — Agent Behavioral Rule Language│  OpenOBA · MIT
│         (MCP Server + A2A Card)  │
├──────────────────────────────────┤
│  MCP  — Agent ↔ Tool Connection Std  │  Anthropic · LF · 97M downloads/mo
└──────────────────────────────────┘
```

### 1.3 Design Principles

| Principle | Description |
|-----------|-------------|
| **Declarative** | Rules are expressed in when/then YAML — no code required |
| **Deterministic** | Rules are executed by the engine, not dependent on LLM self-discipline |
| **Protocol-Level Interception** | Action Guard intercepts before Tool Call execution — not a Prompt suggestion |
| **Auditable** | Every rule trigger, block, and correction is structurally recorded |
| **Hot-Reloadable** | Rule changes require no Agent runtime restart |
| **Framework-Agnostic** | Not bound to any Agent framework or LLM provider |
| **MCP/A2A Complementary** | Integrates via two standard paths: MCP Server and A2A Card extensions |
| **Correct + Guide + Redirect** | Not just blunt blocking. Correct paths, suggest strategies, guide Agents back on track |
| **Multi-Party Semantic Layer** | Humans, LLMs, Agents, systems, and auditors share the same semantic contract |
| **Secure by Default** | Default ALLOW when no rules match. But Guard rules are loaded by default |

### 1.4 Relationship with IEEE/ISO/NIST/GB

ERDL aims to align with the following frameworks:

- **IEEE P3395** — Recommended Practice for Agentic AI Practices (in development)
- **ISO/IEC 42001** — AI Management System
- **NIST AI RMF 1.0** — AI Risk Management Framework
- **OWASP Top 10 for Agentic Applications (2026)** — Each risk maps to ERDL rules
- **EU AI Act (effective 2026-08-02)** — Transparency and human oversight requirements for high-risk AI systems
- **GB/Z 185-2026 "Artificial Intelligence — Agent Interconnection" Series of National Standards** — China's first Agent interconnection standard system (7 parts), published 2026-05-22, to be upgraded to mandatory national standards (GB) before 2028
- **CAICT "Trusted AI Agent Assessment Framework 2.0"** (published 2026-04-15) — An eight-dimension, full-chain assessment framework for enterprise-grade Agents

### 1.5 Document Conventions

This document uses BCP 14 (RFC 2119 & RFC 8174) keywords: MUST, MUST NOT, SHOULD, SHOULD NOT, MAY.

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
│  │(Reasoning)│  │ (State)  │   │ (Rule Exec)    │   │
│  └────┬─────┘   └────┬─────┘   └───────┬───────┘   │
│       │              │                  │           │
│       └──────────────┼──────────────────┘           │
│                      ▼                              │
│            ┌──────────────────┐                     │
│            │   Tool Router    │                     │
│            │ (Tool Dispatch)  │                     │
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
│  │  Expression │◀─────────┘          │
│  │  Engine     │                     │
│  └─────────────┘                     │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │ Action Guard│  │  Audit Logger  │ │
│  │ Tool Call   │  │  Structured    │ │
│  │ Intercept   │  │  Recording     │ │
│  └─────────────┘  └────────────────┘ │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │ Hot Reload  │  │ Snapshot Mgr   │ │
│  │ Live Rule   │  │ Version+       │ │
│  │ Updates     │  │ Rollback       │ │
│  └─────────────┘  └────────────────┘ │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │ Proposal    │  │  Agent State   │ │
│  │ Engine      │  │  Manager       │ │
│  │ Rule Gov.   │  │  Runtime State │ │
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
ALLOW/CORRECT           DENY/HALT/ESCALATE/
  │                      REQUEST_HUMAN/QUARANTINE
  ▼                        │
Corrected Tool Call     Return intercept/correction reason to Agent
  │
  ▼
Rule Engine ─── Policy Rule Evaluation
  │
  ▼
Audit Logger ─── Structured Recording
  │
  ▼
Return Result to Agent
```

### 2.4 Integration Model

ERDL supports three integration depths:

| Mode | Depth | Determinism | Target Audience | Platform Coverage |
|------|:---:|:---:|------|:---:|
| **SKILL.md** | Shallow — Prompt injection | 🟡 LLM-dependent | Anyone | Any Agent |
| **MCP Tool** | Medium — Agent invocation | 🟡 Enforceable in proxy mode | Developers | 300+ MCP platforms |
| **SDK / Middleware** | Deep — Code-level interception | ✅ Protocol-level | Framework developers | Specific frameworks |

---

## 3. Core Concepts

### 3.1 Entity

An Entity is the subject upon which ERDL rules operate. In the Agent context:

| Entity Type | Description |
|-------------|-------------|
| `agent` | A single Agent instance |
| `tool` | A tool invoked by the Agent |
| `task` | A task executed by the Agent |
| `workflow` | A multi-Agent orchestration flow |
| `human` | A human approver |
| `guardian` | A Guardian Agent (supervisor) |

Entities are passed to the rule engine via context. The rule engine matches fields in the context against `when` conditions.

### 3.2 Rule

A Rule is the core unit of ERDL:

```
Rule = Metadata + When (Condition) + Then (Action) + Audit
```

**Priority and Conflict Resolution**:

1. Sort by `priority` ascending (lower value = higher priority)
2. Within the same priority, rules with `override` are evaluated first
3. The `override` field is an enumerated type: `critical` > `high` > `normal` > `low`. Defaults to `normal` when not declared
4. Within the same priority and override level, use definition order
5. Rules marked with `override` can override previously matched results within the same Execution Ring, but **only in the DENY → ALLOW direction** (overriding to a less safe state is not permitted; see §11.4)

---

#### 🆕 §3.2.1 Minimum `when` Completeness Requirements

> Source: erdl-spec-v1.1-draft.md · 2026-07-21 · New in v1.1

##### Background

In practice, the combination of `when: 'true'` + `then: DENY` results in **unconditional blocking of all operations** — every evaluation by the rule engine matches this rule, equivalent to a system-wide shutdown. In code, this is equivalent to `if (true) { throw new Error() }` — logically correct, but engineering-unacceptable.

Similarly, unconditional `when: 'true'` + `then: CORRECT` injects corrective suggestions into every LLM output, even when the operation is completely unrelated to the rule.

##### Specification

| Rule | Level | Description |
|------|-------|-------------|
| `when: 'true'` MUST NOT be combined with `then: DENY` | MUST NOT | Unconditionally blocks all operations |
| `when: 'true'` MUST NOT be combined with `then: EMERGENCY_HALT` | MUST NOT | Unconditionally halts the system |
| `when: 'true'` MUST NOT be combined with `then: CORRECT` | MUST NOT | Indiscriminately injects corrective suggestions into all operations |
| `when: 'true'` MUST NOT be combined with `then: REQUEST_HUMAN` | MUST NOT | Indiscriminately triggers approval workflows |
| `when: 'true'` MAY be combined with `then: ALLOW + instruction` | MAY | Global advisory rules; does not block operations |
| `when: 'true'` MAY be combined with `then: NOTIFY` | MAY | Global notification rules |
| Security rules (category=security) MUST contain at least 1 condition | MUST | Security rules cannot be purely speculative |
| Tool interception rules SHOULD include a `tool.name` condition | SHOULD | Precisely specify affected tools |
| File operation rules (involving write_file/edit/apply_patch) SHOULD include a `tool.args.path` condition | SHOULD | Precisely specify affected files |
| Command operation rules (involving exec) SHOULD include a `tool.args.command` condition | SHOULD | Precisely specify affected commands |

##### Design Rationale

The semantics of `when: 'true'` is "applies to all operations." This semantics is only appropriate for **advisory rules** (ALLOW + instruction / NOTIFY), not for **blocking rules** (DENY / HALT / CORRECT / REQUEST_HUMAN). Blocking rules MUST explicitly specify their scope in the `when` conditions.

##### Examples

```yaml
# ✅ Correct: when: 'true' + advisory instruction
- name: docs-reminder
  when: 'true'
  then: ALLOW
  message: "Document your changes with a summary"

# ❌ Incorrect: when: 'true' + blocking rule
- name: block-everything
  when: 'true'
  then: DENY
  message: "Blocked"
  # → Rule engine MUST reject this rule at load time

# ✅ Correct: blocking rule with precise when
- name: no-console-log
  when:
    logic: AND
    conditions:
      - field: tool.name; operator: in; value: [write_file, edit]
      - field: tool.args.content; operator: contains; value: "console.log"
  then: CORRECT
  message: "Avoid console.log in production code"
```

---

#### 🆕 §3.2.2 `unless` Exemption Mechanism

> Source: erdl-spec-v1.1-draft.md · 2026-07-21 · New in v1.1

##### Background

Rules frequently need exceptions in practice: a `no-console-log` rule may be legitimately bypassed in test files; a `no-force-push` rule may be justifiably overridden during an emergency hotfix. Without an exemption mechanism, users can only disable the entire rule (losing protection) or tolerate false-positive blocks.

The `unless` field provides a rule-level "except when" condition — when `unless` matches, the when/then evaluation is skipped and ALLOW is returned directly.

##### Specification

| Requirement | Level |
|-------------|-------|
| The `unless` field MUST use the same data structure as `when`: `{ logic: AND\|OR, conditions: [...] }` | MUST |
| `unless` MUST be evaluated before `when` | MUST |
| `unless` matches → ALLOW (immediate termination; MUST NOT evaluate `when`) | MUST |
| `unless` does not match → evaluate `when` → `then` | MUST |
| `unless` is an optional field | MAY |

##### Evaluation Order

```
1. unless.conditions → evaluateLeaf()
   ├─ All match → ALLOW (terminate. MUST NOT continue to evaluate when)
   └─ No match → continue
2. when.conditions → evaluateLeaf()
   ├─ All match → then (execute)
   └─ No match → PASS
```

> **Short-Circuit Evaluation Guarantee**: When `unless` evaluates to true, the engine MUST NOT evaluate the `when` expression, directly skipping the `then` action. This is a logical requirement (avoiding meaningless computation), a performance requirement (reducing evaluation overhead), and a safety requirement (preventing evaluation errors in `when` — such as division by zero or null pointer — from being triggered when `unless` has already granted an exemption).

##### Design Rationale

`unless` is evaluated before `when`. This is not "DENY unless X," but rather "do not trigger the rule when X holds." "Triggering the rule" is the semantics of `when`; "not triggering" is the semantics of `unless`. The two are duals of each other.

##### Examples

```yaml
- name: no-console-log
  when:
    logic: AND
    conditions:
      - field: tool.name; operator: in; value: [write_file, edit]
      - field: tool.args.content; operator: contains; value: "console.log"
  then: CORRECT
  message: "Avoid console.log in production code"
  unless:
    logic: OR
    conditions:
      # Test file exemption
      - field: tool.args.path; operator: match; value: "\.test\.(ts|js)$"
      # Using a formal logger → intentional
      - field: tool.args.content; operator: contains; value: "logger."
```

##### Constraints

| Constraint | Level | Description |
|------------|-------|-------------|
| Guard rules (`guard: true`) MUST NOT contain an `unless` field | MUST NOT | Guard is a protocol-level mandatory interception; exemptions via `unless` are not permitted. `unless` applies only to regular policy rules |
| `unless` conditions MUST NOT contain `within` or `rate` constraints | MUST NOT | Exemption conditions should be static and not depend on runtime state. `within`/`rate` depend on temporal state, and using them in `unless` would cause evaluation order ambiguity |

##### Design Rationale

The "defense line" semantics of Guard rules requires that they are never bypassed. If Guard rules could be exempted via `unless`, an attacker would only need to construct a context matching `unless` to bypass them. This contradicts the principle in §3.6 that "Agents cannot bypass Guard."

---

#### 🆕 §3.2.3 Mandatory `message` Requirement

> Source: erdl-spec-v1.1-draft.md · 2026-07-21 · New in v1.1

##### Background

Rule engine logs are the sole basis for troubleshooting. In practice, some rules have empty `message` fields — when the rule triggers, users and developers receive only a cold decision (e.g., "DENY") with no indication of which rule fired or why. Operational troubleshooting costs increase exponentially.

##### Specification

| Rule | Level |
|------|-------|
| The `message` field MUST be a non-empty string | MUST |
| For `DENY` decisions: message MUST include the reason for blocking | MUST |
| For `REQUEST_HUMAN` decisions: message MUST include the reason for approval | MUST |
| For `CORRECT` decisions: message MUST include the correction suggestion | MUST |
| For `EMERGENCY_HALT` decisions: message MUST include the reason for emergency halt | MUST |
| For `ALLOW/NOTIFY/AUDIT` decisions: message SHOULD be a non-empty string | SHOULD |

##### Design Rationale

Blocking rules are the sole basis for runtime diagnostics. A DENY with an empty message is equivalent to saying "you've been blocked, but I won't tell you why." In any production system, this is unacceptable.

##### Consumer Notes

Different decision types have different primary consumers and format recommendations:

| Decision Type | Primary Consumer | Format Recommendation | Example |
|---------------|------------------|-----------------------|---------|
| `DENY` / `EMERGENCY_HALT` | Operations staff / End users | Reason + rule reference | "Dangerous command blocked (SEC-001-code-safety)" |
| `REQUEST_HUMAN` | Approver | Operation description + approval rationale | "Off-hours write operation; supervisor approval required" |
| `CORRECT` | Agent / LLM | Correction suggestion + target format | "Use logger.info() instead of console.log()" |
| `ALLOW` + instruction | Agent / LLM | Advisory instruction | "Please also update the CHANGELOG" |
| `NOTIFY` / `AUDIT` | Audit systems / Compliance teams | Operation summary | "Operation involves personal data; full audit log recorded" |

> **Design Suggestion** (v1.2 goal): When a message needs to address both humans and LLMs, consider splitting into `message.text` (human-readable) and `message.instruction` (LLM instruction). The current v1.1 uses a single `message` field; rule authors should choose the format based on the primary consumer.

---

#### 🆕 §3.2.4 Rule Naming Conventions

> Source: erdl-spec-v1.1-draft.md · 2026-07-21 · New in v1.1

##### Background

In practice, unstructured names such as `old-rule`, `new-rule`, `test-rule`, `temp-rule` have been observed. When the rule base grows beyond 50+ rules, these names lose meaning and make it impossible to trace a rule's origin, purpose, or priority.

##### Specification

| Rule | Level |
|------|-------|
| `name` MUST be a non-empty string | MUST |
| `name` SHOULD follow the `[CAT]-[NNN]-description` format, e.g., `SEC-001-code-safety` | SHOULD |
| `name` MUST NOT use `test-`, `old-`, `temp-`, `debug-`, `wip-` prefixes | MUST NOT |
| `name` MUST be unique within a rule file (case-insensitive) | MUST |

> **Case Sensitivity and Audit Record Note**: Uniqueness checks are case-insensitive (`SEC-001-Code-Safety` and `sec-001-code-safety` are treated as name collisions), but `rule_ref` in audit records preserves the **original casing** as declared in the rule file. This ensures that names in audit logs precisely correspond to their source declarations while preventing collisions caused by case variants.

> **NNN Numbering Note**: NNN numbers need only be unique **within a rule file** — they do not need to be contiguous across files or globally unique. Different files have independent numbering spaces (e.g., SEC-001 in file-a.yaml does not conflict with SEC-001 in file-b.yaml). Number management is the responsibility of the rule file maintainer; no centralized allocation is required. Audit records distinguish same-named rules in different files via `rule_ref` (filename + rule name + version).

> **Design Rationale**: Uniqueness has been elevated from SHOULD to MUST — `rule_ref` in audit logs depends on rule names to distinguish same-named rules. If duplicate names were allowed, hot-reload and conflict detection could not precisely locate the target rule.

##### Category Abbreviations (CAT)

| Abbreviation | Full Name | Corresponding SPEC `category` |
|--------------|-----------|-------------------------------|
| SEC | Security | security |
| ENG | Engineering | engineering |
| COD | Coding | coding |
| PRF | Performance | performance |
| TST | Testing | testing |
| CMP | Compliance | compliance |
| WRT | Writing | writing |
| DSG | Design | design |
| ACC | Accessibility | accessibility |
| CUS | Custom | custom |

##### Examples

```yaml
# ✅ Correct
- name: SEC-001-code-safety
- name: ENG-005-no-shortcut
- name: COD-003-no-any

# ❌ Incorrect
- name: old-rule
- name: test-thing
- name: ''
```

---

### 3.3 When (Condition)

#### Top-Level Syntax

The `when` field supports three syntax forms:

| Form | Syntax | Semantics |
|------|--------|-----------|
| **conditions array** | `{ logic: AND\|OR, conditions: [...] }` | Standard condition matching; each condition includes field/operator/value |
| **Flat shorthand** | `{ field, operator, value[, rate] }` | Shorthand for a single condition; semantically equivalent to `{ logic: AND, conditions: [{ field, operator, value }] }` |
| **`'true'` shorthand** | `when: 'true'` | Always-true match (always), independent of context. Semantically equivalent to unconditional matching |

**Design Rationale**: `when: 'true'` is not an operator, but a top-level shorthand for the `when` field — it means "all operations satisfy this condition." Its evaluation logic is always-true and does not interact with any field in the context. It is only applicable to advisory rules (ALLOW+instruction / NOTIFY); blocking rules (DENY/HALT/CORRECT/REQUEST_HUMAN) MUST NOT use it (see §3.2.1).

#### 13 Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equal to | `value: "exec"` |
| `ne` | Not equal to | `value: "exec"` |
| `gt` | Greater than | `value: 100` |
| `gte` | Greater than or equal to | `value: 3` |
| `lt` | Less than | `value: 0.8` |
| `lte` | Less than or equal to | `value: 10` |
| `in` | Value is in list | `value: ["rm", "sudo"]` |
| `not_in` | Value is not in list | `value: ["ls", "cat"]` |
| `contains` | String contains | `value: "delete"` |
| `not_contains` | String does not contain | `value: "drop table"` |
| `match` | Regex match | `value: "(rm -rf\|sudo)"` |
| `exists` | Field exists and is non-empty | — |
| `within` | Time window constraint | `within: "5m"` |

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
  rate: "10/1m"       # Maximum 10 per minute
```

> **Scope**: `rate` applies to a single Agent instance by default. For global rate limiting, use a Guardian Agent for centralized management, or configure `rate_scope: global`.

### 3.4 Then (Action)

ERDL defines **17 complete actions**. Of these, 13 are **externally visible decision types** (entered into Decision Object, §12), and 4 are **Agent-internal reasoning actions** (not entered into cross-system decision records):

| Action | Ring | Visibility | Description |
|--------|:---:|:---:|-------------|
| `ALLOW` | Ring 3 | External | Allow; proceed normally |
| `CORRECT` | Ring 3 | External | Correct parameters then allow |
| `NOTIFY` | Ring 3 | External | Send notification |
| `DENY` | Ring 0 | External | Hard rejection (`BLOCK` is deprecated; equivalent to `DENY`) |
| `EMERGENCY_HALT` | Ring 0 | External | Emergency halt; globally effective |
| `ROLLBACK` | Ring 1 | External | Roll back current operation |
| `QUARANTINE` | Ring 1 | External | Isolate; block all subsequent operations until audit |
| `REQUEST_HUMAN` | Ring 2 | External | Request human approval |
| `ESCALATE` | Ring 2 | External | Escalate to a higher-level Agent |
| `DELEGATE` | Ring 2 | External | Delegate to a specified Agent (v1.1: temporarily mapped to ESCALATE in Decision Object; independent in v1.2) |
| `WORKFLOW` | Ring 3 | External | Initiate a multi-step workflow orchestration flow |
| `WORKFLOW_WAITING` | Ring 3 | External | Current step conditions not met; wait and retry |
| `WORKFLOW_PROGRESS` | Ring 3 | External | Current step completed; advance to next |
| `STRATEGIZE` | Ring 3 | Internal | Suggest alternative strategy (Agent reasoning) |
| `AUDIT` | Ring 3 | Internal | Log only (Agent reasoning) |
| `CALCULATE` | Ring 3 | Internal | Safe computation (Agent reasoning) |
| `VALIDATE` | Ring 3 | Internal | Reject if validation fails (Agent reasoning) |

**Design Rationale**: `STRATEGIZE`, `AUDIT`, `CALCULATE`, and `VALIDATE` are Agent-internal reasoning actions that do not enter cross-system Decision Objects. `DELEGATE` is an externally visible delegation action that is temporarily mapped to ESCALATE in Decision Object in v1.1 (§12.3), with plans to include it as an independent decision type in v1.2. Decision Object includes only decision types with **external visibility** — those that materially affect enterprise compliance, auditing, and regulatory oversight.

---

#### 🆕 §3.4.1 Priority of `metadata.decision` vs. `rules[].then`

> Source: erdl-spec-v1.1-draft.md · 2026-07-21 · New in v1.1

##### Background

The complete template in SPEC §5.1 defines both `metadata.decision` and `rules[].then` as decision fields, but does not specify the priority when they conflict. Compatible implementations may have inconsistent values in these two fields.

##### Specification

| Rule | Level |
|------|-------|
| `rules[].then` takes priority over `metadata.decision` | MUST |
| If no rules in `rules[]` match → use `metadata.decision` as fallback | MUST |
| If `metadata.decision` is undefined → default value is `ALLOW` | MUST |
| Engine SHOULD validate consistency of both at load time; inconsistency → warning | SHOULD |
| Implementations SHOULD ensure both are kept in sync at write time | SHOULD |

##### Semantics

`metadata.decision` = "if no rule in this file matches, what is the default handling."
`rules[].then` = "when this specific rule matches, what is the handling."

`rules[].then` > `metadata.decision` > engine default `ALLOW`.

---

### 3.5 Execution Rings

ERDL borrows the CPU privilege ring model from operating systems, dividing Agent operations into four Rings.

> **Note**: This section is calibrated against v1.0 index.md (2026-07-10) and Decision Object v1.0 §4 (frozen 2026-07-15). The Ring assignments in Decision Object take precedence (corrected in the 2026-07-13 draft.2).

```
Ring 0 (Most Restrictive)  ← EMERGENCY_HALT, DENY
Ring 1 (Highly Restrictive) ← ROLLBACK, QUARANTINE
Ring 2 (Moderately Restrictive) ← REQUEST_HUMAN, ESCALATE, DELEGATE
Ring 3 (Least Restrictive) ← ALLOW, CORRECT, NOTIFY, STRATEGIZE, AUDIT, CALCULATE, VALIDATE
```

> **Note**: Within Ring 3, STRATEGIZE/AUDIT/CALCULATE/VALIDATE are Agent-internal reasoning actions and do not enter Decision Object (§12). The Free tier supports ALLOW/CORRECT/NOTIFY/DENY/REQUEST_HUMAN; the Pro tier additionally supports ROLLBACK/QUARANTINE/ESCALATE/DELEGATE; EMERGENCY_HALT is Enterprise only.

| Ring | Name | Decision Scope | Owner | Typical Role |
|:---:|------|---------------|-------|--------------|
| **0** | Security Ring | EMERGENCY_HALT, DENY | Security/Compliance | CISO, DPO |
| **1** | Compliance Ring | ROLLBACK, QUARANTINE (Pro) | Compliance/Legal | Compliance Officer |
| **2** | Operations Ring | REQUEST_HUMAN (Free) + ESCALATE, DELEGATE (Pro) | Operations/Business | Department Lead |
| **3** | Execution Ring | ALLOW, CORRECT, NOTIFY (Free) + STRATEGIZE/AUDIT/CALCULATE/VALIDATE (Internal) | Dev/Individual | Individual Developer |

Guardian Agents run in Ring 0 by default. Regular Agents run in Ring 3 by default. Rules can promote specific operations to higher Rings.

Ring 0 evaluates first; Ring 3 last. A Ring 0 HALT may immediately short-circuit all subsequent evaluation. Higher-severity decisions cannot be overridden by lower-severity decisions.

### 3.6 Guard (Defense Line)

A Guard is a special class of rule — it is invoked before the Agent's Tool Call executes. **Agents cannot bypass Guard.**

Guard `then` supports only Ring 0–2 actions: `DENY`, `EMERGENCY_HALT`, `QUARANTINE`, `ROLLBACK`, `REQUEST_HUMAN`, `ESCALATE`. Additionally, Guard may return `CORRECT` (Ring 3) to correct parameters and allow — CORRECT is the sole Ring 3 exception for Guard, because Guard must have the ability to correct dangerous parameters rather than merely block them. (`BLOCK` is a deprecated alias for `DENY`.)

### 3.7 Observable / Guardian Agent Model

ERDL defines two Agent roles:

| Role | Responsibility | Ring |
|------|----------------|:---:|
| **Observed Agent** | The supervised Agent; executes user tasks | Ring 3 |
| **Guardian Agent** | The supervising Agent; performs rule validation | Ring 0 |

A Guardian Agent can intercept all Tool Calls of Observed Agents. A single Guardian Agent may supervise multiple Observed Agents.

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
decision            — Allow/block/correct/escalate
reason              — Decision reason (human-readable + rule reference)
agent_id            — Identity of the triggering Agent
session_id          — Session identifier
parent_audit_id     — Parent record in cross-Agent audit chain (optional)
ring_level          — Execution Ring at trigger time
trace_id            — OpenTelemetry Trace ID
```

**Cross-Agent Audit Chain**:

```
Agent A: audit_001 → Agent B: audit_002 (parent: audit_001)
  → Agent C: audit_003 (parent: audit_002)
```

**Compliance Output**: Audit logs support export to OCSF (Open Cybersecurity Schema Framework) and OpenTelemetry OTLP formats.

**`unless` Audit Behavior** (new in v1.1): When an `unless` condition matches and causes a rule to be skipped, the engine MUST generate an audit record:

- `decision`: `ALLOW`
- `rule_ref`: `[rule-name]/unless` (e.g., `SEC-001-code-safety/unless`)
- `reason`: Includes specific match details of the `unless` condition (which `unless` condition matched)

This makes `unless` exemptions fully traceable in audit logs, distinguishable from the normal when→then trigger path.

---

## 4. Agent Identity and Trust

### 4.1 Agent Identity

Every Agent MUST have a unique identity:

```yaml
agent:
  id: "did:erdl:agent-alpha"
  name: "Order Processing Agent"
  version: "2.1.0"
  vendor: "openoba"
```

Supported identity mechanisms:
- **DID** (Decentralized Identifier) — `did:erdl:` prefix
- **SPIFFE/SPIRE** — Enterprise workload identity
- **OAuth 2.0 / OpenID Connect** — Standard web identity

### 4.2 Agent BOM (Bill of Materials)

Every Agent SHOULD declare its component manifest (AgBOM):

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

Trust scores between Agents (1–1000):

```
0–199    Untrusted
200–499  Low
500–749  Medium
750–899  High
900–1000 Full
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
then: REQUEST_HUMAN  # reputation_score is a reputation signal only, not a governance basis
```

> **Design Rationale**: Trust Score is a **reputation signal** ("Is this Agent generally trustworthy?"), not a compliance/governance basis. Compliance requires per-decision verification: each governed operation binds (rule version, input, decision) into a recomputable content-addressed record that any third party can verify offline (see §12 Decision Object).

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
    message: "🚨 Emergency halt: Agent behavior anomaly"

  - name: "dangerous-command-intercept"
    description: "Intercept dangerous shell commands"
    priority: 10
    override: high
    owasp: ["A02"]  # Tool Misuse
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
    description: "Detect Agent execution loops"
    priority: 20
    owasp: ["A07"]  # Infinite Loops
    when:
      logic: AND
      conditions:
        - field: "agent.consecutive_errors"
          operator: gte
          value: 3
          within: "1m"
    then: STRATEGIZE
    message: "🔄 Execution loop detected. Consider changing strategy or checking input."

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
    message: "⏱️ API call rate exceeded; human confirmation required"

  - name: "weekend-write-lock"
    description: "Off-hours write operations require approval"
    priority: 40
    owasp: ["A06"]  # Excessive Agency
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
    message: "🔒 Off-hours; write operations require approval"

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
    message: "📁 Path corrected to workspace. OS directories are inaccessible."

  - name: "trust-requirement"
    description: "Low-trust Agents cannot perform high-risk operations"
    priority: 60
    when:
      logic: AND
      conditions:
        - field: "caller.reputation_score"
          operator: lt
          value: 500  # Reputation signal, not a compliance governance input
        - field: "action.risk_level"
          operator: gte
          value: 3
    then: ESCALATE
    message: "🔐 Insufficient trust; operation escalated to Guardian Agent"

  - name: "pii-audit"
    description: "Mandatory audit for operations involving personal data"
    priority: 100
    owasp: ["A03"]  # Data Leakage
    when:
      logic: AND
      conditions:
        - field: "data.contains_pii"
          operator: eq
          value: true
    then: AUDIT
    audit_level: "FULL"
    message: "Operation involves personal data; full audit log recorded"
```

### 5.2 A2A Agent Card Extension

ERDL is compatible with A2A v1.0 Agent Cards:

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

> **Design Rationale**: `reputation_score` in the Agent Card is a reputation signal only ("Is this Agent generally trustworthy?"), not a compliance/governance basis. Compliance requires per-decision verification — each governed operation binds (rule version, input, decision) into a recomputable content-addressed record (see §12 Decision Object).

### 5.3 MCP Tool Declaration

ERDL is exposed as an MCP Tool:

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

ERDL uses the in-house SafeExpr engine — a pure recursive descent parser. It does not use `eval`, `new Function`, `Function()`, or any form of dynamic code execution.

Supported operations: arithmetic (`+` `-` `*` `/` `%` `()`), logical comparisons, string operations. Every evaluation strictly validates AST node types. Prototype chain access is not supported. `require`, `import`, and `process` are not supported.

**Security Guarantee**: Even if an ERDL rule file is maliciously tampered with, the SafeExpr engine will not execute injected code.

**Idempotency Constraint** (new in v1.1): Condition expressions (conditions within `when` and `unless`) MUST be purely synchronous and idempotent. Evaluations MUST NOT perform I/O operations (network requests, database queries, file reads/writes, etc.). When external state queries are needed, they should be delegated to registered external functions via `fn` calls. The determinism of condition expressions is a foundational assumption of rule engine correctness.

#### Null Propagation Semantics

Agent Context is highly dynamic, and field absence is the norm. The SafeExpr engine MUST implement a **safe-fail under three-valued logic** principle to avoid runtime crashes caused by missing context fields:

| Scenario | Behavior | Description |
|----------|----------|-------------|
| Equality comparison when field does not exist | Returns `false` | `context.missing_field != 'admin'` → false (not NPE) |
| Numeric comparison when field does not exist | Returns `false` | `context.count > 5` → false |
| `== null` / `!= null` check | Returns `true` / `false` normally | The only operators that can detect field existence |
| Type-mismatched comparison | Returns `false` | `"100" > 50` → false; implicit type conversion is prohibited |
| Arithmetic when field does not exist | Returns `false` (conditions) or `EvaluationError` (arithmetic expressions) | |

> **Design Rationale**: Under standard two-valued logic (access field first, find `undefined` → throw exception), the rule engine in dynamic contexts is highly prone to crashes. The safe-fail principle under three-valued logic ensures that "missing field" is uniformly treated as "condition not satisfied" rather than "evaluation error." This is also the foundational semantic that cross-language reference implementations must unify — different languages handle `undefined`/`nil`/`None` differently, so the specification provides a unified definition.

#### Resource Quotas

To prevent AST bloat attacks and Regular Expression Denial of Service (ReDoS), the SafeExpr engine MUST enforce the following hard constraints at compile time and runtime:

| Constraint | Limit | Level | Excess Behavior |
|------------|:---:|-------|----------------|
| Expression string length | 4KB | Error | Rejected at load time |
| Maximum AST nesting depth | 64 | Error | Rejected at load time |
| Maximum child nodes per node | 256 | Error | Rejected at load time |
| Regex match step limit | 10,000 | Error | Runtime protective interruption → match failure |

> **Design Rationale**: A recursive descent parser alone is insufficient to defend against ReDoS (nested quantifiers, overlapping branches, etc.). These constraints detect static complexity at load time and interrupt malicious backtracking at runtime, ensuring SafeExpr does not become a performance bottleneck in the Agent runtime.

### 6.2 Rule Isolation

- Rule file loading paths MUST be explicitly declared. The engine MUST NOT automatically scan or load undeclared rule files
- The Guardian Agent's Policy Domain is isolated from the Observed Agent
- Policy Domain changes MUST go through the Proposal approval workflow

### 6.3 Audit Security

- Audit records contain `context_snapshot`. Sensitive fields MUST be automatically redacted before entering audit records
- Audit logs SHOULD be tamper-evident (append-only; optionally implemented via blockchain or WAL)
- Audit records MUST NOT contain credentials such as API keys, passwords, or tokens

### 6.4 Emergency HALT

- A Guardian Agent can send an EMERGENCY_HALT signal at any time
- EMERGENCY_HALT MUST take effect within 1 second
- A HALTed Agent enters QUARANTINE state; all operations are frozen until the Guardian Agent manually releases it

---

## 7. Compliance Alignment

### 7.1 OWASP Top 10 for Agentic Applications (2026)

| OWASP Risk | ERDL Response |
|------------|---------------|
| **A01: Goal Hijacking** | Action Guard intercepts unexpected Tool Calls |
| **A02: Tool Misuse** | Guard rules + Execution Rings |
| **A03: Data Leakage** | PII detection + AUDIT mandatory recording |
| **A04: Memory Poisoning** | BOM validation + Audit Chain tracing |
| **A05: Identity Abuse** | Agent Identity + Trust Scoring |
| **A06: Excessive Agency** | Execution Rings + REQUEST_HUMAN |
| **A07: Infinite Loops** | `within` time window + STRATEGIZE |
| **A08: Cascading Failures** | Rollback + cross-Agent audit chain |
| **A09: Rogue Agents** | Guardian Agent + EMERGENCY_HALT |
| **A10: Supply Chain Risk** | Agent BOM validation |

### 7.2 EU AI Act (2026-08-02)

| Requirement | ERDL Coverage |
|-------------|:---:|
| Transparency | ✅ Structured audit logs + natural language rules |
| Human Oversight | ✅ REQUEST_HUMAN + ESCALATE |
| Risk Management | ✅ Execution Rings + Trust Scoring |
| Technical Documentation | ✅ Agent BOM + RuleRecord |
| Accuracy | ✅ CORRECT + STRATEGIZE correction |

### 7.3 NIST AI RMF 1.0

| Function | ERDL Mapping |
|----------|-------------|
| Map | ERDL Entity definitions = risk mapping |
| Measure | Trust Scoring + rule compliance rate = measurement |
| Manage | Execution Rings + Guardian Agent = management |
| Govern | Proposal Engine + Snapshot = governance |

### 7.4 GB/Z 185-2026 "Artificial Intelligence — Agent Interconnection"

GB/Z 185-2026 is China's first national-level Agent interconnection standard system, approved and published on May 22, 2026. Led by the China Electronics Standardization Institute (CESI), it was jointly developed by Huawei, Tsinghua University, and 30+ other organizations. The series comprises 7 parts, building a comprehensive standardization system spanning "trustworthy identity, visible capabilities, discovery and matching, interaction and collaboration" through to "tool invocation and task completion." The standard's core principle: **not just "connectable," but also "trustworthy, governable, and traceable."**

GB/Z 185 defines a **four-layer general model** for Agent interconnection (GB/Z 185.1): Perception Layer → Decision Layer → Execution Layer → Collaboration Layer. ERDL's correspondence with the four-layer model:

| Layer | National Standard Definition | ERDL Coverage |
|-------|---------------------------|:---:|
| Perception Layer | Context acquisition and environment sensing | ✅ Entity definitions (§3.1) provide structured context input |
| Decision Layer | Policy decision and behavioral reasoning | ✅ when/then rule engine is a declarative implementation of the decision layer |
| Execution Layer | Operation execution and security control | ✅ Guard rules (§3.6) provide protocol-level interception |
| Collaboration Layer | Cross-Agent communication and coordination | ✅ A2A Agent Card extension (§5.2) provides rule declarations |

#### 7.4.1 Identity and Description

| National Standard Requirement | ERDL Coverage |
|------------------------------|:---:|
| **Unique Identity Code** (GB/Z 185.2) — 28-bit AID encoding (enterprise credit code + type + serial number + security classification + check digit) | ✅ Agent Identity (§4.1) supports DID / SPIFFE / OAuth and multiple identity mechanisms; the 28-bit AID serves as an optional identity scheme, carried via the `aid` extension field |
| **Full Lifecycle Identity Management** (GB/Z 185.3) — Registration → Authentication → Classification → Modification → Freezing → Deregistration | ✅ Agent Identity supports versioning and state flags; Guardian Agent can enforce identity policies |
| **Audit Log Retention ≥36 months** (GB/Z 185.3) | ✅ Audit records (§3.8) include complete timestamps; Snapshot (§2.2) supports compliant archival policies |
| **ACDL Capability Description Language** (GB/Z 185.4) — JSON Schema format; mandatory annotation of functions, I/O, permissions, dependencies, and environment constraints | ✅ Entity definitions (§3.1) + Agent BOM (§4.2) are semantically equivalent; supports output as ACDL JSON Schema |

#### 7.4.2 Interaction and Collaboration

| National Standard Requirement | ERDL Coverage |
|------------------------------|:---:|
| **Agent Discovery** (GB/Z 185.5) — Synchronous query + asynchronous publish/subscribe; local LAN centerless discovery | ✅ Discovery is an L8 communication layer responsibility (§1.1) — implemented by A2A / registry services; ERDL declares rule availability in the Agent Card extension |
| **gRPC+Protobuf Interaction Protocol** (GB/Z 185.6) — Synchronous calls + asynchronous event push + long-session context propagation | ✅ ERDL is transport-protocol-independent (§8); the rule engine interfaces with any transport protocol via a framework adaptation layer |
| **Traceable AID Chain** (GB/Z 185.6) — Every message carries the complete collaboration chain | ✅ Cross-Agent audit chain (§3.8) achieves equivalent traceability via `parent_audit_id`; `trace_chain` maps to audit record chain |

#### 7.4.3 Tool Invocation Security

| National Standard Requirement | ERDL Coverage |
|------------------------------|:---:|
| **Tool Registration** (GB/Z 185.7) — All available tools MUST be registered before going live | ✅ Agent BOM (§4.2) declares tool manifest including name, version, and SHA-256 checksum |
| **Parameter Validation** (GB/Z 185.7) — Parameters MUST be validated for legality before invocation | ✅ Guard rules (§3.6) intercept and validate parameters before Tool Call execution; SafeExpr (§6.1) ensures zero-injection validation logic |
| **Permission Interception** (GB/Z 185.7) — Unregistered tools MUST be directly blocked | ✅ DENY + EMERGENCY_HALT (§3.4) provide protocol-level rejection |
| **Invocation Logging** (GB/Z 185.7) — Every invocation MUST be logged | ✅ Audit records (§3.8) generate structured logs for each rule trigger |
| **Exception Circuit-Breaking** (GB/Z 185.7) — MUST circuit-break on exceptions | ✅ QUARANTINE (§3.4) + Guardian Agent (§3.7) provide isolation and circuit-breaking mechanisms |

#### 7.4.4 Complementary Relationship between ERDL and GB/Z 185

GB/Z 185 defines the **infrastructure specification** for Agent interconnection (identity, communication, discovery, tool invocation). ERDL builds on top of this to provide the **semantic rule layer** not covered by GB/Z 185:

| Capability | GB/Z 185 | ERDL |
|------------|:---:|:---:|
| Identity | ✅ 28-bit AID | ✅ Multi-identity mechanisms + AID compatibility |
| Communication Protocol | ✅ gRPC+Protobuf | Transport-agnostic; adapts to any protocol |
| Capability Description | ✅ ACDL JSON Schema | ✅ Executable when/then rules |
| Tool Security | ✅ Five-tier security mechanisms | ✅ Execution Rings four-tier hierarchical control |
| Decision Rules | — | ✅ 13 operators + Guard + override hard constraints |
| Decision Auditing | ✅ trace_chain tracing | ✅ Structured audit records (why this decision was made) |
| Human Oversight | — | ✅ REQUEST_HUMAN + ESCALATE |
| Rule Governance | — | ✅ Proposal Engine + Snapshot/Rollback |

The relationship between ERDL and GB/Z 185 is one of **compliance alignment and supplementation**: GB/Z 185 defines "how Agents connect," while ERDL defines "what rules Agents should follow." Together, they form a complete Agent interoperability infrastructure — MCP handles tool connections, A2A handles Agent communication, GB/Z 185 handles interconnection specifications, and ERDL handles behavioral rules.

---

### 7.5 CAICT "Trusted AI Agent Assessment Framework 2.0"

The China Academy of Information and Communications Technology (CAICT) published the "Trusted AI Agent Assessment Framework 2.0" on April 15, 2026, establishing a full-lifecycle, multi-level, quantifiable comprehensive evaluation framework for enterprise-grade Agents. The assessment framework covers **eight dimensions**, providing standardized support for technology selection, project acceptance, industry regulation, and scaled deployment.

#### 7.5.1 Eight-Dimension Mapping

| Assessment Dimension | CAICT Focus | ERDL Coverage |
|---------------------|-------------|:---:|
| Infrastructure | Runtime environment, hardware adaptation, heterogeneous compatibility, elastic scaling | Not applicable — infrastructure is provided by the deployment platform |
| Data Resources | Data development, data engineering, DataOps | ✅ Entity definitions (§3.1) provide type-safe data semantic modeling |
| **Core Components** | **Collaboration protocols, RAG, Skills, orchestration** | ✅ ERDL core strength — Guard rule collaboration protocol + fn Skills registration + chain/combine orchestration |
| Platform Support | Development, testing, operations, optimization full-lifecycle toolchain | ✅ Hot Reload + Parse/Lint + Snapshot/Rollback + Proposal Engine |
| **Key Capabilities** | **Perception, decision-making, generation, interaction, multi-Agent collaboration** | ✅ Decision-making (when/then) + Generation (Entity instantiation) + Interaction (rule output) + Multi-Agent (Guardian/Observed model) |
| Typical Applications | Personal, enterprise, industry (finance, manufacturing, education) application cases | ✅ §5.1 complete rule template covers tool interception, security auditing, rate limiting, and other workloads |
| Operations Management | Operations policies and capabilities | ✅ Audit logs (§3.8) + Snapshot rollback (§2.2) + Proposal Engine rule governance |
| Value Assessment | Business value, service quality, application effectiveness, application maturity | ✅ Full-chain verification across four experiments + open-source ERP rule coverage empirical evidence (51–68%) |

#### 7.5.2 Core Components Dimension Deep Alignment

CAICT explicitly lists "collaboration protocols, RAG, Skills, and orchestration" as key evaluation items under Core Components. ERDL's corresponding mechanisms in this dimension:

| CAICT Sub-Item | ERDL Mechanism | Description |
|----------------|----------------|-------------|
| Collaboration Protocols | A2A Agent Card extension (§5.2) + Entity semantic contract (§3.1) | `.erdl.yaml` as a multi-party shared rule protocol; humans · LLMs · Agents · systems · auditors share the same semantic contract |
| Skills | when/then rule templates + condition matching mechanisms (§3.2/§3.3) | Operator selection in rule templates, `unless` exemptions, `override` hard constraints, `within` time windows, and other mechanisms naturally map to the Skills dimension |
| Orchestration | when/then orchestration logic + Guardian/Observed Agent role orchestration | Rule priority ordering (§3.2) + Execution Ring scheduling (§3.5) + multi-Agent rule partitioning (§11.2) |

---

### 7.6 ISO/IEC 42001:2023 — AI Management System

ISO/IEC 42001 is the world's first international standard for AI Management Systems (AIMS), adopting the Plan-Do-Check-Act (PDCA) cycle and sharing the Annex SL high-level structure with ISO 9001 / 27001 / 14001, enabling direct integration into existing enterprise management systems.

| 42001 Requirement | ERDL Mapping |
|-------------------|-------------|
| **A.5.2 AI Policy** — Organizations must establish an AI policy aligned with strategy | `policies[]` (versioned YAML rule files) → executable form of enterprise AI governance policy |
| **A.7.5 Documented Information** — Management system documents must be controlled (creation, update, distribution, retention, disposal) | `proposal_id` + Snapshot Manager → rule changes have a complete proposal→approval→version→rollback lifecycle |
| **A.9.1 Monitoring, Measurement, Analysis, and Evaluation** — Organizations must evaluate AI system performance and effectiveness | `matched_rules[]` (every decision traceable to policy, context, and outcome) + `total_evaluated` / `total_matched` |
| **A.9.2 Internal Audit** — Conduct internal audits at planned intervals | `audit.hash` + `audit.previous_hash` (tamper-evident audit chain) + structured audit logs (§3.8) |
| **A.9.3 Management Review** — Top management periodically reviews the AIMS | `result.severity` + `result.action_taken` (provides management-visible risk treatment evidence) |
| **A.10.1 Continual Improvement** — Nonconformities and corrective actions | CORRECT + Rollback mechanisms → automated correction + rule iteration closed loop |

ERDL automates the 42001 PDCA cycle by translating AI policy into executable when/then rules: **Plan** (rule proposals) → **Do** (rule engine execution) → **Check** (audit log verification) → **Act** (correction and rollback).

### 7.7 IEEE P3395 — Recommended Practice for Agentic AI Practices

IEEE P3395 is an IEEE standard under development providing industry guidance for the design, deployment, and governance of AI Agents. The standard is currently in its early stages, but ERDL has already aligned with it in the following key directions:

| P3395 Direction (Expected) | ERDL Pre-Alignment |
|----------------------------|--------------------|
| Traceability of Agent behavior | `decision_id` (UUID v7) + `audit.chain` (tamper-evident) |
| Accountability for decisions | `agent.role` (guardian/operator/observed) + `agent.id` |
| Boundary definition for multi-Agent collaboration | Guardian/Observed model + Execution Rings hierarchical governance |
| Risk-based Agent tiered control | `result.severity` (none/low/medium/high/critical) + Execution Rings (Ring 0–3) |

After P3395 is formally published, ERDL will update this section to reflect the specific requirements of the final standard.

---

## 8. Protocol Interoperability

### 8.1 Relationship with MCP

ERDL can be exposed as an MCP Tool. Agents invoke ERDL via the MCP protocol for rule validation.

**Proxy Mode** (recommended): Point the MCP endpoint of dangerous Tools to an ERDL proxy, which validates and then forwards to the actual Tool implementation. Agents cannot bypass it — they cannot reach the original Tool. This is the most reliable way to implement deterministic Guard.

### 8.2 Relationship with A2A

ERDL extends A2A's Agent Card (`extensions.erdl` field). In A2A Task delegation:

1. Pre-delegation: Agent A validates via ERDL whether the delegation is compliant
2. Post-delegation: Agent B validates via ERDL whether it has permission to execute
3. Post-completion: Agent A validates via ERDL whether the result is trustworthy

### 8.3 Relationship with OpenTelemetry

ERDL audit records are output as OTLP Spans. Each rule trigger generates one Span. Cross-Agent audit chains are mapped via `parent_audit_id` → OTLP `parentSpanId`.

### 8.4 Relationship with OCSF

Audit logs support export to OCSF (Open Cybersecurity Schema Framework) format, compatible with SIEM systems.

---

## 9. Version Compatibility

### 9.1 Protocol Version

Declared via the `protocol` field: `"erdl/v1"`. The engine MUST validate the protocol version when loading rule files. Unsupported versions MUST be rejected with a clear error message.

### 9.2 Rule File Version

Uses SemVer via the `version` field. Defaults to `"0.0.0"` if not declared.

### 9.3 Backward Compatibility

- v1 engines MUST support v1 rule files
- All v1.1 new constraints (`message` enforcement, rule naming conventions, `unless` exemptions, quality gates) are Non-breaking for existing v1.0 rule files
- When loading v1.0 rules, rules that do not comply with v1.1 new constraints SHALL trigger Warnings (not Errors); rules are still loaded and evaluated normally
- Exception: `when: 'true'` + blocking `then` (§3.2.1) is rejected at load time (MUST Error) in all versions
- New operators do not break existing rules
- Deprecated operators SHALL be documented and retained for at least one major version's compatibility period

---

## 10. Reference Implementation

The open-source ERDL engine is available at @openoba/erdl-engine-js (TypeScript), covering all 21 implemented SPEC v1.1 capabilities. npm install and ready to use.

**Capability Matrix**:

| Feature | v1.1 Spec | Reference Implementation (rulsynor) |
|---------|:---:|:---:|
| YAML parsing + Zod validation | ✅ | ✅ |
| 13 operators + AND/OR nesting | ✅ | ✅ |
| SafeExpr expression engine | ✅ | ✅ |
| Action Guard (protocol-level interception) | ✅ | ✅ |
| Hot Reload | ✅ | ✅ |
| Audit logging (RuleRecord) | ✅ | ✅ |
| Execution Rings | ✅ | ✅ |
| EMERGENCY_HALT | ✅ | ✅ |
| `unless` exemption mechanism | ✅ | ✅ |
| Rule quality gates (11 items) | ✅ | ✅ |
| Decision Object output (JCS+SHA-256) | ✅ | ✅ |
| `within` time window | ✅ | ✅ |
| `rate` rate limiting | ✅ | ✅ |
| OpSem operational semantic classification | ✅ | ✅ |
| MCP Tool proxy mode | ✅ | ✅ |
| Null propagation (three-valued logic) | ✅ | ✅ |
| Strict type matching | ✅ | ✅ |
| Resource quotas (depth/nodes/input) | ✅ | ✅ |
| ReDoS protection | ✅ | ✅ |
| Dynamic vector engine (26 items) | ✅ | ✅ |
| Snapshot + Rollback | ✅ | 🚧 Not implemented |
| Proposal Engine (rule governance) | ✅ | 🚧 Not implemented |
| Agent Identity | ✅ | 🚧 Not implemented |
| Trust Scoring | ✅ | 🚧 Not implemented |
| Agent BOM | ✅ | 🚧 Not implemented |
| Observable / Guardian model | ✅ | 🚧 Not implemented |
| A2A Agent Card extension | ✅ | 🚧 Not implemented |
| OpenTelemetry integration | ✅ | 🚧 Not implemented |
| Registry conflict/shadowing/redundancy detection | ✅ | 🚧 Not implemented |
| GB/Z 185 national standard AID identity code | ✅ | 🚧 Not implemented |
| GB/Z 185 ACDL capability description output | ✅ | 🚧 Not implemented |
| Audit log ≥36-month retention | ✅ | 🚧 Not implemented |
| Tool whitelist registry (GB/Z 185.7) | ✅ | 🚧 Not implemented |

---

### Toolchain Roadmap (New in v1.1)

ERDL's naming conventions (§3.2.4) and quality gates (§11.5) define strict static constraints. Runtime-only checks or CI/CD integration can only achieve "after-the-fact discovery." To improve developer experience, the community is encouraged to advance the following toolchain:

| Tool | Description | Priority |
|------|-------------|:---:|
| **VS Code Extension** | Real-time quality gate results (red/yellow lines) while editing `*.erdl.yaml`, similar to ESLint experience | 🟡 P1 |
| **Language Server Protocol (LSP)** | ERDL language services for any LSP-compatible editor (Vim/Emacs/JetBrains) | 🟡 P1 |
| **ERDL CLI `lint`** | Standalone CLI tool outputting JSON/SARIF format gate results, integrable into CI/CD pipelines | 🟡 P1 |
| **Playground / Sandbox** | Online ERDL rule editing + instant evaluation simulation + vector set verification, lowering the learning curve | 🟢 P2 |

> The above toolchain does not constitute mandatory specification requirements; it is advanced by the community as needed. The reference implementation team welcomes community contributions.

---

## 11. Rule Governance

ERDL not only defines how rules are written, but also defines how rules interact with each other. Rule governance is the responsibility of the L9 protocol layer — not implemented by application layers, not delegated to Agents, and not manually maintained by users. The engine automatically performs the following governance checks when loading rules.

### 11.1 Rule Count Guidelines

ERDL engine deterministic evaluation maintains <20ms P99 latency within 10,000 rules (measured in Node.js v22 environment).

Rule file limits are not determined by engine performance, but by the following auditable constraints:

- **Human review capacity**: 200 rules (~3,000 lines of YAML) is the upper bound coverable by a single Code Review. Beyond 200 rules, humans cannot trace all rule interaction effects in a single review.
- **LLM audit capacity**: Current mainstream LLMs (DeepSeek/Qwen/GPT-4o) provide a 128K tokens context window, which is the minimum implementation condition for standard specification reference. 200 rules occupy approximately 22% of the window (~28KB), leaving 78% space for task context. If the implementation environment uses larger windows (such as Gemini 2.5 Pro's 1M tokens or growing context), the upper limit can be appropriately raised after deployer evaluation.

| Condition | Recommended Per-File Limit | Basis |
|-----------|:--:|-------|
| Minimum implementation condition (128K context + human review) | **200 rules** | Coverable by human Code Review + ample LLM audit window |
| Sufficient implementation condition (≥1M context + automated audit toolchain) | Deployer-determined | Can exceed 200 rules with sharded auditing and automated conflict detection |
| Theoretical limit | 10,000 rules | Engine performance guarantee (<20ms P99), but auditability no longer guaranteed |

**Statements**:
- **Recommended per-file limit: 200 rules**. Beyond 200, the engine emits an info-level notification, suggesting rule file splitting or use of decision tables.
- **Recommended per-Agent limit: 1,000 rules (up to 5 files)**. Beyond 1,000, the engine emits a warning, suggesting adding Agents to share rule responsibilities.
- **No hard upper limit**. The engine does not prevent loading rule files exceeding the recommended limits; this is left to deployer discretion.
- **Core principle: Beyond 1,000 rules → add Agents, not rules.** Each Agent maintains its own rule files independently, coordinating cross-Agent rule interactions through a Guardian Agent (§3.7).

### 11.2 Multi-Agent Rule Partitioning

When a single Agent's rules exceed 1,000, do not add rules — add Agents. Each Agent manages a rule file for its own responsibility domain:

```
Agent-A (OrderValidator)     → order_rules.yaml     (180 rules)
Agent-B (PaymentGuard)       → payment_rules.yaml    (150 rules)
Agent-C (ComplianceAuditor)  → compliance_rules.yaml ( 80 rules)
Agent-D (LogisticsRouter)    → logistics_rules.yaml  (120 rules)
                              ─────────────────────
                              Total 530 rules, 4 Agents
```

Each Agent only evaluates its own rule files; cross-Agent merged evaluation does not occur. Agents pass decision results through task chains rather than sharing a global rule table.

If rules from two Agents conflict (e.g., Agent-A requires CORRECT, Agent-B requires DENY), the conflict is collected by a Guardian Agent (§3.7) via aggregated conflict audit records, triggering REQUEST_HUMAN for human adjudication. **No independent Rule MAIN Agent is introduced** — conflict adjudication is a governance issue, not a scheduling issue. Scheduling logic (priority, first match, override) is already handled by the ERDL Engine's evaluation mechanism.

### 11.3 Registry Global View

ERDL Registry (§3.1) provides a global view during rule loading but does not participate in runtime decision-making:

| Detection Item | Trigger Condition | Behavior |
|----------------|-------------------|----------|
| **Conflict Detection** | Two rules' condition domains overlap (intersection ≠ ∅) AND then results differ | ⚠️ warning: logged to load audit, resolved by priority |
| **Shadowing Detection** | Rule B's condition domain is fully contained by Rule A's (B ⊆ A) AND A's priority ≥ B | ⚠️ warning: B will never trigger |
| **Redundancy Detection** | Two rules' condition domains are identical (A = B) AND then results are the same | ℹ️ info: suggests merging |
| **Per-File Limit Warning** | Rule file exceeds 200 rules | ℹ️ info: suggests splitting file |
| **Total Limit Warning** | Single Agent registers over 1,000 rules | ⚠️ warning: suggests adding Agents |

All detection results are written to the rule load audit log (`RuleLoadAudit`), human-readable and Agent-parseable.

### 11.4 Rule Execution Priority

ERDL Engine processes rules in the following order:

1. All rules are sorted by `priority` ascending (lower number = higher priority)
2. Each rule's `when` conditions are evaluated in order
3. The first rule whose conditions all match determines the final action (`then`)
4. If no rule matches, the default action is `ALLOW` (allow by default)
5. Rules marked `override: critical` or `override: high` can override previously matched results (only in the `DENY` → `ALLOW` direction; overriding to a less safe state is not permitted). `normal` and `low` levels do not enable override behavior.

**Note**: Step 3 means a high-priority DENY rule prevents evaluation of subsequent rules. If a high-priority rule marks all requests as DENY, subsequent rules are not executed. This is consistent with AWS IAM's deny-by-default and iptables' first-match policy.

---

### 🆕 §11.5 Rule Quality Gates

> Source: erdl-spec-v1.1-draft.md · 2026-07-21 · New in v1.1

##### Background

Rules are the core assets of an ERDL system. Bad rules can be more dangerous than no rules. The engine MUST perform quality gate checks when loading rules, automatically detecting and reporting potential issues. This complements §11.3 Registry Global View — Registry detects inter-rule interaction issues (conflicts, shadowing, redundancy), while quality gates detect per-rule quality issues.

##### Specification

| Gate | Level | Trigger Condition | Behavior |
|------|-------|-------------------|----------|
| `wild-when-with-blocking-then` | error | `when: 'true'` and `then: DENY/CORRECT/EMERGENCY_HALT/REQUEST_HUMAN` | Reject loading |
| `no-condition-on-security-rule` | error | category=security and conditions are empty (no conditions specified) | Reject loading |
| `empty-message-on-blocking-rule` | warning | `then: DENY/CORRECT/REQUEST_HUMAN/EMERGENCY_HALT` and message is empty | Log warning |
| `non-standard-name` | warning | Rule name does not follow `[CAT]-[NNN]-description` format (detects overall naming convention violation, not just disabled prefixes) | Log warning |
| `no-tool-constraint` | warning | coding/security rules (by category) do not specify `tool.name` condition | Log warning |
| `no-path-constraint` | warning | Rules involving write_file/edit/apply_patch do not specify `tool.args.path` condition | Log warning |
| `guard-with-unless` | error | Guard rule (`guard: true`) contains `unless` field | Reject loading |
| `unless-with-temporal` | error | `unless` conditions contain `within` or `rate` constraints | Reject loading |
| `no-unless-for-broad-rule` | info | Rule matches ≥3 tools and has no `unless` field | Log info |
| `regex-redos-risk` | error | Regex in when/unless conditions (`match` operator) presents catastrophic backtracking risk (e.g., nested quantifiers `(a+)+`, overlapping branches `(a|a)+`) | Reject loading |
| `ast-complexity-exceeded` | error | Condition expressions exceed §6.1 resource quota limits (depth>64, nodes>256, length>4KB) | Reject loading |

##### Gate Level Semantics

| Level | Description |
|-------|-------------|
| error | Rule does not meet SPEC mandatory requirements; engine rejects loading |
| warning | Rule has potential issues; engine loads but logs warning |
| info | Rule can be optimized; engine loads and logs hint |

##### Design Rationale

Quality gates are the final defense of ERDL's deterministic architecture. They do not replace human review, but ensure rules meet the minimum quality standard defined by the SPEC before entering the runtime engine. This serves the same role as a type checker in programming languages — not replacing code review, but ensuring code will not crash at runtime.

---

## 12. Decision Object (Audit Subset)

> Source: decision-object-v1.0.md · Version 1.0.0 · Frozen 2026-07-15 · First published 2026-07-07
>
> This section fully integrates the Decision Object v1.0 specification as the audit subset of ERDL SPEC v1.1.
> Decision Object v1.0 is frozen; any subsequent revisions must go through the Spec Change Proposal (SCP) process with an updated audit vector set.

### 12.0 Motivation: Why Enterprise Needs a Decision Object Standard

#### 12.0.1 Regulatory Pressure

In 2026, AI Agents have entered **highly regulated domains** — finance, healthcare, hiring, insurance, critical infrastructure. Global regulators are closing the "black-box decision" window:

| Regulatory Framework | Key Requirement | Enterprise Liability |
|----------------------|-----------------|----------------------|
| **EU AI Act** (effective 2026-08-02) | Article 12: Each high-risk decision must be automatically logged (decision + outcome + risk scenario + monitoring data). Article 14: Human oversight must be an **external constraint**; system prompts are not compliant. | €35M / 7% global revenue |
| **China GB/Z 185-2026** | 28-bit Agent Identity Code (AID), five tool call security mechanisms, data flow permission audit, decision traceability | Generative AI service compliance framework + algorithm filing obligation |
| **US COSO 2026** | GenAI internal controls must capture complete audit trail: prompt, input, output, model version, config version, human review evidence | PCAOB AS 2201 compliance + SOX internal controls |
| **NIST AI RMF 1.0** | Map / Measure / Manage / Govern four-function governance framework | Voluntary, but affects US federal procurement eligibility |
| **OWASP Top 10 for Agentic 2026** | 10 Agentic risks: Prompt Injection, Tool Manipulation, Supply Chain, Autonomy Abuse, etc.; each requires technical controls | Industry best practice (affects insurance/auditing) |
| **IEEE P3395** (in development) | Recommended Practice for Agentic AI Practices | Future compliance expectation |
| **ISO/IEC 42001:2023** | AI Management System (AIMS) — Plan-Do-Check-Act cycle, internal audit, management review | Certification requirement (affects government procurement) |
| **CAICT Eight Dimensions** (2026-04-15) | Enterprise-grade AI Agent full-chain assessment: Core Components / Key Capabilities / Platform Support / Operations Management | Chinese government/enterprise procurement qualification |
| **Colorado SB 205** (effective 2026-06-30) | AI decisions must be explainable; consumers have right to appeal | $20,000 / violation |
| **Singapore Agentic AI Governance Framework** (2026-01-22) | World's first dedicated Agent AI governance framework: bound risks, human accountability, technical controls, user responsibility | Voluntary, but enterprises bear ultimate legal responsibility |

#### 12.0.2 Enterprise Pain Points

Enterprise compliance teams face a common technical barrier: **different vendors' Agents output decisions in different formats.** Auditors receive Prompt logs + conversation screenshots, not structured, verifiable decision records.

Take financial services as an example — COSO 2026 explicitly requires that AI audit trails must demonstrate "control functioned as designed." A conversation screenshot cannot meet this requirement.

ERDL Decision Object solves this: a **machine-readable, cross-implementation verifiable, tamper-evident** standard output format for Agent decisions.

#### 12.0.3 Cross-Implementation Neutrality

The neutrality of an open standard is **not declared — it is verified through independent implementation.** This specification's design principle:

> **Given the same rule set and context, any compliant ERDL implementation must produce byte-for-byte identical Decision Objects.**

Three independent implementations, one specification, one vector set, no single controller — this is the classic path to decentralized infrastructure (see RFC 2026, IETF standards process).

---

### 12.1 Scope and Audience

#### 12.1.1 This Standard Is For

| Audience | Role | Primary Concern |
|----------|------|-----------------|
| **Enterprise Compliance Teams** | Auditing Agent decisions, meeting regulatory requirements | "Can this decision be submitted as evidence to regulators?" |
| **Agent Platform Developers** | Implementing ERDL-compatible rule engines | "Can my engine output pass cross-implementation verification?" |
| **RegTech Vendors** | Building AI audit products | "Can I automatically parse any ERDL Agent's decisions using this format?" |
| **Standards Organizations** | Assessing protocol neutrality | "Do independent implementations exist? Can the vector set be reproduced?" |

#### 12.1.2 This Standard Is Not For

- ❌ Individual developers' daily use (see MCP Server Free tier)
- ❌ Best practices recommendations for Agent behavior
- ❌ LLM model evaluation or benchmarking

---

### 12.2 Specification

#### 12.2.1 Decision Object Format

Each Agent decision outputs the following JSON structure:

```json
{
  "spec": "decision-object-v1.0",
  "decision_id": "018c4a3e-...",
  "timestamp": "2026-07-07T08:30:00.000Z",
  "agent": {
    "id": "agent-001",
    "role": "operator",
    "version": "v1.5.0"
  },
  "context": {
    "tool.name": "exec",
    "tool.args": { "command": "ls" }
  },
  "policies": [
    {
      "id": "SEC-001",
      "name": "block_exec_tool",
      "version": 1,
      "hash": "sha256:abc123..."
    }
  ],
  "evaluation": {
    "proposal_id": null,
    "matched_rules": [],
    "total_evaluated": 0,
    "total_matched": 0
  },
  "result": {
    "decision": "PASS",
    "severity": "none",
    "reason": "no rules matched",
    "action_taken": "allowed"
  },
  "audit": {
    "hash": "sha256:...",
    "previous_hash": null,
    "commitment": "2026-07-07T08:30:00.000Z|agent-001|exec|PASS"
  }
}
```

#### 12.2.2 Field Definitions

##### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `spec` | string | ✅ | Fixed value `"decision-object-v1.0"` |
| `decision_id` | string | ✅ | UUID v7 (time-ordered, recommended), globally unique. Implementations may fall back to UUID v4 for compatibility. |
| `timestamp` | string | ✅ | ISO 8601 UTC, NTP-synchronized |
| `agent` | object | ✅ | Identity of the decision-making Agent |
| `context` | object | ✅ | Context that triggered this decision |
| `policies` | array | ✅ | Active policy set in this evaluation |
| `evaluation` | object | ✅ | Detailed results of rule evaluation |
| `result` | object | ✅ | Final decision |
| `audit` | object | ✅ | Tamper-evident audit evidence |

##### agent Fields

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `agent.id` | string | ✅ | Agent unique identifier (recommended: GB/Z 185 AID or DID:ERDL format) |
| `agent.role` | string | ✅ | `guardian` / `operator` / `observed` |
| `agent.version` | string | ✅ | Agent software version number |

##### policies Fields

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `policies[].id` | string | ✅ | Policy unique identifier |
| `policies[].name` | string | ✅ | Human-readable name |
| `policies[].version` | number | ✅ | Policy version number (for audit traceability) |
| `policies[].hash` | string | ✅ | SHA-256 hash of complete policy content |

##### evaluation Fields

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `evaluation.proposal_id` | string | — | Rule proposal ID (if changed via approval workflow), null when no proposal |
| `evaluation.matched_rules` | array | ✅ | List of matched rules |
| `evaluation.matched_rules[].rule_id` | string | ✅ | Rule ID |
| `evaluation.matched_rules[].decision` | string | ✅ | Decision from this rule |
| `evaluation.matched_rules[].reason` | string | — | Reason/explanation |
| `evaluation.matched_rules[].instruction` | string | — | Advisory instruction (when ALLOW) |
| `evaluation.matched_rules[].correction` | string | — | Correction content (when CORRECT) |
| `evaluation.matched_rules[].ring` | number | — | Execution Ring level |
| `evaluation.total_evaluated` | number | ✅ | Total rules evaluated (excluding disabled) |
| `evaluation.total_matched` | number | ✅ | Total rules matched |

##### result Fields

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `result.decision` | string | ✅ | Decision type (see §12.3) |
| `result.severity` | string | ✅ | `none` / `low` / `medium` / `high` / `critical` |
| `result.reason` | string | ✅ | Human-readable decision explanation (descriptive for PASS) |
| `result.action_taken` | string | ✅ | Actual action taken: `allowed` / `blocked` / `corrected` / `paused` / `halted` / `rolled_back` / `quarantined` / `escalated` |

##### audit Fields

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `audit.hash` | string | ✅ | SHA-256 hash of the full record. Computation MUST first serialize the record per JCS (RFC 8785), remove the `hash` field, then compute SHA-256 (MUST use SHA-256 algorithm defined in FIPS 180-4). |
| `audit.previous_hash` | string | — | Hash of previous audit record (forming chain), null for first record |
| `audit.commitment` | string | ✅ | Tamper-evident commitment string: `timestamp\|agent_id\|tool_name\|decision` |

---

### 12.3 Decision Types and Severity

> **Note**: The following 10 decision types are the **external compliance subset** of the ERDL complete action set (§3.4) (v1.0 frozen version). `DELEGATE` is temporarily mapped via `ESCALATE` into Decision Object; `STRATEGIZE`, `AUDIT`, `CALCULATE`, `VALIDATE` are Agent-internal reasoning actions and do not enter cross-system Decision Object. The next version of Decision Object will formally include `DELEGATE` as an independent decision type.

| Decision | Severity | Meaning | Agent Behavior | Tier |
|----------|:--------:|---------|----------------|:----:|
| `PASS` | none | No rules matched | Proceed normally | Free |
| `ALLOW` | none | Allow with recommendation | Proceed normally, follow recommendation | Free |
| `CORRECT` | medium | Auto-correct | Continue with corrected parameters | Free |
| `REQUEST_HUMAN` | medium | Pause for approval | Operation suspended, awaiting human confirmation | Free |
| `ESCALATE` | medium | Escalate to higher-level reviewer | Operation suspended, escalated to designated reviewer | Pro |
| `NOTIFY` | low | Issue compliance notification | Continue execution but log notification | Pro |
| `DENY` | high | Hard block | Operation blocked; must be modified | Free / Pro |
| `ROLLBACK` | high | Roll back executed operations | Undo operations, restore prior state | Pro |
| `QUARANTINE` | critical | Isolate Agent | Block all subsequent operations until audit complete | Pro |
| `EMERGENCY_HALT` | critical | Global emergency halt | Immediately stop all supervised Agents | Enterprise |

> **Note**: Ring 1/2 implementations of `ROLLBACK`, `QUARANTINE`, and `ESCALATE` are Pro features. The Free tier (Ring 3) supports `ALLOW`, `CORRECT`, `NOTIFY`, `DENY`, `REQUEST_HUMAN`. `EMERGENCY_HALT` is only available in Enterprise Ring 0. `BLOCK` is equivalent to `DENY` in this specification — both carry the same semantics, and `DENY` is the unified term.
>
> **DELEGATE → ESCALATE Mapping** (v1.1 transition plan): When a rule triggers `DELEGATE`, Decision Object's `result.decision` field uses `ESCALATE`, `result.reason` carries the original DELEGATE information (format: `DELEGATE to <agent_name> — <original_reason>`), and `evaluation.matched_rules[].decision` retains the original `DELEGATE` value. v1.2 plans to include `DELEGATE` as an independent decision type in Decision Object.

---

### 12.4 Audit Chain

Decision Object supports a **tamper-evident audit chain**; each record links to the previous record via `audit.previous_hash`:

```
[Record N-1]  →  [Record N]  →  [Record N+1]
  hash: abc       hash: def       hash: ghi
                  prev: abc       prev: def
```

Any tampering with a record breaks the hash consistency of the entire chain. Auditors need only verify the latest `audit.hash` to confirm the integrity of the entire chain.

---

### 12.5 Data Retention

| Regulation | Minimum Retention | Scope |
|------------|:-----------------:|-------|
| EU AI Act Article 12 | 6 months (high-risk systems) | All decision records |
| COSO / SOX | 7 years (audit workpapers); 366 days (operational logs) | Financial AI decisions |
| HIPAA | 6 years | PHI-related decisions in healthcare |
| PCI DSS v4.0 | 12 months (3 months online) | Payment card data decisions |
| GB/Z 185-2026 | Per Data Security Law Article 33: ≥6 months | AI decisions by significant data processors |
| CC-CSIRT General Recommendation | 12–24 months | Security event traceability |

Compliant implementations SHOULD declare their supported data retention policy in documentation. The specific retention period depends on the deploying organization's industry regulations — the standard itself **does not specify a minimum retention period**, but requires that `audit.hash` and `audit.previous_hash` remain verifiable throughout the retention period.

---

### 12.6 Compliance Alignment (Field-Level Mapping)

Field-level alignment between Decision Object and 9 major regulatory frameworks is detailed in Decision Object v1.0 §3. Key mapping summary:

| Framework | Core Requirement | Decision Object Mapping |
|-----------|------------------|-------------------------|
| EU AI Act Art.12/13/14 | Record-keeping, transparency, human oversight | `decision_id` + `result.reason` + `REQUEST_HUMAN`/`ESCALATE` |
| GB/Z 185 | AID identity code, five tool security mechanisms, decision traceability | `agent.id` + `matched_rules[]` + `audit.previous_hash` |
| COSO 2026 | Complete audit trail, controls function as designed | `decision_id` + `policies[]` + `matched_rules[]` |
| NIST AI RMF | Govern/Map/Measure/Manage | `agent.role` + `context` + `evaluation` + `result` |
| ISO/IEC 42001 | PDCA cycle, internal audit | `policies[].version` + `audit.hash` + `result.severity` |
| OWASP Top 10 | Per-risk controls | `matched_rules[]` mapped to each OWASP number |

---

### 12.7 Cross-Implementation Verification

#### 12.7.1 Principle

The neutrality of this standard is proven through independent verification:

1. Any implementer can write an ERDL-compatible decision engine per this specification
2. All implementations must be able to reproduce all test vectors in the vector set
3. Verification results are submitted to a neutral repository not controlled by a single entity (e.g., A2A #2038)

#### 12.7.2 Vector Set

Vector set file: `decision-object-vectors-v1.0.json` (published with this specification, path: `erdl-landing/spec/vectors/decision-object-vectors-v1.0.json`). v1.1 consolidated vector set: `decision-object-vectors-v1.1.json` (path: `erdl-landing/spec/vectors/decision-object-vectors-v1.1.json`, 37 decision + 7 audit = 44 vectors).

Contains two categories of cross-implementation test vectors:

**A. Decision Engine Vectors (37)** — Verify ERDL rule engine decision logic. Covers:
- Security baselines, compliance workflows, dangerous command interception, critical infrastructure protection
- Policy versioning, empty policy sets, override semantics, Execution Ring short-circuit, severity escalation
- All 13 operators, multi-Agent trust models, Guard rules, metadata.decision priority, not_contains/not_in/gte/lte/within operators

**B. Audit Hash Vectors (7)** — Verify JCS (RFC 8785) canonicalization + SHA-256 hash consistency:

| Audit Vector | Source | Decision Type | Ring | Characteristic |
|:---|:---|:---|:---:|------|
| AV-001 | DO-001 | DENY | 0 | Single security rule + high severity |
| AV-002 | DO-003 | REQUEST_HUMAN | 1 | PHI context + medium severity |
| AV-003 | DO-010 | ALLOW | 0+3 | Dual-rule override (instruction field) |
| AV-004 | DO-013 | EMERGENCY_HALT | 0 | HALT short-circuit + critical severity |
| AV-005 | DO-022 | ESCALATE | 1 | Multi-Agent trust + escalated action |
| AV-006 | DO-026 | ALLOW | 3 | `unless` exemption + null safety (when would crash but unless protects) |
| AV-007 | DO-027 | PASS | 3 | Null propagation: missing field != value → false (no exception) |

Any compliant implementation must reproduce all 37 decision engine vectors and 7 audit hash vectors byte-for-byte.

#### 12.7.3 Verification Process

```
1. Implementer writes an ERDL decision engine (any language)
2. Load vector set → run each vector → compare output
3. L1 Compliant: Pass all 28 v1.0 vectors (23 decision + 5 audit) → declare L1 Basic Compatible
4. L2 Compliant: Pass all 44 v1.1 vectors (37 decision + 7 audit) → declare L2 Verified Compatible
5. Submit verification results as PR to neutral repository (e.g., A2A #2038)
```

---

## 13. Contributing

ERDL is a community-driven open standard. Contributions are welcome via:

- **GitHub Issues** — Submit suggestions, bug reports, use cases
- **GitHub Discussions** — Discuss protocol design, extension proposals
- **Rule Template Contributions** — Submit rule templates for Agent scenarios
- **Adapter Development** — LangGraph / CrewAI / AutoGen / OpenClaw adapters

**Repository**: [github.com/OpenOBA/erdl-landing](https://github.com/OpenOBA/erdl-landing)
**Website**: [openoba.com/erdl](https://openoba.com/erdl)
**License**: MIT

---

## 14. Community Acknowledgments

ERDL v1.0–v1.1 was refined through open community discussions.

- **Erik Newton (Concordia)** — Proposed and validated in A2A Discussion #2031 the core principle that "neutrality is not declared but tested." Concordia, as the second independent runner for ERDL Decision Object, submitted byte-for-byte verification results for all 28 compliance vectors at A2A #2038. The standardization path of "three independent implementations, one open specification, no single owner" laid the methodological foundation for ERDL's evolution from an open-source project to an infrastructure standard.
- **Christopher Hopley (chopmob-cloud / AlgoVoi)** — Made key contributions in A2A Discussion #2031: the compliance substrate model and cross-verification vision ("two L2s targeting the same JCS+SHA-256 discipline"); the essential distinction between reputation (advisory) and compliance evidence (per-decision recomputable records); the content-address receipt model (RFC 8785 JCS canonicalization → SHA-256 frame); and the Agent governance four-layer model (guardrails, action gate, harness, governance) that independently validates ERDL's Action Gate layer implementation.
- **Tang Qixin (唐启鑫, DPO)** — Compliance alignment review (EU AI Act, GB/Z 185, NIST AI RMF, COSO)

Community review is welcome via GitHub Issues and A2A Discussions.

---

## Appendix A: Glossary

| Term | English | Description |
|------|---------|-------------|
| 实体 | Entity | Subject upon which rules operate |
| 规则 | Rule | Behavioral constraint defined by when/then |
| 防线 | Guard | Mandatory rule before Tool Call |
| 执行环 | Execution Ring | Operation tiering borrowed from CPU privilege rings |
| 监管 Agent | Guardian Agent | Agent that performs rule validation |
| 受监管 Agent | Observed Agent | Regular Agent under supervision |
| 代理模式 | Proxy Mode | ERDL proxies dangerous Tool MCP endpoints |
| 审计记录 | Audit Record | Structured record of rule trigger |
| 决策对象 | Decision Object | Standardized decision output format verifiable across systems |
| 组件清单 | AgBOM | Agent Bill of Materials |
| 信任评分 | Trust Score | Dynamic trust level between Agents |
| 质量门禁 | Quality Gate | Automated quality checks at rule load time |

## Appendix B: Cisco L8/L9 Reference

The Cisco Research team proposed a layered architecture for Agent protocols in arXiv:2511.19699:

- **L8 (Agent Communication Layer)** — Standardized message envelopes, Speech-Act Performatives (REQUEST, INFORM, etc.), interaction patterns (request-reply, publish-subscribe)
- **L9 (Agent Semantic Negotiation Layer)** — **"does not exist today"**. Enables Agents to discover, negotiate, and lock down Shared Context.

ERDL's Entity definitions directly implement L9's Shared Context functionality. ERDL's `then` semantics (information-passing actions like DELEGATE) correspond to L8's Speech-Act Performatives.

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
- GB/Z 185-2026, "Artificial Intelligence — Agent Interconnection" Series of National Standards (7 parts), State Administration for Market Regulation / Standardization Administration of China, 2026
- CAICT, "Trusted AI Agent Assessment Framework 2.0", 2026-04-15
- Cyberspace Administration of China / NDRC / MIIT, "Implementation Opinions on Standardized Application and Innovative Development of Agents", 2026-05-08
- IETF, "JSON Canonicalization Scheme (JCS)", RFC 8785, 2020

## Appendix D: v1.0 → v1.1 Change Summary

| v1.0 Issue | v1.1 Resolution |
|------------|-----------------|
| No minimum completeness defined for `when` | §3.2.1 Minimum `when` completeness requirements |
| No rule exception mechanism | §3.2.2 `unless` exemption |
| No mandatory `message` requirement | §3.2.3 Mandatory `message` |
| No naming conventions | §3.2.4 Naming conventions |
| Two decision fields conflict | §3.4.1 Priority definition |
| No rule load quality checks | §11.5 Quality gates |
| Decision Object independent from main SPEC | §12 Audit subset integration |
| Execution Ring assignments inconsistent | §3.5 Calibrated to Decision Object v1.0 |
| `then` action set mixed internal/external | §3.4 Explicitly distinguishes 17 complete actions vs. 13 external compliance subset |
| `when: 'true'` syntax status ambiguous | §3.3 Explicitly defined as `when` top-level shorthand (always semantics), not an operator |
| Guard and `unless` interaction conflict | §3.2.2 Guard rules prohibited from using `unless`; `unless` prohibited from using `within`/`rate` |
| `unless` audit behavior undefined | §3.8 Defines audit record format for `unless` exemptions |
| Naming uniqueness constraint too weak | §3.2.4 Elevated to MUST, added NNN number management notes |
| Quality gate levels mismatched | §11.5 Redefined levels: no-tool-constraint/no-path-constraint → warning; added no-condition-on-security-rule/guard-with-unless/unless-with-temporal; removed decision-field-conflict |
| `message` consumer unclear | §3.2.3 Added consumer notes table + v1.2 splitting recommendation |
| `rate` scope undefined | §3.3 Clarified default scope is single Agent instance |
| SafeExpr null propagation semantics undefined (cross-language behavior inconsistent) | §6.1 Three-valued logic safe-fail + strict type matching |
| SafeExpr resource quotas undefined (AST bloat/ReDoS attack surface) | §6.1 Depth/node/step hard constraints |
| ReDoS static detection not in quality gates | §11.5 Added regex-redos-risk + ast-complexity-exceeded |
| REQUEST_HUMAN Free/Pro tiering inconsistent | §3.5 + §12.3 Unified across three locations: REQUEST_HUMAN = Free |

## Appendix E: v1.2 Planned Goals

The following topics are marked as TODO in v1.1 and planned for resolution in v1.2:

| Topic | Source | Priority |
|-------|--------|:---:|
| `message` field splitting (text / instruction / audit_note) | External review §1.3 | 🟡 P1 |
| Distributed consistency (EMERGENCY_HALT global effectiveness, `within` distributed state storage) | External review §2.1/§3 | 🔴 P0 |
| Hot-reload atomicity and error handling strategy | External review §2.5 | 🟡 P1 |
| JCS+SHA-256 compliance evidence chain into specification body | External review §3 | 🔴 P0 |
| Reference implementation catch-up (Guardian/Observer/Execution Rings etc. 🚧 items) | §10 Capability Matrix | 🔴 P0 |
| DELEGATE formally included in Decision Object | §3.4/§12.3 notation | 🟡 P1 |
| `message` template variable interpolation (`{{amount}}` etc.) | Fourth-party audit §2 | 🟡 P1 |
| Custom quality gate extensions (Custom Linters) | Fourth-party audit §3 | 🟡 P1 |
| Condition expression pure synchronicity and idempotency enforcement (SafeExpr I/O constraints) | Fourth-party audit §4 technical risk | ✅ Added to v1.1 §6.1 |
| `unless` short-circuit evaluation semantics full implementation verification | Fourth-party audit §1 | 🟡 P1 |
| Null propagation semantics formalization (three-valued logic safe-fail) | Third-party assessment SafeExpr research | ✅ Added to v1.1 §6.1 |
| SafeExpr resource quotas (depth/node/step limits) | Third-party assessment SafeExpr research | ✅ Added to v1.1 §6.1 |
| Strict type matching (prohibit implicit conversion) | Third-party assessment SafeExpr research | ✅ Added to v1.1 §6.1 |
| ReDoS static detection in §11.5 quality gates | Third-party assessment SafeExpr research | ✅ Added to v1.1 §11.5 |

| Asynchronous degradation protocol (Fail-Close/Fail-Open configuration) | Third-party assessment SafeExpr research | 🟡 P1 |
| Protocol isolation adapter layer (Canonical Model + Adapter Trait) | Third-party assessment MCP/A2A research | 🟡 P1 |
| JCS+SHA-256 evidence chain detailed provisions (field ordering, value canonicalization, etc.) | Third-party assessment cryptography research | 🔴 P0 |

---

> *"Deterministic architecture, not prompt engineering.*
> *A declarative rule description language, compatible with the MCP and A2A ecosystems.*
> *A shared semantic contract layer for humans, LLMs, systems, and auditors."*
>
> -- OpenOBA · 2026.07.22 · v1.1 (Final)
