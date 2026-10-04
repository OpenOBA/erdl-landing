# ERDL — The Deterministic Governance Language for AI Agents

> [中文](./README.zh-CN.md) | English
>
> **Last updated**: 2026-10-04 — positioned for the multi-agent era

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/@openoba/erdl)](https://www.npmjs.com/package/@openoba/erdl)
[![Vectors](https://img.shields.io/badge/verified_vectors-318-green.svg)](#verified-conformance)
[![Spec](https://img.shields.io/badge/spec-v2.3-orange.svg)](./erdl-language-spec-v2.3.en.md)
[![Deterministic](https://img.shields.io/badge/deterministic-by_construction-2ea44f)]()
[![Kernel](https://img.shields.io/badge/kernel-34_nodes-blueviolet)]()
[![Declarative](https://img.shields.io/badge/paradigm-declarative_rules-orange)]()
[![Multi-agent](https://img.shields.io/badge/governance-delegated_authority-8A2BE2)]()

> 🚀 **POC welcome** — we encourage you to try this project as a proof of concept in your own environment. For technical support, contact us anytime at [support@openoba.com](mailto:support@openoba.com).

**Entity-Rule Definition Language · 实体规则定义语言**

> **ERDL** is a deterministic, declarative **governance language** for AI agents —
> from single-agent guardrails to multi-agent **delegated authority**. **One spec,
> one canonical tree, one hash — verified across implementations.**

ERDL expresses entity structure, behavior rules, and **authority state** as
`when → then` decisions in YAML/JSON. It is a **language** — implementation-neutral,
cross-platform, and provably consistent: the same rule and input produce
byte-for-byte identical results and hashes on any conforming implementation.

## The three layers

ERDL governs agents across three dimensions — one language, one audit discipline:

| Layer | What it governs | ERDL primitive |
|-------|-----------------|----------------|
| **Single agent** | Deterministic `when → then` behavior rules | 34-node expression tree, Simple 30 operators, 13 decisions |
| **Cross-implementation** | Byte-verifiable audit of every decision | Decision Object (DO) + hash chain + 318 conformance vectors |
| **Multi-agent** | Delegated authority along a delegation chain | §6a state blocks (FSM) + §6b delegated-authority invariants (INV-01~05) |

## Why ERDL?

| Problem | How ERDL Solves It |
|---------|-------------------|
| LLM outputs are probabilistic | Deterministic `when → then` guardrails, evaluated outside the model — the prompt never holds the safety boundary |
| A delegated sub-agent can exceed its authority | **Delegated-authority invariants (INV-01~05)** — authority non-amplification, provenance continuity, narrow-only inheritance, transitive revocation — enforced by event-triggered state machines (§6a), proven by adversarial vectors (AV-01~16) |
| Rules drift across implementations | 318 JCS + SHA-256 vectors enforce byte-for-byte consistency |
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
| Expression Projection (V-ENGINE) | 240 | ✅ Node.js (reference) · ✅ Python (concordia-python-expression) |

## Formal Verification

Vectors prove the cases you sampled. [**erdl-formal**](https://github.com/OpenOBA/erdl-formal) proves the rest — it compiles the ERDL expression kernel into SMT (Z3) and verifies, over *all* inputs, that a rule never errors, never fails open, never misses a block. Full 34-node / E1–E12 coverage, with counterexamples you can replay against this reference engine.

## Quick Start (30 seconds)

```bash
npm install @openoba/erdl
```

```yaml
# refund.erdl.yaml
protocol: "erdl/v2"
version: "2.2.0"
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
const result = new Evaluator().evaluate(
  rules,
  { tool: { name: 'issue_refund', args: { amount: 8000 } } },
  { fallbackDecision: metadata.decision },
)
console.log(result.decision) // 'REQUEST_HUMAN'
```

The package exposes the document loader (`loadErdlFile` / `parseErdlDocument`),
the evaluation engine, the 34-node expression-tree kernel, rule validation,
YAML serialization, and the template engine. See the [specification](./erdl-language-spec-v2.3.md)
for the format, and [API.md](./API.md) for the full API reference.

## Stateful rules (§6a state blocks & transitions)

Beyond stateless `when → then` rules, ERDL supports a **single-instance finite
state machine** (§6a): two optional top-level fields — `state` (the state space)
and `transitions` (the deterministic, event-triggered transition function).
State is held by the engine *outside* the expression-tree kernel and read
read-only via the `state.<name>` namespace; transition guards read `state.*` +
`event.*` only. Each committed transition is appended to a serially-anchored
audit chain (genesis → transition / transition_error), and evaluation records an
on-demand `state_snapshot` (`{ values, state_version, transitions_head }`) into
the result. This is the primitive that the organization layer builds multi-agent
**delegated-authority** governance on (SPEC §6b, INV-01~05).

```yaml
state:
  - name: authorization
    values: [authorized, revoked]
    initial: revoked
transitions:
  - on: authorize
    audit_as: DELEGATE
    set: { authorization: authorized }
  - on: revoke
    audit_as: DELEGATE
    set: { authorization: revoked }
```

```ts
import { StateMachine, Evaluator } from '@openoba/erdl'

const sm = new StateMachine(stateDecls, transitions, docTreeHash)
sm.injectEvent({ event_id: 'e1', on: 'authorize', actor: 'root-P' })

const result = new Evaluator().evaluate(rules, fact, { stateMachine: sm })
result.stateSnapshot // { values: { authorization: 'authorized' }, state_version: 1, transitions_head }
```

## Multi-agent governance (delegated authority)

Single-agent guardrails stop at "this agent, this decision." Multi-agent systems add a harder
question: **when Agent A delegates to Agent B, whose authority chain led to B's action, and where
did it violate policy?** ERDL answers it with the **delegated-authority security model** (SPEC §6b):

- **Five invariants** (`INV-01` ~ `INV-05`) bound effective authority across a delegation chain —
  authority non-amplification, provenance continuity, narrow-only constraint inheritance,
  transitive revocation, and capability-boundary non-amplification.
- **Sixteen adversarial vectors** (`AV-01` ~ `AV-16`) prove the invariants hold under attack —
  direct/transitive/aggregation amplification, privilege laundering, revoked-ancestor,
  sequence replay, stale revocation, re-authorization without root provenance, and multi-root
  basis-scoped revocation.
- **§6a state blocks** provide the language primitive: a single-instance FSM whose `state`/`transitions`
  express the authorization state and its event-triggered, audit-anchored transitions.

The delegated-authority security invariants (INV-01–INV-05) and associated adversarial
conformance vectors (AV-01–AV-16) were proposed by **Ravindra Annam** and subsequently refined
and developed through technical review and collaboration with OpenOBA. They live in the
[`rulsynor-multi-agent`](https://github.com/OpenOBA/rulsynor-multi-agent) repository — the
organization layer that consumes ERDL primitives. ERDL supplies the deterministic expression
decision + the state-machine primitive; the organization layer derives effective authority across
hops; the expression layer remains the sole decision authority (SPEC §6b, DESIGN §8a).

```yaml
# One instance of the authorization FSM per delegation relationship (SPEC §6a.1 layering)
state:
  - name: authorization
    values: [authorized, revoked]
    initial: revoked
transitions:
  - on: authorize
    audit_as: DELEGATE
    reason: authorize
    set: { authorization: authorized }
  - on: revoke
    audit_as: DELEGATE
    reason: revoke
    set: { authorization: revoked }
```

## Specification

- [erdl-language-spec-v2.3.md](./erdl-language-spec-v2.3.md) — 中文规范
- [erdl-language-spec-v2.3.en.md](./erdl-language-spec-v2.3.en.md) — English specification

## Community

- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to contribute (setup, standards, PR process).
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — community standards.
- [SECURITY.md](./SECURITY.md) — reporting vulnerabilities.
- [DEVELOPMENT.md](./DEVELOPMENT.md) — development tooling and roadmap.

## Repository Structure

```
.
├── README.md                 # English README (this file)
├── README.zh-CN.md              # Chinese README
├── erdl-language-spec-v2.3.md              # 中文规范（权威）
├── erdl-language-spec-v2.3.en.md           # English specification
├── API.md                    # API reference
├── CHANGELOG.md              # release history (Keep a Changelog)
├── CHANGELOG.zh-CN.md           # release history (Keep a Changelog)
├── CONTRIBUTING.md           # contribution guide
├── CODE_OF_CONDUCT.md        # code of conduct
├── SECURITY.md               # security policy
├── DEVELOPMENT.md            # development tooling + roadmap
├── LICENSE                   # MIT
├── NOTICE.md                 # trademark notice
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
    ├── state-definition.ts   # §6a state/transitions types + load-time validation
    ├── state-machine.ts      # §6a runtime FSM (event injection / audit chain / state_snapshot)
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

**RavindraAnnam** ([github.com/RavindraAnnam](https://github.com/RavindraAnnam))
provided a four-part review spanning the resolution and evaluation layers,
and — in so doing — pressed on exactly the boundary where a "deterministic
kernel" claim is hardest to hold: the **stateful operators** (`within`/
`rate`). His findings (the `temporal_state` evidence gap on state mutation,
the `total_evaluated` count drift, the bounded-vs-unbounded wording of the
resolution proofs) each rolled into a fix; the stateful-operator finding in
particular opened a dedicated research track on stateful-operator semantics.
Separately, in A2A Discussion #2031 he proposed the four runtime-authority
invariants — authority non-amplification, provenance continuity, narrow-only
constraint inheritance, and transitive revocation — that grew into the
INV-01–INV-05 delegated-authority invariants, subsequently refined and developed
through technical review and collaboration with OpenOBA, and now underpin OpenOBA's
multi-agent governance direction.

**Erik Newton (Concordia)** ([github.com/eriknewton](https://github.com/eriknewton))
built the first independent expression-layer runner — a spec-and-contract-only
Python implementation of the v2.1 expression kernel (34 nodes + Simple 30 +
decision-table + gloss) — and cross-checked it against the reference engine.
His RESULTS.md recorded 16 spec ambiguities (A1–A16), four of which exposed real
gaps now fixed in the spec: the `errored` evaluation-error flag (§7.2 E3 / §7.3(a)),
the result-object number encoding (decimal string, spec E2 fixed-point string serialization), the
comparison-vs-arithmetic type-mismatch split (§7.3(a)), and the
constraint-vs-evaluation vector classification. His runner also settled two
readings the spec text left open — the `rate` over-limit boundary (§5.2) and the
type-mismatched-comparison silent-false reading (§7.3(a)).

## License

MIT © 2026 深圳市秒镜科技有限公司 (Shenzhen Miaojing Technology Co., Ltd.)

**Trademark**: ERDL™ is a trademark of 深圳市秒镜科技有限公司. The MIT License
covers copyright only and grants no trademark rights. See [NOTICE.md](NOTICE.md).
