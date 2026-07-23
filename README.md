<p align="center">
  <img src="https://raw.githubusercontent.com/openoba/erdl-spec/main/assets/erdl-logo.svg" alt="ERDL Logo" width="120" />
</p>

<h1 align="center">ERDL (Entity-Rule Definition Language)</h1>

<p align="center">
  <strong>Deterministic behavior rules for AI Agents. Not prompt engineering.</strong>
</p>

<p align="center">
  <a href="https://github.com/OpenOBA/erdl-landing/releases"><img src="https://img.shields.io/badge/Version-1.1%20Final-blue?style=flat-square" alt="Version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/Status-Frozen%20%26%20Audited-success?style=flat-square" alt="Status"></a>
  <a href="#"><img src="https://img.shields.io/badge/Layer-L9%20Semantic-orange?style=flat-square" alt="Layer"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-core-concepts">Core Concepts</a> •
  <a href="#-v11-highlights">v1.1 Highlights</a> •
  <a href="#-compliance--audit">Compliance</a> •
  <a href="#-ecosystem">Ecosystem</a>
</p>

---

## What is ERDL?

In the era of Agentic AI, LLMs are probabilistic. Enterprise operations require **determinism**.

**ERDL (Entity-Rule Definition Language)** is an open, declarative standard for Agent behavioral rules. It defines the constraints, policies, and corrective logic that AI Agents must follow when executing tool calls.

- 🚫 **Not Prompt Engineering**: Prompts are suggestions — Agents can hallucinate or bypass them. ERDL is a deterministic enforcement gate that Agents cannot circumvent.
- 🚫 **Not an Agent Framework**: ERDL does not replace LangGraph, CrewAI, or AutoGen. It is the **rules layer** they are all missing.
- ✅ **The L9 Semantic Layer**: ERDL fills the governance gap between MCP (L8, tool connections) and A2A (L8, agent communication).

### Three-Layer Protocol Stack

```
┌──────────────────────────────────────────────────┐
│  A2A — Agent ↔ Agent Communication (L8)           │  Google · Linux Foundation
├──────────────────────────────────────────────────┤
│  ERDL — Agent Behavioral Rules (L9)               │  OpenOBA · MIT License
│  (MCP Server + A2A Card Extension)                │  <--- YOU ARE HERE
├──────────────────────────────────────────────────┤
│  MCP — Agent ↔ Tool Connection (L8)               │  Anthropic · Linux Foundation
└──────────────────────────────────────────────────┘
```

---

## Quick Start

ERDL rules are written in YAML — readable by both humans and LLMs.

### 1. Write your first rule

```yaml
# rules/security.yaml
# Prevent non-DBAs from dropping production tables
- name: "SEC-001-protect-prod-db"
  description: "Protect production database from accidental drops"
  priority: 100
  category: security

  # unless exemption (v1.1: evaluated first, short-circuit)
  unless:
    logic: AND
    conditions:
      - field: "caller.role"
        operator: eq
        value: "DBA_ADMIN"

  # trigger conditions
  when:
    logic: AND
    conditions:
      - field: "tool.name"
        operator: eq
        value: "execute_sql"
      - field: "tool.args.query"
        operator: match
        value: "(?i)DROP\\s+TABLE"

  # deterministic action
  then: DENY

  # mandatory feedback (v1.1: guides LLM self-correction)
  message: "DROP TABLE blocked. Use data_archive_tool or contact DBA team."
```

### 2. Validate rules

```bash
# Install CLI
npm install -g @openoba/erdl-lint

# Run quality gate checks
erdl-lint check ./rules/
```

Output:
```
✔ SEC-001-protect-prod-db: Passed (Determinism, Completeness)
⚠ SEC-002-api-rate-limit: Warning [empty-message-on-blocking-rule]
  Blocking rules without a message field leave LLMs unable to understand rejections.
```

---

## Core Concepts

| Concept | Details |
|---------|---------|
| **13 Operators** | `eq` `ne` `gt` `gte` `lt` `lte` `in` `not_in` `contains` `not_contains` `match` `exists` `within` |
| **17 Then Actions** | `ALLOW` `CORRECT` `NOTIFY` `DENY` `EMERGENCY_HALT` `ROLLBACK` `QUARANTINE` `REQUEST_HUMAN` `ESCALATE` `DELEGATE` `STRATEGIZE` `AUDIT` `CALCULATE` `VALIDATE` `WORKFLOW` `WORKFLOW_WAITING` `WORKFLOW_PROGRESS` |
| **4 Execution Rings** | Ring 0 (Security) → Ring 1 (Compliance) → Ring 2 (Operations) → Ring 3 (Execution) |
| **44 Verification Vectors** | 37 decision engine + 7 audit hash = byte-for-byte identical across implementations |
| **JCS + SHA-256 Audit Chain** | RFC 8785 canonical serialization, tamper-evident and traceable |

