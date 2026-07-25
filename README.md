<!--
  Copyright (c) 2026 唐启鑫 (Tang Qixin)
  Licensed under MIT. See LICENSE file.
-->

<p align="center">
  <img src="https://raw.githubusercontent.com/openoba/erdl-spec/main/assets/erdl-logo.svg" alt="ERDL Logo" width="120" />
</p>

<h1 align="center">ERDL (Entity-Rule Definition Language)</h1>

<p align="center">
  <strong>ERDL — a declarative rule execution protocol that constrains LLM output at the code level.</strong>
</p>

<p align="center">
  <a href="https://github.com/OpenOBA/erdl-landing/releases"><img src="https://img.shields.io/badge/Version-1.1%20Final-blue?style=flat-square" alt="Version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"></a>
  <a href="spec/erdl-spec-v1.1.en.md#12-decision-object"><img src="https://img.shields.io/badge/Status-v1.1%20Stable%20%7C%20Audited-success?style=flat-square" alt="Status"></a>
  <a href="spec/vectors/"><img src="https://img.shields.io/badge/Verification-44%20Vectors-blue?style=flat-square" alt="Vectors"></a>
</p>

<p align="center">
  <a href="#-the-rage-youve-felt">The Rage</a> •
  <a href="#-what-is-erdl">What is ERDL</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-where-it-sits">Where It Sits</a> •
  <a href="#-trust-requires-proof">Proof</a> •
  <a href="#-design-philosophy">Philosophy</a> •
  <a href="#-the-biggest-slice-of-the-agent-market">Market</a> •
  <a href="#-contributing">Contribute</a>
</p>

---

## The Rage You've Felt

| You said 800 times… | What it did | Root cause |
|---------------------|-------------|------------|
| **Don't use `any`** | Ten turns later, `as any` in production | Prompts are suggestions, not constraints |
| **Stay on task** | First 20 turns perfect, turn 40 refactoring code you never touched | LLMs optimize the next step, not the goal |
| **Wait for my approval** | Nodded "got it", then pushed anyway | No protocol-layer permission gate |
| **Remember these 30 rules** | Followed 4, hallucinated the rest | Tokens ≠ understanding, windows ≠ memory |

**Every time: "Got it, no problem." Every time: forgot.** SKILL files. Prompts. Markdown. You've tried everything. It's not that your rules are bad — it's that they live in the wrong place. They're inside the LLM's context window, crammed next to everything else the LLM is thinking about. Of course it forgets. Of course it drifts. Of course it hallucinates.

**But LLMs are too powerful to walk away from. You can't work without them. So what do you do?**

Move the rules outside. Not in the Prompt. At the protocol layer — the boundary between the Agent and the world. **ERDL is a code-level rule execution protocol.** Write `when/then` rules in YAML. The engine enforces them before every tool call. The LLM can't forget — because the rules aren't in its head. Can't bypass — because the door is outside its reach.

---

## What is ERDL

ERDL (Entity-Rule Definition Language): a YAML syntax using `when/then` declarative statements to **replace Prompt and Markdown as the constraint layer for LLM output** — delivering deterministic enforcement the LLM can't forget and can't bypass.

> Write it like grade-school homework: `when(A)` + `then(B)` is a law you just enacted. The clearer your rules, the higher your output quality and the more reliable your workflow.

| Trait | Meaning |
|------|------|
| 🚫 **LLM- and framework-agnostic** | MIT licensed. Anyone — individual or organization — can adopt it and create their own rule sets. |
| 📋 **Full audit chain** | Evaluated before every tool call. Complete hash trail: who, when, which rule, what result. Tamper-proof. |
| 🎯 **Judge before execution, not after** | Decides what to do and what not to do before the action fires. Clear navigation target for the LLM. Not digging through logs after the fact. |
| 📖 **One file, all parties** | Users, Agents, LLMs, auditors — all read the same YAML. Human-reviewable. Machine-executable. |

