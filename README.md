# ERDL — Deterministic Rules for AI Agents

> [中文](./README.zh-CN.md) | English
>
> **Last updated**: 2026-09-06 — bilingual split: `README.md` is now the English edition; Chinese moved to `README.zh-CN.md`

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/@openoba/erdl)](https://www.npmjs.com/package/@openoba/erdl)
[![Vectors](https://img.shields.io/badge/verified_vectors-301-green.svg)](#verified-conformance)
[![Spec](https://img.shields.io/badge/spec-v2.1-orange.svg)](./erdl-spec.en.md)
[![Deterministic](https://img.shields.io/badge/deterministic-by_construction-2ea44f)]()
[![Kernel](https://img.shields.io/badge/kernel-34_nodes-blueviolet)]()
[![Declarative](https://img.shields.io/badge/paradigm-declarative_rules-orange)]()

> ⚠️ **Proof of Concept** — this project is in early alpha and not yet production-ready. Use at your own risk.

**Entity-Rule Definition Language · 实体规则定义语言**

> **ERDL** is a deterministic, declarative rule format for AI Agent behavior
> governance. **One spec, one canonical tree, one hash — verified across
> implementations.**

ERDL expresses entity structure and behavior rules as `when → then` decisions in
YAML/JSON. It is a **language** — implementation-neutral, cross-platform, and
provably consistent: the same rule and input produce byte-for-byte identical
results and hashes on any conforming implementation.

## Why ERDL?

| Problem | How ERDL Solves It |
|---------|-------------------|
| LLM outputs are probabilistic | Deterministic `when → then` guardrails, evaluated outside the model — the prompt never holds the safety boundary |
| Rules drift across implementations | 301 JCS + SHA-256 vectors enforce byte-for-byte consistency |
| Compliance needs audit trails | Every evaluation produces a cryptographically verifiable hash |
| Business users can't read code | Three projection surfaces (Simple / Expression / Decision Table) compile to one semantic tree |

## Verified Conformance

ERDL's semantics are pinned by a cross-implementation vector set (see
[`erdl-vectors`](https://github.com/OpenOBA/erdl-vectors)). Independent,
spec-only runners recompute every vector with self-built JCS — no reference code,
no answer file.

| Layer | Vectors | Status |
|-------|---------|--------|
| Decision Hash (DO v1.5) | 78 | ✅ Node.js (reference) · ✅ Go (norviq-go) · ✅ Python (concordia-python) |
| Expression Projection (V-ENGINE) | 223 | ✅ Node.js (reference) · 🚧 independent runners welcome |

## Formal Verification

Vectors prove the cases you sampled. [**erdl-formal**](https://github.com/OpenOBA/erdl-formal) proves the rest — it compiles the ERDL expression kernel into SMT (Z3) and verifies, over *all* inputs, that a rule never errors, never fails open, never misses a block. Full 34-node / E1–E12 coverage, with counterexamples you can replay against this reference engine.

## Quick Start (30 seconds)

```bash
npm install @openoba/erdl
```

```yaml
# refund.erdl.yaml
protocol: "erdl/v2"
version: "2.1.0"
metadata:
  name: "refund-guard"
  decision: ALLOW
  category: coding
rules:
  - name: "SEC-001-refund-limit"
    description: "Refunds over 5000 require human approval"
    priority: 10
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: eq
          value: "issue_refund"
        - field: "tool.args.amount"
          operator: gt
          value: 5000
    then: REQUEST_HUMAN
    message: "Refund amount over 5000, human approval required"
```

```ts
import { loadErdlFile, Evaluator } from '@openoba/erdl'

// 1. Load rules from a YAML file
const { rules, metadata } = loadErdlFile('refund.erdl.yaml')

// 2. Evaluate against a fact object (inject the fallback decision from metadata)
const result = new Evaluator().evaluate(rules, {
  tool: { name: 'issue_refund', args: { amount: 8000 } },
  'metadata.decision': metadata.decision,
})
console.log(result.decision) // 'REQUEST_HUMAN'
```

The package exposes the document loader (`loadErdlFile` / `parseErdlDocument`),
the evaluation engine, the 34-node expression-tree kernel, rule validation,
YAML serialization, and the template engine. See the [specification](./erdl-spec.md)
for the format, and [API.md](./API.md) for the full API reference.

## Specification

- [erdl-spec.md](./erdl-spec.md) — 中文规范
- [erdl-spec.en.md](./erdl-spec.en.md) — English specification

## Community

- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to contribute (setup, standards, PR process).
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — community standards.
- [SECURITY.md](./SECURITY.md) — reporting vulnerabilities.
- [DEVELOPMENT.md](./DEVELOPMENT.md) — development tooling and roadmap.

## Repository Structure

```
.
├── README.md                 # Chinese README (primary)
├── README.zh-CN.md              # English README (this file)
├── erdl-spec.md              # 中文规范（权威）
├── erdl-spec.en.md           # English specification
├── API.md                    # API reference
├── CHANGELOG.md              # release history (Keep a Changelog)
├── CHANGELOG.zh-CN.md           # release history (Keep a Changelog)
├── CONTRIBUTING.md           # contribution guide
├── CODE_OF_CONDUCT.md        # code of conduct
├── SECURITY.md               # security policy
├── DEVELOPMENT.md            # development tooling + roadmap
├── LICENSE                   # MIT + trademark notice
├── package.json / tsconfig.json / vitest.config.ts
└── src/
    ├── index.ts              # public API entry
    ├── erdl-loader.ts        # YAML document loader (parseErdlDocument / loadErdlFile)
    ├── evaluator.ts          # evaluation engine
    ├── erdl-schema.ts        # single source of truth (decisions / operators / categories)
    ├── rule-definition.ts    # core type definitions
    ├── rule-validator.ts     # rule validation
    ├── rule-yaml-serializer.ts  # RuleDefinition → §2.1 YAML
    ├── rule-quality-gate.ts  # load-time quality gates
    ├── template-engine.ts    # template engine
    ├── field-contracts.ts    # field contracts + display_name
    ├── fn-registry.ts        # function delegation registry
    ├── guard-state-manager.ts  # stateful operator (within/rate) state
    ├── op-sem-registry.ts/.yaml  # operation semantics registry
    ├── safe-regex.ts         # ReDoS-safe regex
    ├── clock.ts / date-utils.ts  # time + date utilities
    └── expr-tree/            # the 34-node expression-tree kernel
        ├── node-types.ts     # ExprNode + 34 node types
        ├── evaluator.ts      # tree evaluator (E1–E12)
        ├── gloss.ts          # natural-language projection (gloss)
        ├── s-expression.ts   # S-expression serialization
        ├── simple-compiler.ts  # Simple 30-operator compilation
        ├── rule-to-expr.ts   # when → tree compilation
        ├── canonical.ts      # canonical form
        ├── fixed-point.ts    # fixed-point rational arithmetic
        ├── limits.ts         # resource limits (E4)
        ├── normalize.ts      # NFC normalization
        ├── grade.ts          # rule grading (A/B/C)
        ├── decision-table.ts # decision-table compilation
        ├── eval-trace.ts / eval-warning.ts  # evaluation trace + warnings
        └── *.spec.ts         # test suites
```

## Acknowledgments

The resolution semantics (§7.1 ring / override / catch-all) were shaped in
part by external review. **ANP2 Network** ([dev.to/anp2network](https://dev.to/anp2network))
provided two rounds of precise, reproducible review of the resolution
layer, identifying the boundary that "an empty-condition (catch-all) rule
MUST NOT rewrite an explicit-condition decision" (now §7.1 item 6) and its
matching gap in the engine and SMT verification layers. Each finding rolled
forward into a spec clarification, an engine fix, and a proof.

## Contact

- **Support**: [support@openoba.com](mailto:support@openoba.com)

## License

MIT © 2026 深圳市秒镜科技有限公司 (Shenzhen Miaojing Technology Co., Ltd.)

**Trademark**: ERDL™ is a trademark of 深圳市秒镜科技有限公司. The MIT License
covers copyright only and grants no trademark rights.