📄 Full Specification: [English](spec/erdl-spec-v1.1.en.md) | [中文版](spec/erdl-spec-v1.1.md)

---

## v1.1 Highlights

v1.1 is a defensive release, hardened against real-world enterprise Agent production issues:

| Feature | Description | Problem Solved |
|---------|-------------|----------------|
| **unless Short-Circuit Exemption** | unless evaluated before when, with safe null propagation | Enables blocklist/allowlist patterns without "one-size-fits-all" blocking |
| **Mandatory message Correction** | Blocking rules (DENY/CORRECT) must carry structured feedback | Prevents Agent dead loops after being blocked without explanation |
| **Quality Gates** | Load-time rejection of dangerous rules like `when: 'true'` + `DENY` | Prevents a single bad rule from taking down the entire Agent system |
| **JCS+SHA-256 Audit Chain** | Decision Object uses RFC 8785 canonical serialization | Bit-level audit consistency across languages and platforms |
| **Structured Naming Convention** | Enforced `[CAT]-[NNN]-description` format | Upgrades rules from "ad-hoc scripts" to "auditable enterprise assets" |

> Full changelog: [CHANGELOG.md](CHANGELOG.md)

---

## Compliance & Audit

ERDL is not just a technical tool — it is compliance infrastructure for enterprise AI governance. v1.1's Decision Object and audit evidence chain directly align with:

- 🇪🇺 **EU AI Act (Art. 15)**: Transparency, explainability, and human oversight requirements for high-risk AI systems
- 🇺🇸 **NIST AI RMF 1.0**: Quantifiable risk management evidence for the Measure/Map phases
- 🇨🇳 **GB/Z 185-2026**: Aligned with the national standard for AI Agent interconnection — behavioral audit and security clauses
- 🏢 **CAICT Trusted AI 2.0**: Coverage of "Key Capabilities — Decision" and "Platform Support" evaluation dimensions

> 💡 For RegTech developers: ERDL's Decision Object is a machine-readable legal evidence format. Parse ERDL audit logs to auto-generate compliance reports.

---

## Ecosystem & Integrations

ERDL is framework-agnostic. We encourage the community to build Runners, IDE plugins, and middleware:

- **LangChain / LangGraph**: Inject as Tool Router middleware
- **CrewAI / AutoGen**: Deploy as the Guard layer during Agent instantiation
- **MCP (Model Context Protocol)**: ERDL rules compile to MCP Servers, callable by any MCP Client
- **IDE Support**: Community-driven VS Code extension (YAML completion, lint hints, trace visualization)

---

## Roadmap (v1.2)

ERDL v1.1 is frozen. v1.2 will focus on distributed and advanced governance scenarios:

| Priority | Feature | Description |
|:---:|---------|-------------|
| 🔴 P0 | Distributed Consistency | Cross-node EMERGENCY_HALT global effect and state synchronization |
| 🟡 P1 | Message Template Interpolation | Dynamic variable injection like `{{context.amount}}` in corrective messages |
| 🟡 P1 | Custom Quality Gates | Extend `erdl-lint` rules via plugin architecture |
| 🟡 P1 | DELEGATE Decision Type | First-class support for multi-Agent permission delegation auditing |

> Full v1.2 roadmap: [Appendix E](spec/erdl-spec-v1.1.en.md#appendix-e-v12-planned-goals)

---

## Contributing

ERDL is a community-driven open standard. We welcome:

- **Rule Pattern Contributions**: Submit industry best-practice rule sets (finance, healthcare, manufacturing) under `examples/`
- **Toolchain Development**: Build SafeExpr parsers or IDE plugins for specific languages (Rust, Go, Python)
- **Test Vector Augmentation**: Contribute edge-case test scenarios in `spec/vectors/`

---

## License

ERDL Specification is open-sourced under the [MIT License](LICENSE).

> Deterministic Architecture, Not Prompt Engineering.
> OpenOBA · 2026