```yaml
# No DBA? No DROP TABLE. Period.
# (Rule snippet — for full file format with protocol/version/metadata, see examples/)
- name: "SEC-001-protect-prod-db"
  unless:
    conditions:
      - field: "caller.role"
        operator: eq
        value: "DBA_ADMIN"
  when:
    conditions:
      - field: "tool.name"
        operator: eq
        value: "execute_sql"
      - field: "tool.args.query"
        operator: match
        value: "(?i)DROP\\s+TABLE"
  then: DENY
  message: "DROP TABLE blocked. Use data_archive_tool or contact DBA team."
```

---

## Quick Start

```bash
git clone https://github.com/OpenOBA/erdl-engine-js.git
cd erdl-engine-js
npm install
npm run build
npm test  # 151 tests
```

Write your first rule in 3 minutes:

```yaml
# rules/pricing.erdl.yaml
protocol: "erdl/v1"
version: "1.1.0"
metadata:
  description: "Pricing rules"
  owner: "example"
rules:
  - name: "FIN-001-max-discount"
    category: compliance
    priority: 10
    when:
      field: "context.discount"
      operator: gt
      value: 0.3
    then: DENY
    message: "Discount exceeds 30% cap. Manager approval required."
```

Validate and run:

```bash
npx erdl-engine check ./rules/
# ✔ FIN-001-max-discount: Passed
```

> 💡 For full field reference (category, priority, ring, triggers, etc.), see [examples/](./examples/).

**13 operators. 17 then-actions. 4 execution rings.** From `DENY` to `EMERGENCY_HALT` to `QUARANTINE` — every response your Agent might need, defined declaratively.

📄 Full Specification: [English](spec/erdl-spec-v1.1.en.md) | [中文版](spec/erdl-spec-v1.1.md)

---

## Where It Sits

```
┌──────────────────────────────────────────────────┐
│  A2A — Agent ↔ Agent Communication (L8)           │  Google · Linux Foundation
├──────────────────────────────────────────────────┤
│  ERDL — Agent Behavioral Rules (L9)               │  Tang Qixin · MIT License
│  (MCP Server + A2A Card Extension)                │  <--- The Rules Layer (Training / Compliance)
├──────────────────────────────────────────────────┤
│  MCP — Agent ↔ Tool Connection (L8)               │  Anthropic · Linux Foundation
└──────────────────────────────────────────────────┘
```

MCP connects Agents to tools. A2A connects Agents to each other. **ERDL constrains LLM output at every connection point — auditable, correctable, traceable.** Rules govern every action. The full process is recorded. This is how AI compliance works in production.

---

## Trust Requires Proof

Declaring "we're safe" isn't trust. Proof is. ERDL ships with **44 verification vectors** — 37 decision engine + 7 audit hash — that any implementation must pass, byte-for-byte.

### Independently Verified (with thanks)

| Implementer | What they verified | Vectors | Date | Result |
|-------------|-------------------|:-------:|------|--------|
| **Erik Newton** (Concordia) | Audit hash chain | 5/5 (AV-001~AV-005) | 2026-07-14 | ✅ Byte-identical |
| **Christopher** (chopmob-cloud) | Compliance receipt + JCS edge cases | 18/18 | 2026-07 | ✅ Verified |
| **ERDL Engine JS** (self-verify) | Decision engine + audit hashes | 44/44 (AV-001~AV-007) | 2026-07 | ✅ 151 tests |

All 44 vectors verified — 37 decision engine + 7 audit hash. Two independent runners. Same output down to the byte.

