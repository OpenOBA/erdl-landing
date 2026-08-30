# ERDL™

**治理即规则 —— 一个用声明式规则治理 AI Agent 的多方共享语义规范**
*Governance is rules — a multi-party shared semantic specification for governing AI agents with declarative rules.*

**Entity-Rule Definition Language · 实体规则定义语言**

ERDL is a **declarative rule definition format** carried in YAML/JSON, for
precisely expressing entity structures and behavior rules (`when → then`
decisions).

> **Stewardship / 托管说明**：ERDL 是独立语言，暂由 OpenOBA 团队代为管理与维护。
> ERDL is an independent language; it is currently stewarded and maintained by the OpenOBA team.

- **Deterministic** — the same rule and input produce byte-for-byte identical
  results and hashes across any conforming implementation.
- **Readable** — any rule renders back to natural language (gloss).
- **Auditable** — evaluation is independently recomputable and traceable.
- **Cross-implementation verifiable** — semantics converge to a single
  expression-tree kernel, proven by test vectors.

## Quick Start

```yaml
# refund.erdl.yaml
protocol: "erdl/v2"
version: "2.0.0"
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

## Specification

- [erdl-spec.md](./erdl-spec.md) — 中文规范
- [erdl-spec.en.md](./erdl-spec.en.md) — English specification

## Install

```bash
npm install github:OpenOBA/erdl-landing
```

## Usage

```ts
import { loadErdlFile, Evaluator } from '@erdl-lang/erdl'

// 1. Load rules from a YAML file
const { rules, metadata } = loadErdlFile('refund.erdl.yaml')

// 2. Evaluate against a fact object (inject the fallback decision from metadata)
const evaluator = new Evaluator()
const result = evaluator.evaluate(rules, {
  tool: { name: 'issue_refund', args: { amount: 8000 } },
  'metadata.decision': metadata.decision,
})
console.log(result.decision) // REQUEST_HUMAN
```

The package exposes the document loader (`loadErdlFile` / `parseErdlDocument`),
the evaluation engine, the 34-node expression-tree kernel, rule validation,
YAML serialization, and the template engine. See the [specification](./erdl-spec.md)
for the format, and [API.md](./API.md) for the full API reference.

## Community

- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to contribute (setup, standards, PR process).
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — community standards.
- [SECURITY.md](./SECURITY.md) — reporting vulnerabilities.
- [DEVELOPMENT.md](./DEVELOPMENT.md) — development tooling and roadmap.

## Repository Structure

```
.
├── erdl-spec.md              # 中文规范（权威）
├── erdl-spec.en.md           # English specification
├── API.md                    # API reference
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

## License

MIT © 2026 深圳市秒镜科技有限公司 (Shenzhen Miaojing Technology Co., Ltd.)

**Trademark**: ERDL™ is a trademark of 深圳市秒镜科技有限公司. The MIT License
covers copyright only and grants no trademark rights.