Join the verification discussion: [A2A Discussion #2031](https://github.com/a2aproject/A2A/discussions/2031) · [#2038](https://github.com/a2aproject/A2A/discussions/2038)

> **Want your name here?** → [Contributing](#-contributing)

---

## The Biggest Slice of the Agent Market

Everyone is racing to build smarter Agents. Better models, faster inference, more tools.

**There's another path.**

The Agent market will split into two layers:

```
┌──────────────────────────────────────────┐
│  Layer 2: Capability                      │  Crowded. Commoditized.
│  "What can your Agent do?"               │  Every model provider is here.
│  → Models, tools, frameworks             │  Margin → zero.
├──────────────────────────────────────────┤
│  Layer 1: The Rules Layer                 │  Empty. Uncontested.
│  "Who sets the rules? Who's accountable?" │  ERDL is here.
│  → Rules, audit, compliance, insurance   │  Margin → the whole pie.
└──────────────────────────────────────────┘
```

**Compliance isn't a cost center. It's the moat.** When every Agent can do the same things, the winner isn't the one with the smartest model. It's the one that can prove — to a regulator, to an auditor, to a customer — that it won't do the wrong thing.

ERDL is infrastructure for that proof. And the infrastructure layer always captures more value than the application layer. Ask TCP/IP. Ask TLS. Ask Kubernetes.

---

## Design Philosophy

> *Don't make AI smarter. Make the rules clear enough that ambiguity disappears.*

The mainstream races toward bigger models, longer contexts, more complex reasoning. **ERDL inverts this: make rules so simple that an ordinary person can read them and a mediocre LLM can execute them correctly.** This is the counterintuitive premise behind the entire protocol — not chasing better AI, but acknowledging AI's ceiling and closing the gap with a protocol.

### 1. A Semantic Layer Everyone Can Read

ERDL is not another rules language. **It's a shared semantic layer for four parties** — humans (domain experts), LLMs (general-purpose models), systems (execution engines), and auditors (governance/compliance). One YAML file. Humans read it. LLMs parse it. Engines execute it. Auditors trace it. No more speaking past each other.

### 2. Minimal Core Grammar

Thirteen operators. No more. `when/then` declarative structure. No recursion. No higher-order functions. No Turing completeness. **Comprehensible to anyone with primary-school arithmetic.** The smaller the core, the fewer things can go wrong — and the easier it is for all parties to reach consensus.

### 3. Determinism First

Same rules + same input → same output. Swap the model? Same result. Swap the language? Same result. **Three independent LLMs produced identical decisions under ERDL — zero cross-model variance.** Determinism matters more than accuracy: you can tune accuracy, but you can't fix non-determinism.

### 4. Rules Ordinary People Can Read

Humans are the final decision-makers — and the weakest participant. **The protocol degrades to the human level, not the other way around.** ERDL's `when/then` structure maps directly to the conditional reasoning humans already use in everyday communication: "when A, then B." No training required. No manual needed.

### 5. Complex Logic via Delegation

ERDL does not solve optimization problems, run ML inference, or perform double-entry accounting. Those belong to specialized engines registered via `fn`. **The protocol's boundary is clear: translate rules, navigate context, return decisions — delegate complex computation to external engines.** Five meta-properties (within, state, combine, override, fn) extend coverage without bloating the core.

### 6. Broad Coverage of Real-World Needs

Cross-validated across multiple industries (ERP, EV manufacturing MES, banking credit, government approval) and five production rule systems: **core expressions cover 68–79%.** The remainder can be delegated to external engines.

### 7. Full-Chain Audit Trail

Evaluated before every tool call. JCS (RFC 8785) + SHA-256 Decision Object. **Who, when, which rule, what result — complete hash chain, tamper-proof, court-admissible.** Two independent runners have verified byte-for-byte consistency.

### 8. Neutral, MIT Open Source

MIT licensed. No ties to any specific LLM, framework, or platform. **Individuals, organizations, enterprises — anyone can adopt it and create their own rule engines and rule sets.**

The specification is owned by Tang Qixin personally, independent of any commercial entity.

---

## Contributing

ERDL is a community-driven open standard. You don't need to touch the SPEC to contribute.

| Path | What you do | Time | Example |
|------|-------------|:----:|---------|
| 🧩 **Rule Patterns** | Share real-world rules from your domain | ~30 min | Healthcare HIPAA, fintech AML, DevOps policies |
| 🐛 **Edge Cases** | Find scenarios our vectors don't cover — open an issue | ~1 hour | "What if `unless` references a null field?" |
| 🔧 **Independent Runner** | Implement an ERDL engine in your language | Weekend | Rust, Go, Python, Java — verify against our vectors |

```bash
git clone https://github.com/OpenOBA/erdl-landing.git
cd erdl-landing
mkdir -p examples/my-domain
echo '# My domain rules' > examples/my-domain/my-domain.erdl.yaml
npx @openoba/erdl-engine-js check examples/
# → Open a PR
```

---

## License

ERDL Specification, reference implementations, development tools, and verification vectors: [MIT License](LICENSE) · Copyright (c) 2026 唐启鑫 (Tang Qixin)

> Deterministic architecture, not prompt engineering.
