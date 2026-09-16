# ERDL Specification v2.2
（Entity-Rule Definition Language · 实体规则定义语言）

> **Status**: v2.2 · Final
> **Date**: 2026-09-12
> **Version semantics**: this document (the ERDL language specification) is version **v2.2**; the top-level `protocol: "erdl/v2"` (protocol identifier, fixed value) and `version: "2.2.0"` (rule-format version) are independent version identifiers, not to be conflated with the document version.
> **Author**: Tang Qixin（唐启鑫）
> **Trademark**: ERDL™ is a trademark of Shenzhen Miaojing Technology Co., Ltd.
> **Positioning**: ERDL (Entity-Rule Definition Language) is a **declarative rule definition format**, carried in YAML/JSON, for precisely expressing entity structures and behavior rules. This specification is **independent and neutral** — it defines only the format itself, depending on no particular implementation or upper-layer framework; its deterministic evaluation and canonical form support byte-for-byte cross-implementation verification. In ERDL, **rules decide everything**: rules are the carrier of semantics, the boundary of execution, the evidence of audit, and the fact of governance.
> **Conformance language**: **MUST / MUST NOT / SHOULD / SHOULD NOT / MAY** in this document are interpreted per [RFC 2119].

---

## 1. Introduction

### 1.1 What ERDL Is

ERDL (Entity-Rule Definition Language) is a **declarative rule definition format** carried in YAML/JSON, for precisely expressing entity structures and behavior rules. It contains two kinds of **declarations**: **Entity** defines data structure; **Rule** defines a `when → then` decision. Entity defines the structure of an object; Rule prescribes the consequence of a condition; together they form an executable, reviewable, and verifiable rule expression.

### 1.2 Design Philosophy

**ERDL is a "multi-party semantic layer"** — it is not just a rule format, but a **semantic convention layer shared by human, LLM, system, and audit**:

| Party | ERDL's role |
|--------|------------|
| Human (business/domain expert) | the precise translation of natural-language rules, readable and reviewable |
| LLM (general model) | structured input that removes ambiguity and supports deterministic evaluation |
| System (rule engine) | standardized rule description; `fn` delegation controls the call boundary |
| Audit (regulation/compliance) | a traceable rule record clearer than code + natural language |

In this semantic layer, rules decide everything: humans express intent, the LLM translates semantics, the system executes decisions, and audit reviews the evidence. ERDL's deterministic semantic layer gives an LLM clear direction: a user describes a rule in natural language; after ERDL precisely translates it, the LLM deterministically executes it per structured semantics — the conversational interface is the unified entry point.

### 1.3 Value at the AI Governance Level

The core challenge of AI governance is not whether a model can answer, but how probabilistic outputs satisfy the deterministic boundary required by regulation, auditing, and accountability. ERDL encodes declarative rules in YAML/JSON, codifying entity structures, behavioral constraints, and disposition actions into a verifiable deterministic rule layer, and turns "how an AI should act" from a training assumption into an inspectable object.

**From trust to verification**: Traditional governance relies on alignment assessments or post hoc explanations, making it difficult to prove which constraints a specific decision followed. ERDL expresses constraints as `when → then` rules. Each evaluation is bound to a canonical_tree snapshot and an outcome hash, enabling independent recomputation and byte-for-byte verification across implementations. Governance stakeholders no longer merely trust that a model has been "properly trained"; they can verify whether an action matched a rule, which rule it matched, and why that result was produced.

**Accountable evidence chain**: ERDL evaluation results are hashable and recomputable. Rule versions, input snapshots, decision outputs, and hashes can be anchored together to form audit records. Auditing is not a restatement of logs, but a reproducible proof process — why an action was allowed, why it was blocked, and who approved it can all be traced and verified, preventing post hoc explanations from becoming the sole basis.

**Mechanized human–machine accountability boundary**: ERDL can use decision types such as REQUEST_HUMAN and ESCALATE to require human adjudication for high-risk operations, sensitive entity changes, irreversible actions, and similar cases. Final human decision-making authority no longer depends on procedural slogans; it is encoded as executable, testable, and auditable rule paths.

**Compliance as code and cross-organizational mutual recognition**: Regulations, platform policies, and internal red lines can be translated into ERDL rules and continuously validated through test vectors. Different organizations, implementations, or third-party auditors can independently recompute outcomes from the same rules and canonical_tree, establishing a "trust but verify" governance paradigm and turning compliance from declarative documentation into governance facts that are executable, inspectable, and mutually recognizable.

### 1.4 Design Goals

1. **Determinism**: for the same rule and input, any conforming implementation MUST produce byte-for-byte identical evaluation results and hashes;
2. **Readability**: any rule can be read back as natural language (gloss) that a human can instantly understand and review;
3. **Auditability**: the rule's evaluation process is independently recomputable and traceable;
4. **Cross-implementation verifiability**: semantics converge to a single kernel, and conformance is proven by byte-for-byte comparison against test vectors.

### 1.5 Core Commitment

> **The semantic carrier is the kernel, not the syntax.**
> **Semantics = tree = hash.** The three coincide in canonical form.

Any scheme that takes "operator syntax" as its semantic carrier is forced to expand operators linearly as new requirements appear, so its cost never converges. This specification therefore converges semantics onto a single kernel (the expression tree), and treats the multiple writing forms as deterministic projections of that kernel — they are not independent languages, but different views of the same semantics. **Rules decide everything**: a rule's validity depends not on its writing entry point or implementation form, but on canonicalized semantics that are unique, recomputable, hashable, and byte-for-byte verifiable.

---

## 2. Document Structure

### 2.1 Top-Level Format

An ERDL document (`*.erdl.yaml`) consists of six top-level fields — four MUST and two MAY — whose order MUST be fixed:

```yaml
protocol: "erdl/v2"       # protocol identifier, fixed value
version: "2.2.0"          # rule-format version
metadata: { ... }         # document-level metadata (see §2.2)
state: [ ... ]            # state space declaration (optional, see §6a)
transitions: [ ... ]      # state transition rules (optional, see §6a)
rules: [ ... ]            # rule list (see §4)
```

| Top-level field | Type | Required | Description |
|---------|------|:---:|------|
| `protocol` | string | MUST | Protocol identifier, fixed value `"erdl/v2"` |
| `version` | string | MUST | Rule-format version (semantic versioning) |
| `metadata` | object | MUST | Document-level metadata |
| `state` | array | MAY | State space declaration (§6a) |
| `transitions` | array | MAY | State transition rules (§6a) |
| `rules` | array | MUST | Rule list; elements defined in §4 |

### 2.2 metadata

```yaml
metadata:
  name: "my-first-rule-set"
  description: "Allow file read operations"
  category: coding
  decision: ALLOW            # fallback decision when no rule matches
  tags: [example]
```

| Field | Type | Description |
|------|------|------|
| `name` | string | Rule set name |
| `description` | string | Rule set description |
| `category` | string | Rule set category (coding/security/compliance…) |
| `decision` | string | Fallback decision (default verdict when no rule matches; see §6) |
| `tags` | array | Tags |

### 2.3 Format Conventions

- String values MUST use double quotes; enum keywords / numbers / booleans are written bare;
- Indentation MUST be 2 spaces;
- The file MUST begin with `protocol: "erdl/v2"`;
- Version compatibility: within the same `protocol` major version, new constraints SHOULD be non-breaking for existing rules (a Warning at load, not an Error); a cross-major-version change (e.g. erdl/v1 → erdl/v2) is a breaking change and is not covered by the backward-compatibility promise. Exception: `when:"true"` combined with a blocking `then` is rejected at load in any version (Error).

### 2.4 Parsing and Evaluation Overview

An ERDL document moves from file to decision result through a fixed five-step pipeline. Understanding this pipeline is understanding how ERDL is "parsed" and "evaluated":

| Step | Action | Input → Output | Basis |
|------|--------|----------------|-------|
| ① Load | Read the rule document | `*.erdl.yaml` → structured object | §2.1–§2.3 |
| ② Validate | Load-time type checking | structured object → valid document (reject invalid) | E5, §6a.2/§6a.4/§6a.7 |
| ③ Compile | Normalize the three writing forms | valid document → expression tree (canonical_tree) | E7, §8.2 |
| ④ Evaluate | Judge the tree node-by-node against the fact | expression tree + fact → decision | §7 |
| ⑤ Emit | Produce evaluation evidence | decision → hashable, recomputable result | E6, §8 |

- **① Load**: read `*.erdl.yaml` and parse it per the §2.3 format conventions (YAML and JSON are equivalent, losslessly interchangeable).
- **② Validate**: load-time type checking — field order, required fields, enum values, `when`/`expr` mutual exclusion, state-block validation (§6a.2/§6a.4/§6a.7), etc.; violations are rejected at load.
- **③ Compile**: Simple / Expression / Decision Table MUST compile to the same expression tree (E7), producing the canonical tree (§8.2).
- **④ Evaluate**: the expression tree judges the input fact node-by-node (§7). The tree is a pure function (E1); the state of `within`/`rate` is injected under control via `temporal_state`, and §6a authority state via `state.*`.
- **⑤ Emit**: produce the decision result, bound to the canonical_tree snapshot and the result hash (E6), independently recomputable and byte-for-byte verifiable.

> The full contracts for the input fact and the evaluation output are in §7.0.

---

## 3. Entity Definition

An Entity is the subject a rule acts upon (passed via context). ERDL predefines the following Entity types:

| Entity type | Description |
|------|------|
| `agent` | A single Agent instance |
| `tool` | A tool invoked by the Agent |
| `task` | A task executed by the Agent |
| `workflow` | A multi-Agent orchestration process |
| `human` | A human approver |
| `guardian` | Supervisor |

Field references in rules (e.g. `tool.name`, `context.amount`) use Entities as their semantic namespace. Field paths are load-bearing: a field name is frozen once published (`[FREEZE-1]`), and aliases MUST be normalized to the canonical name first.

---

## 4. Rule Definition

Rule is the core unit of ERDL: `Rule = Metadata + When (condition) + Then (action) + Audit (audit)`. When compiles to an expression tree (§5), Then is a decision type (§6), and Audit records the audit information of the rule's evaluation.

### 4.1 Field Definitions

The `rules[]` sub-field order MUST be fixed: `name` → `description` → `category` → `priority` → `override` → `ring` → `tier` → `enabled` → `when` → `gloss` → `then` → `message` → `instruction` → `correction` → `unless` → `explanation` → `alternative` → `legal_basis` → `source_text`.

| Field | Type | Required | Description |
|------|------|:---:|------|
| `name` | string | MUST | Unique rule identifier, format `[CAT]-[NNN]-description` |
| `description` | string | MUST | Human-readable description |
| `category` | string | MAY | Rule-level category; defaults to `metadata.category` (see §2.2), allows mixed categories within one document |
| `priority` | integer | MUST | Smaller number = higher precedence (see §7.1) |
| `override` | string | SHOULD | Override level: critical > high > normal > low (default normal) |
| `ring` | integer | SHOULD | Execution ring: 0 kernel / 1 recovery / 2 approval / 3 advisory |
| `tier` | integer | MAY | Rule tier 0–5 (0–2 safety baseline MUST use Simple, ≥3 business scope may use Expression); tier governs the writing form only, not the evaluation-error fold (see E12) |
| `enabled` | boolean | MAY | Rule enable flag (default true); `false` skips the rule during evaluation |
| `when` | object | MUST | Trigger condition (see §5) |
| `gloss` | string | MUST | Natural-language readable projection rendered by the engine from the `when` tree (§5.5); lint checks `gloss == render(tree)`, hand-writing forbidden; does not enter the hash (G4) |
| `then` | string | MUST | Decision type (see §6) |
| `message` | string | SHOULD | Decision message (blocking `then` MUST be non-empty) |
| `instruction` | string | MAY | Advisory instruction (for the ALLOW + instruction case) |
| `correction` | string | MAY | Correction text (CORRECT decision; source of the evaluation output `primary_correction`, see §7.0.3) |
| `unless` | object/null | MAY | Exemption condition block (optional) |
| `explanation` | string / object | MAY | Bilingual explanation (why the rule exists and what harm it prevents) |
| `alternative` | string / object | MAY | Suggested alternative action when blocked |
| `legal_basis` | string | MAY | Legal basis (citation of the regulation clause) |
| `source_text` | string | MAY | Excerpt of the original regulation text |

### 4.2 Complete Example

```yaml
protocol: "erdl/v2"
version: "2.2.0"
metadata:
  name: "my-first-rule-set"
  description: "Allow file read operations"
  category: coding
  decision: ALLOW
  tags: [example]
rules:
  - name: "COD-001-allow-read"
    description: "Allow all read_file tool calls"
    priority: 10
    override: high
    ring: 3
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: eq
          value: "read_file"
    gloss: "tool.name equals read_file"  # engine-generated (G2), lint-enforced
    then: ALLOW
    message: "read_file call allowed"
    unless: null
```

---

## 5. The `when` Condition Expression

`when` is the rule's embedded condition expression. ERDL provides three **writing forms** (Simple / Expression / Decision Table), any of which compiles and normalizes to the same semantic kernel (the expression tree) and can be rendered back into any form; there is additionally a **readable projection** gloss (§5.5) deterministically generated from the tree as natural language.

### 5.1 Writing Forms (Projections)

| Projection | Carries | Applicable tier | Description |
|--------|------|:---:|------|
| **A · Simple** | 30 operators | 0–2 (MUST) | Safety baseline, the most common writing form |
| **B · Expression** | full 34-node tree | ≥3 | Business panorama: logic/quantifiers/arithmetic/time/aggregation |
| **C · Decision Table** | matrix | — | Preferred by business/finance staff; compiles to the same kernel |

The three forms share the same semantics, differing only in expressiveness and tier authorization. **tier is a rule hierarchy level (0–5)**, ordered low-to-high by the rule's constraint strength and scope — in this document, tier 0–2 is the safety baseline (MUST use Simple), and tier ≥3 is the business panorama (Expression may be used). `when` and `expr` MUST NOT coexist (E5).

### 5.2 Projection A: Simple (30 Operators)

Simple is the preserved, existing set of semantic units — **30 operators = 28 conditions + 2 modifiers**, unchanged. It corresponds to system safety rules (tier 0–2).

#### 5.2.1 Set definition

| Family | Count | Operators |
|----|------|--------|
| Comparison | 6 | eq · ne · gt · gte · lt · lte |
| List | 2 | in · not_in |
| String | 5 | contains · not_contains · match · starts_with · ends_with |
| Boundary negation | 2 | not_starts_with · not_ends_with |
| Existence | 2 | exists · not_exists |
| Length | 5 | length_gt · length_gte · length_lt · length_lte · length_eq |
| Range | 2 | between · not_between |
| Count | 4 | count_gt · count_gte · count_lt · count_lte |
| Modifier | 2 | within (time window) · rate (rate limit) |

#### 5.2.2 Semantic conventions

- **Strict type matching**: no implicit type conversion; `"100" gt 50` is always false;
- **Same-type ordered comparison**: numbers use numeric order, strings use lexicographic order (Unicode code point order; `"2" gt "10"` is true); cross-type returns false;
- **match is case-sensitive**: regex matching is case-sensitive by default, with no inline case-insensitive option;
- **between is numeric-only**: the closed interval `[min,max]` supports only numbers; non-numeric returns false;
- **Null propagation**: when a field is missing, everything except exists/not_exists returns false (safe failure);
- **Existence is the sole discriminator**: only exists/not_exists distinguish "missing" from "value mismatch";
- **List limit**: in/not_in operands ≤256 items;
- **Determinism guarantee**: executed by a closed evaluation kernel, with no code injection path;
- **Lenient aliases**: an implementation MAY accept two historical aliases and normalize them — `matches` → `match`, `neq` → `ne`. Aliases are not new operators (still the 30-operator set); the canonical form MUST use the canonical name, and aliases never enter the tree or the hash. Not implementing aliases is still conformant.

#### 5.2.3 Authoritative compile mapping

**Authoritative compile mapping**: all 30 operators have a definite compile target, with none dangling — **13 direct nodes** (eq/ne/gt/gte/lt/lte·in·contains/starts_with/ends_with/match·exists·between), **6 not-derived** (not_in/not_contains/not_starts_with/not_ends_with/not_exists/not_between), **9 length/count compositions** (length_* 5 + count_* 4), **2 time modifiers** (within/rate).

| # | Simple operator | Compile target | Expression tree form |
|:---:|------|:---:|------|
| 1-6 | `eq` `ne` `gt` `gte` `lt` `lte` | direct node | comparison node |
| 7 | `in` | direct node | set node in |
| 8 | `not_in` | not + exists guard | `exists(field) AND not(in(...))` |
| 9-12 | `contains` `starts_with` `ends_with` `match` | direct node | string node |
| 13 | `not_contains` | not + exists guard | `exists(field) AND not(contains(...))` |
| 14-15 | `not_starts_with` `not_ends_with` | not + exists guard | `exists(field) AND not(...)` |
| 16 | `exists` | direct node | existence node (value non-`null` and non-`undefined`; empty string `""`, `0`, `false` all count as "existing" — "existing" ≠ "non-empty string") |
| 17 | `not_exists` | not composition | `not(exists(...))` |
| 18-22 | `length_gt/gte/lt/lte/eq` | composition + exists guard | `exists(field) AND length(field) compare n` |
| 23 | `between` | direct node | range node (numeric only) |
| 24 | `not_between` | not + exists guard | `exists(field) AND not(between(...))` |
| 25-28 | `count_gt/gte/lt/lte` | composition + exists guard | `exists(field) AND aggregate(count(...)) compare n` |
| 29 | `within` | time modifier | time window (as_of injected by engine) |
| 30 | `rate` | time modifier + aggregate | rate limit (temporal_state) |

#### 5.2.4 exists guard (E11 compile-layer guarantee)

**exists guard (compile-layer guarantee of E11 null propagation)**: the `not_*` operators (except `not_exists`) and the `length_*`/`count_*` compositions MUST compile to `exists(field) AND <derived expression>`, not a bare `not(positive operator)` or a bare `length/count(...) comparison`. Reason: a positive operator returns false for a missing field and `length(missing)` returns 0; a direct `not` flip or numeric comparison would break null propagation (fail-open). `not_exists` is the sole exception — its semantics are "perceive field missing", so it stays a bare `not(exists(...))`.

#### 5.2.5 Stateful operators (within/rate)

**Stateful operators (within/rate)**: `within` and `rate` are the only two stateful operators, whose evaluation depends on sliding-window counts across decisions. This state is not stored in the expression tree node but is maintained by a separate Guard state manager, entering the audit record as the `temporal_state` field — the expression tree itself remains a pure function (E1 holds), while the state source is auditable and recomputable.

**Stateful operator truth semantics (MUST)**: count reaches threshold → condition holds (trigger); below threshold → record this event and return false (allow).

| Operator | Threshold | First/under-limit | After threshold |
|---|---|---|---|
| `rate: "N/window"` | N | first N times: record + false | from the (N+1)-th time: true |
| `within: "window"` | 1 | first: record + false | from the 2nd time in window: true (dedup) |

Supporting constraints (all MUST): ① post-counting (count only when the positive condition holds); ② count isolation key (`within` keys on `field+operator+value`, `rate` keys on `field+operator+value+rate`); ③ record timing in the "under-limit" branch.

### 5.3 Projection B: Expression (34-Node Tree)

#### 5.3.1 Node set (34 nodes, 10 groups)

Expression opens the kernel's full expressive power for complex business rules (tier ≥3). The semantic kernel is a **typed expression tree** of **34 nodes** (in **10 groups**), frozen at `[FREEZE-2]`:

| Group | Nodes | Semantic capability |
|----|------|---------|
| Value | field · var · literal | reference fields, context variables, constants (`var` only `$`/`$.path`; MUST NOT read clock or randomness) |
| Logic | and · or · not | composition |
| Comparison | eq · ne · gt · gte · lt · lte | operands may be field, variable, literal, or arithmetic subtree |
| Set | in | scalar ∈ set |
| String | contains · match · starts_with · ends_with | pattern matching; match uses safe regex |
| Existence/measure | exists · length · between | existence, length (Unicode code points), closed interval |
| Quantifier | all · any · none | per-element array judgment; empty array always false |
| Arithmetic | add · sub · mul · div · round | fixed-point deterministic arithmetic |
| Time | days_between · epoch_ms · date_add · date_part · month_last_day | date difference, timestamp, date arithmetic, component extraction, last day of month |
| Aggregate | aggregate (count/sum/avg/min/max) | array aggregation |

> Node total: Value 3 + Logic 3 + Comparison 6 + Set 1 + String 4 + Existence/measure 3 + Quantifier 3 + Arithmetic 5 + Time 5 + Aggregate 1 = **34**. The 6 comparison operators, 4 string operators, 5 arithmetic operators, 3 quantifier kinds, and 5 aggregate functions are carried by parameterized node types in implementations (e.g. `compare{op}`, `string{op}`, `arith{op}`, `quantifier{kind}`, `aggregate{fn}`), so the "34 semantic nodes" map to fewer type literals in code — this is the relationship between semantic nodes and type projections, not a count contradiction.

#### 5.3.2 Expression writing example

**Expression writing example**:

```yaml
when:
  expr:
    lt:
      - div:
          - sub: [{ field: "tool.args.price" }, { field: "context.cost" }]
          - field: "tool.args.price"
      - 0.15
```

### 5.4 Projection C: Decision Table (Matrix Form)

#### 5.4.1 Structure and example

The decision table faces business and finance staff, expressing multi-condition combinations in row-column structure, compiled to the same kernel:

```yaml
kind: decision_table
columns:
  - field: "context.amount"
    label: "application amount"
rows:
  - when: [["gte", 10000]]
    then: "REQUEST_HUMAN"
    priority: 100
  - when: [["gte", 5000]]
    then: "ESCALATE"
    priority: 90
  - when: []                       # default row (unconditional, fallback)
    then: "ALLOW"
    priority: 1
```

#### 5.4.2 Compile rules (E7)

Compile rules (E7): ① each row's `when` condition group compiles to logical AND in field-column order, and each condition unit compiles to a comparison node; ② row order is precedence (first match from top, consistent with `priority`; the two MUST NOT conflict); ③ the default row `when: []` compiles to literal `true`; ④ `then` MUST belong to the §6 decision type enumeration; ⑤ the compiled tree is identical to a hand-written Simple/Expression tree.

### 5.5 Projection D: gloss (Natural-Language Readable Projection)

gloss is natural-language text **deterministically generated** from the tree:

```yaml
gloss: "when (sale price minus cost) divided by sale price is less than 15%, human approval is required"   # engine-generated, lint-enforced
```

#### 5.5.1 Five invariants (G1–G5)

**Five invariants (all MUST)**:

| # | Invariant |
|---|--------|
| G1 | gloss = render(tree): deterministically generated by a frozen rendering template |
| G2 | every rule and every transition rule MUST carry gloss; lint checks `gloss == render(tree)`; hand-writing forbidden |
| G3 | gloss forbids raw field paths and MUST use the Entity's display_name (bilingual; except `event.*` payload keys, see §5.5) |
| G4 | gloss is a render product (does not enter the hash); displayed via live `render(tree)` |
| G5 | Simple rules also generate gloss (rendered after compiling to a tree) — the reading layer is uniform |

#### 5.5.2 Rendering templates (per node)

**gloss rendering templates** (per node, **English as canonical**; `{A}`/`{B}`/`{C}` are recursive render results of sub-expressions):

| Node | English template |
|------|------------------|
| `field` | `{field}` |
| `var` | `$ or path` |
| `literal` | `{value}` |
| `and` | `{A} and {B}` |
| `or` | `{A} or {B}` |
| `not` | `not ({A})` |
| `eq` | `{A} equals {B}` |
| `ne` | `{A} does not equal {B}` |
| `gt` | `{A} is greater than {B}` |
| `gte` | `{A} is greater than or equal to {B}` |
| `lt` | `{A} is less than {B}` |
| `lte` | `{A} is less than or equal to {B}` |
| `in` | `{A} in {B}` |
| `contains` | `{A} contains {B}` |
| `match` | `{A} matches {B}` |
| `starts_with` | `{A} starts with {B}` |
| `ends_with` | `{A} ends with {B}` |
| `exists` | `{A} exists` |
| `length` | `length of {A}` |
| `between` | `{A} is in the inclusive range {B} to {C}` |
| `all` | `all elements in {A} satisfy "{B}"` |
| `any` | `at least one element in {A} satisfy "{B}"` |
| `none` | `no elements in {A} satisfy "{B}"` |
| `add` | `{A} plus {B}` |
| `sub` | `{A} minus {B}` |
| `mul` | `{A} times {B}` |
| `div` | `{A} divided by {B}` |
| `round` | `{A} rounded` |
| `days_between` | `days between {A} and {B}` |
| `epoch_ms` | `epoch ms of {A}` |
| `date_add` | `{A} plus {B} {unit}` |
| `date_part` | `{part} of {A}` |
| `month_last_day` | `the last day of the month of {A}` |
| `aggregate(count)` | `count of {A}` |
| `aggregate(sum)` | `sum of {A}` |
| `aggregate(avg)` | `average of {A}` |
| `aggregate(min)` | `minimum of {A}` |
| `aggregate(max)` | `maximum of {A}` |

#### 5.5.3 Special rendering rules

> **state.* gloss rendering (G3)**: a field node whose path's first segment is `state` renders the `state.<name>` `display_name` (`en`, G3, §6a.1), falling back to the variable name; the `exists` boolean special case **does not apply** to state fields (state enum values are non-boolean; `exists(state.x)` is always "variable declared and always has a value", independent of the enum value).

> **event.* gloss rendering (G3)**: a field node whose path's first segment is `event` (only in `transitions[].when`, §6a.7) renders its four reserved fields as fixed English readable names: `event.event_id` → event id, `event.on` → event name, `event.actor` → event actor, `event.at` → event time; a payload key `event.<key>` has no display_name and renders as the bare key name.

> **`exists` boolean-field special case**: when the field name matches `is_*`/`has_*` (boolean-field convention), `exists` renders as `{A} is true` instead of `{A} exists` — boolean fields are true when present, avoiding awkward phrasing (e.g. "has been notified exists").

> **Gloss rendering details (must be reproduced exactly across implementations)**:
> - `not(eq({A},{B}))` **normalizes** to the `ne` template (`{A} does not equal {B}`), not a literal `not ({A} equals {B})` nesting;
> - string literals render **quoted** (`"rm"`), and list literals render their string members quoted (`["a", "b"]`);
> - arithmetic nodes (`add`/`sub`/`mul`/`div`) render **parenthesized** (`(a plus b)`) to preserve operator precedence in the natural-language reading.

---

## 6. `then` Decision Types

The value of `then` MUST belong to the following 13 decision types:

| # | Decision type | Semantics |
|---|---------|------|
| 1 | ALLOW | allow |
| 2 | DENY | block |
| 3 | CORRECT | correct deviation |
| 4 | NOTIFY | notify |
| 5 | REQUEST_HUMAN | request human adjudication |
| 6 | ESCALATE | escalate |
| 7 | DELEGATE | delegate |
| 8 | DEFER | defer |
| 9 | EMERGENCY_HALT | emergency stop |
| 10 | ROLLBACK | roll back |
| 11 | QUARANTINE | quarantine |
| 12 | WORKFLOW | workflow (state machine; substates WORKFLOW_WAITING / WORKFLOW_PROGRESS; **note: distinct from the §6a authority state machine**) |
| 13 | GUIDE | guide |

**Why 13 decision types (design rationale)**:

Traditional IT rule engines and access control are **binary** — ALLOW or DENY. They assume the decider is "the system", which only needs to answer "allow or deny".

But in the AI era, the thing being decided on is an **understanding but not fully reliable** LLM. Faced with an LLM's output, a simple "deny" is **giving up** — it discards all the work the LLM has done and forfeits the chance to "correct once and keep going". This specification's design principle is: **deterministic rules exist not to reject the LLM, but to maximize the LLM's value while keeping the safety floor.**

The 13 decision types unfold that principle into five groups:

| Group | Decision types | Meaning |
|-------|---------------|---------|
| Allow vs. block | ALLOW / DENY | the binary floor — allow when clearly safe, block when clearly out of bounds |
| Guide, don't abandon | CORRECT / GUIDE | when the LLM output deviates, correct or guide it back, rather than discarding the whole output |
| Human-in-the-loop | REQUEST_HUMAN / ESCALATE / DELEGATE / DEFER | when uncertain, bring in human adjudication, escalation, delegation, or deferral — hand "what the machine can't resolve" to "people or process" |
| Safety fallback | EMERGENCY_HALT / ROLLBACK / QUARANTINE | intervene decisively on danger — halt, roll back committed side effects, quarantine suspicious objects |
| Process | NOTIFY / WORKFLOW | notify (record without blocking), workflow (enter a multi-step state machine) |

In one line: **traditional IT asks "allow or deny"; ERDL asks "how to let the LLM do better under control".** DENY is the last resort, not the only resort.

---

## 6a. State Blocks and State Transitions (Controlled State Source)

Session-level state — delegated authority, revocation, approval flows — needs to be declared explicitly. This section defines the **state space** (`state`) and **state transition rules** (`transitions`), generalizing the §5.2 within/rate "tree-external counter state" into **named authority state**. The state body is held by the engine (outside the expression-tree kernel); the expression-tree kernel (34 nodes) gains **no new nodes** — state is read-only injected via `state.*`.

**Hard boundary**: the state layer is a finite-state machine (FSM), not a Turing machine. The state space MUST be finite (enums + resource caps); arbitrary-length history, recursion, and pushdown stacks are rejected. Anything beyond FSM expressiveness (event sourcing) does not enter the engine.

**Layering boundary (single instance)**: a state variable is **document-instance single-key** — one state variable holds a single value within the current ERDL document instance. Per-entity / per-authorization-relation multi-instance state (e.g. the P→A grant and the A→B grant each need their own state) is carried by the organization layer instantiating one document per relation — **outside this section's scope** (§0 layering: the organization layer consumes ERDL primitives; this state block is a single-instance FSM primitive).

### 6a.1 State Space Declaration (state)

```yaml
state:
  - name: authorization          # state variable name, unique within the document
    values: [authorized, revoked]  # enum values (2–4 strings, unique within the list)
    initial: authorized          # initial state (MUST belong to values)
    display_name: { zh: 授权状态, en: authorization state }  # optional, gloss-readable name (G3)
```

| Field | Type | Required | Description |
|------|------|:---:|------|
| `name` | string | MUST | State variable name: non-empty string, MUST NOT contain `.` (avoids field dot-path parsing collision), MUST NOT be the reserved word `state`, unique within the document; `state.<name>` namespace |
| `values` | array | MUST | Enum value list: 2–4 non-empty strings, MUST NOT contain `.`, values MUST be unique; strings MUST be NFC-normalized (E10) before comparison |
| `initial` | string | MUST | Initial state, MUST be one of `values` |
| `display_name` | object | MAY | Bilingual readable name `{ zh, en }` (same as Entity convention, G3); gloss rendering of `state.<name>` uses the `en` value, falling back to `name` |

> A state variable is initialized to `initial` at document load and **always has a value** — there is no "runtime missing" state. To express "authorization not yet established" (unavailable), the author MUST declare an explicit sentinel value (e.g. `unestablished`) in `values` and set it as `initial`, rather than relying on null propagation.

### 6a.2 State Transition Rules (transitions)

A transition rule is the FSM's **F (transition function)** — deterministic, triggered only by an event:

The `transitions[]` sub-field order MUST be fixed: `on` → `name` → `audit_as` → `reason` → `enabled` → `when` → `gloss` → `set` (`name` is an optional field, MAY, same format as §4.1; `gloss` is a render product, MUST, see the gloss clause below).

```yaml
transitions:
  - on: revoke                  # triggering event name (the sole controlled-injection entry)
    name: "TR-001-revoke"       # optional, rule identifier (format per §4.1)
    audit_as: DELEGATE          # audit carrier only (does not participate in evaluation / short-circuit)
    reason: revoke              # transition semantic tag (distinguishes delegation vs revocation)
    enabled: true               # enable flag (default true)
    when: { ... }               # optional guard (expression tree; reads only state.* and event.*, not free fact)
    set:
      authorization: revoked    # state transition: state.authorization ← revoked
```

| Field | Type | Required | Description |
|------|------|:---:|------|
| `on` | string | MUST | Triggering event name (controlled injection, see §6a.3); MUST match `[a-z][a-z0-9_]{0,31}` (event names enter audit and hash; free Unicode adds normalization burden) |
| `name` | string | MAY | Transition rule identifier (format per §4.1's `[CAT]-[NNN]-description`); when absent, error attribution uses `(on, reason, definition ordinal)` |
| `audit_as` | string | MUST | **Audit carrier only** (see §6a.5): value narrowed to `{ALLOW, NOTIFY, DELEGATE, ESCALATE, REQUEST_HUMAN}`, MUST NOT be a restrictive type (DENY/EMERGENCY_HALT etc.); **does not participate** in §7.0.2 evaluation and triggers no short-circuit |
| `reason` | string | SHOULD | Transition semantic tag (e.g. `revoke`); MUST match `[a-z][a-z0-9_]{0,31}`, SHOULD be unique within the document (lint) |
| `enabled` | boolean | MAY | Enable flag (default true); when false the transition rule does not participate in event handling (gray-release / emergency disable without editing the document) |
| `when` | object | MAY | Guard condition (compiled to expression tree; reads only `state.*` and `event.*`, MUST NOT read free fact, see §6a.7) |
| `gloss` | string | MUST | Natural-language readable projection rendered by the engine from the `when` tree (§5.5); lint checks `gloss == render(tree)`, hand-writing forbidden; does not enter the hash (G4) |
| `set` | object | MUST | State transition mapping; keys are state variable names, values MUST be one of that variable's `values` |

> **transitions gloss (G2, MUST)**: like `rules[].when`, the `transitions[].when` guard expression tree is rendered to gloss by the engine (§5.5), with lint verifying `gloss == render(tree)` and forbidding hand-writing; `state.*`/`event.*` rendering is per §5.5. A transition rule's gloss serves **audit readability only** (not in the hash, same as G4) and does not change evaluation semantics.

#### 6a.2.1 Transition semantics

- **Event-handling atomicity (MUST)**: one `on` event is an **atomic transaction** — guards are evaluated one by one in `transitions` definition order (against the same pre-event snapshot); **evaluation stops at the first EvaluationError**, **no `set` is applied** (fail-closed), a `transition_error` audit event is recorded with its `error` taken from **that (first-failing) rule**, `errored=true` follows E3; type_mismatch-class warnings are handled only per §7.3(a) folding semantics (`errored=false`, not an error, and **do not stop** evaluation), but are **not recorded** — transition audit records have no warnings field (§6a.5); only after all guards pass is the full set of `set`s **committed at once**.

#### 6a.2.2 Guard constraints

- **Guards must not use stateful operators (MUST)**: `transitions[].when` MUST NOT use `within`/`rate` (load-time Error) — transition evaluation has no side-effect counting, consistent with the purity of "transitions do not count", avoiding the ambiguity of "does an event count once?".
- **Guard node whitelist and error folding (MUST)**: the `transitions[].when` node set MUST be: Simple condition operators (the 28 condition operators of §5.2) + logic nodes (`and`/`or`/`not`) + time nodes (`epoch_ms`/`days_between`/`date_add`/`date_part`/`month_last_day`, for freshness time comparison, §6a.7) + `field`/`literal`; MUST NOT use: quantifiers (`all`/`any`/`none`), arithmetic (`add`/`sub`/`mul`/`div`/`round`), aggregates (`count`/`sum`/`avg`/`min`/`max`), `fn` (function delegation), `within`/`rate` (stateful operators). Of these, `fn` is already outside the transition-guard compilable range (Grade C fallback, not kernel); this prohibition is an **explicit defense**, preventing implementers from mistakenly introducing fn into guards. Resource cap per the E4 Grade A quota (arith depth ≤2 / tree depth ≤6 / nodes ≤64); transition guard evaluation errors do **not** apply the E12 per-tier fold — they always follow §6a.2's atomic fail-closed (EvaluationError → no `set` committed, §6a.5).
- **Guards read pre-transition state**: `state.*` inside `when` reads the **state snapshot at event-arrival time** (i.e. before any of this event's transitions take effect), not the post-transition intermediate state — keeping the guard decision decoupled from the transition result and deterministic.
- **Order within one event must not affect the result**: the execution order of multiple transitions MUST NOT affect the result (guaranteed by snapshot semantics); implementations MUST NOT depend on the `transitions` definition order.
- Transition rules execute only when an event arrives, never during rule evaluation (`evaluate`) — the two are separated so evaluation has no side effects.
- **Event-handling timing and ordering (eager, MUST)**:
  - **eager**: an event is processed **at arrival** (acquiring the document-instance lock, §6a.5), never deferred to the next `evaluate()`; `evaluate()` and event handling are mutually exclusive under the instance lock, so the `state.*` that `evaluate()` reads at start is necessarily the state **after all arrived events have committed**;
  - **ordering**: events within an instance are processed **FIFO** by arrival order; a duplicate `event_id` is processed only once, the duplicate is dropped and logged **off-chain** (not in the hash chain);
  - **events with no matching transition**: no state change, no audit record, no `state_version` increment (deterministic silent drop).

#### 6a.2.3 Same-variable conflict check (decidable, sound)

- **Same-variable conflict check (decidable, sound, MUST)**: multiple `enabled` transition rules that `set` the same state variable to **different values** under the same `(on, state variable)` constitute a determinism conflict. The loader MUST complete the following deterministic check, rejecting rather than silently accepting (rules `set` to the **same value** are idempotent, no conflict, exempt):
  - (0) if there is an unconditional rule (`when` omitted, or whose compiled product is a literal `true` node — implementations MUST NOT constant-fold beyond literals, to avoid cross-implementation divergence), it MUST be the only rule under that `(on, state variable)`; coexistence with any other rule → Error;
  - (1) otherwise prove pairwise mutual exclusion, with **only top-level conjuncts admissible as proof basis**: Simple form = the `logic: AND` `conditions` elements (a single condition is itself a top-level conjunct); expr form = the direct children of a top-level `and` node; conditions nested under `or`/`not` must never be used as proof basis (treated as unprovable); **precision rule (MUST)**: in Simple form with `logic: OR`, the whole condition group is treated as a **single top-level conjunct** (OR sub-conditions are not conjuncts) — since it is not an `eq` conjunct, the pairwise proof always falls into (3) as unprovable — unless the `set` values are identical (idempotent, exempt);
  - (2) the only provably-exclusive cases are: (a) both rules have a top-level `eq` conjunct on the same `state.<v>` with different constants; (b) both rules have a top-level `eq`/`in` conjunct on the same field with disjoint constant sets (`eq` treated as a single-element set);
  - (3) all other combinations are treated as unprovable → Error, requiring the author to split the event name or state variable;
  - (4) `enabled: false` rules are excluded from the check (also inert at runtime), but when they conflict with `enabled` rules lint SHOULD warn — otherwise enabling one is instantly a violation.
  - With the `transitions` count cap (§6a.4), the pairwise check is O(n²) bounded.

#### 6a.2.4 Consistency and load-time validation

- **Same-event `audit_as` consistency (decidable, MUST)**: all `enabled` transition rules under the same `on` event name MUST have the same `audit_as` (one event type = one audit posture); a mismatch is a load-time Error. Rationale: the successful-transition record is event-granular (§6a.5) — one event = one record, one `audit_as` slot; if the rules within one event disagree on `audit_as`, the record has no unique value and two implementations would answer differently, forking the audit chain. `enabled: false` rules are excluded from the check, but lint SHOULD warn when they disagree with `enabled` rules' `audit_as`.
- A `set` value MUST belong to that variable's `values`; the transition direction (e.g. `authorized → revoked`) is determined by the `values` enum plus the `set` declaration — the engine executes only declared transitions and does not infer undeclared ones (fail-closed).
- **Reference to an undeclared state variable (load-time validation full set, MUST)**: the following are all rejected at load (Error) — not null-propagated at evaluation time:
  - (a) any expression position in the document (`rules[].when`, `rules[].unless`, `transitions[].when`, decision-table cells, `transitions[].set` keys) referencing `state.<name>` whose `<name>` is not declared in `state`;
  - (b) a field path that is exactly `"state"` (no path segment) — a bare `state` has no state-variable name and cannot be resolved, reject;
  - (c) `transitions[].when` referencing free fact (§6a.7);
  - (d) `rules[].when` / `rules[].unless` / decision-table cells referencing `event.*` — the `event` namespace exists only in the transition evaluation context (§6a.7); rule evaluation (§7.0.2) has no current event; such a reference is a load-time Error (otherwise it null-propagates to always-false under E11, silently dead rule — exactly the fail-silent that E11 exists to prevent).

### 6a.3 State Controlled Injection (Security Foundation)

- State variables are **controlled injection**: updatable only by `transitions` `set`, never writable directly by external parties (fact / caller).
- During evaluation, state is read-only injected into context via the `state.<name>` namespace — strictly isolated from fact fields (fact is externally writable; state is engine-held).
- **State scoping (MUST)**: only when a field path's **first segment is `state`** does it enter the controlled state namespace (e.g. `state.authorization`). Paths whose first segment is not `state` — `context.state.*`, `tool.state.*`, etc. — still resolve as fact; but lint SHOULD warn, to avoid reviewer misreading.
- `state` is a reserved namespace: fact top-level fields MUST NOT use `state` as a key, to avoid collision with the state snapshot; a field path exactly `"state"` (no path segment) is a load-time error (§6a.2).
- The expression-tree kernel gains **no new nodes**: `state.<name>` reuses the existing `field` node (the `state.` prefix routes to controlled state reads in resolveField).
- State variables always have a value (guaranteed by §6a.1 `initial`), so there is no "missing" semantics; referencing an undeclared state variable is a load-time error (§6a.2).
- **Evaluation-semantics anchoring (MUST)**: `state.*`'s evaluation semantics are **fully identical** to fact fields (all of §7.3 applies) — `gt`/`between`/`length` over a state value behave the same as over a fact field: `length(state.x)` for enum strings uses code-point length, `between` over a non-numeric is always false, string comparison follows E10 code-point order. The only difference: a declared variable has **no missing case** (E11 never fires).
- This guarantees fail-closed: revocation state cannot be bypassed by an external party "deleting a field" — the same controlled-injection mechanism as `as_of`/`temporal_state` (E1).

### 6a.4 Resource Caps (Anti-Bloat)

The state space MUST be finite; exceeding the caps rejects loading (Error):

| Dimension | Cap | Basis |
|------|:---:|------|
| State variable count (`state` array length) | ≤ 4 | authority / freshness / approval / task — four common state kinds |
| Single-variable `values` enum size | 2–4 | revocation 2 states (valid/revoked); authority/approval/task at most 3–4 states |
| State combination space (∏ values length) | ≤ 4⁴ = 256 | anti combinatorial explosion |
| Transition rule count (`transitions` array length) / document | ≤ 32 | bounds the pairwise mutual-exclusion check (§6a.2) to O(n²) |
| Distinct `on` event-name count | ≤ 16 | finite event-name space, anti unbounded growth |
| Event `payload` | ≤ 8 keys / depth ≤ 2 / single value ≤ 256B | controlled payload, anti large payload (§6a.7) |

> Delegation chain depth (the hop count of per-entity multi-instance) is an organization-layer constraint, not a single-instance FSM state-space dimension, and is outside this section's resource caps (§6a layering boundary).

### 6a.5 State Transition Audit Closure

State outside the kernel ≠ state un-auditable. Audit closes over three rings plus a cryptographic link ring, all required:

| Ring | Audits | Mechanism |
|---|---|---|
| ① Transition chain | every step of authorized→revoked | transition event = transition audit record (`audit_as` mapped to the §6a.2 narrowed set), `previous_hash` serial anchoring |
| ② Snapshot | the state value read at evaluation | `state_snapshot` enters the DO, in the hash preimage (§7.0.3) |
| ③ Validity | only transition rules may change state, in a legal direction | engine validates the transition (fail-closed); undeclared transitions do not execute |

#### 6a.5.1 `state_snapshot` structure

**`state_snapshot` structure (provenance anchoring, MUST)**: `state_snapshot` is:

```
{ values: { <state-variable-name>: <value> },   # the state variables actually read in this evaluation (on-demand, not the full state)
  state_version: <uint>,                        # starts at 0 (i.e. genesis); +1 per successfully committed event transaction
  transitions_head: <hash> }                    # hash of the most recent state-changing audit record; genesis hash initially
```

All three enter the DO hash preimage (§7.0.3). `state_version` and `transitions_head` anchor the snapshot **to the transition chain**:

- **state_version counting unit (MUST)**: +1 per **successfully committed event transaction** — multiple `set`s within one event merge into a single increment; starts at 0 (i.e. genesis).
- **transitions_head definition (MUST)**: the hash of the **most recent state-changing** audit record, initially the genesis hash; **no null branch**.
- **transition_error record's chain position**: a `transition_error` record (on EvaluationError, §6a.2) is **linked into the chain** via `previous_hash` (keeping the chain complete), but does **not apply `set`, does not increment `state_version`, and does not move `transitions_head`**.

#### 6a.5.2 Replay verification

- **Replay verification (MUST)**: **Step 0 (origin check)** — the verifier MUST first recompute the target document's document-level hash per the §6a.5 `doc_tree_hash` definition and compare it with the `doc_tree_hash` in the on-chain genesis record; a mismatch means the chain does not belong to this document (reject, preventing cross-document chain transplant); **Step 1 (traversal)** — traverse the full chain from genesis along `previous_hash`, applying each success record's `set` and incrementing the counter; when the counter == `state_version`, for every state variable appearing in `state_snapshot.values`, the replayed **full state**'s value for that variable MUST equal `values[variable]`, and the current record hash MUST equal `transitions_head`; `error` records are traversed only — not applied, not counted.

#### 6a.5.3 `state_snapshot` serialization normalization

- `values` keys are ordered by **state-variable-name UTF-8 code-point ascending**, serialized as a JSON object;
- string values are NFC-normalized (E10);
- the DO hash-preimage field order MUST be fixed — the explicit ordering (including the relative order of `temporal_state`, `state_snapshot`, `canonical_trees`) is listed in §8.2a.

Two implementations differing in any of key order / encoding / field order would compute different DO hashes, violating the "semantics = tree = hash" core promise — hence all three MUST be normalized.

#### 6a.5.4 Event injection authentication

**Event injection authentication (MUST)**: event injection MUST be engine-authenticated — the `actor` identity (§6a.7) enters the transition audit record; an unauthenticated event MUST be rejected (fail-closed). No arbitrary caller may inject `revoke`/`authorize` events.

> **audit_as is not proof of human approval**: `audit_as` is only an audit label and carries no approval proof; an attacker can inject a forged event with `actor: human-1`. The only auditable form of human approval = the authenticated identity layer injecting the event as a human identity (`actor` enters the chain) — `audit_as: REQUEST_HUMAN` does not mean "this transition is itself a human approval".

#### 6a.5.5 The three audit-record kinds

**Successful transition record (first-class on-chain record, MUST)**: a transition that successfully commits `set` produces a successful transition record, with the format:

```
{ type: "transition", event_id, on, actor, at, audit_as, set, state_version, previous_hash }
```

- `type` is fixed to `"transition"`;
- `audit_as` = the unified audit-carrier value of the `on` event (§6a.2 narrowed set + same-event consistency check), entering the hash preimage;
- `set` = the merged mapping of all rules' `set` in this transaction `{ <state-variable-name>: <value> }`, keys ordered by state-variable-name UTF-8 code-point ascending (same-variable same-value idempotent merge is guaranteed unambiguous by the conflict check);
- `state_version` = the version number after this transaction commits (= previous version + 1);
- `previous_hash` = the hash of the previous record on the chain (genesis or an earlier transition/transition_error);
- the full field order and fixed key set are in §8.2a.

**transition_error record (first-class on-chain record, MUST)**: a `transition_error` (on EvaluationError, §6a.2) is a first-class on-chain record with the format:

```
{ type: "transition_error", event_id, on, actor, at, audit_as, error, errored: true, previous_hash }
```

- `audit_as` = the unified audit-carrier value of the `on` event (§6a.2 narrowed set + same-event consistency check);
- `error` = the error description of the first (in `transitions` definition order) EvaluationError rule (§6a.2 event-handling atomicity: stop at first);
- On-chain: linked into the chain via `previous_hash` (keeping the chain complete);
- Does not apply `set`, does not move `transitions_head`, does not increment `state_version` (consistent with the P0-4 replay verification);
- has no `set`/`state_version` field, `errored` is always `true`; the full field order and fixed key set are in §8.2a.

> **Guard warnings not recorded (MUST)**: a transition guard's type_mismatch warning only affects the evaluation fold (§7.3(a), `errored=false`) and is **not recorded** — neither success nor error transition records carry a warnings field; the guard's audit focus is the transition outcome (whether `set` commits), not evaluation-process warnings.

**Rejected-event disposition (MUST, on-chain / off-chain separation)**: unauthenticated, duplicate-`event_id`, and over-resource-cap events MUST NOT enter the hash chain; they are recorded in **off-chain audit storage** (`actor` if known, event name, `event_id`, rejection reason, content sanitized before persisting) — **on-chain holds only trusted records, off-chain holds intrusion traces**. This ensures: the auditor sees the full trusted state-transition history on-chain, and sees injection attempts / replays / over-limit attacks off-chain, without cross-contamination.

**Genesis record (MUST)**: at document load the engine MUST generate a genesis audit record for `initial` (initial snapshot + document canonical-tree hash). This is the starting point of transition chain ① — a document with `initial=authorized` can answer on-chain "why it was authorized to begin with".

**Genesis preimage byte-level definition (MUST)**:

- `doc_tree_hash` = `sha256(JCS({ metadata.name, state declaration, transitions declaration, the rules' canonical_tree array }))` — a document-level canonical form (distinct from §8.2's expression-tree-level canonical);
- genesis preimage = `{ type: "genesis", protocol, doc_tree_hash, initial: {variable names code-point ascending}, at, previous_hash: null }`.

Here `initial`'s keys are ordered by state-variable-name UTF-8 code-point ascending; the `previous_hash: null` key is not omitted (fixed key set). The three kinds' full field order and fixed key set are in §8.2a.

> `initial` (genesis record) and `state_snapshot.values` (§7.0.3) are both "state-variable → value" mappings, but belong to two different preimages — the genesis record and the DO evaluation result — with their own fixed field names: `initial` expresses the initial state, `values` expresses the current state read at evaluation; implementers MUST serialize under each respective field name and MUST NOT conflate them.

#### 6a.5.6 Rejected-event disposition and concurrency

**Normative guidance (SHOULD)**: documents carrying authorization semantics SHOULD set `initial` to the most conservative sentinel (`unestablished`/`revoked`); an explicit bootstrap authorization must go through a transition event **with an `actor`**, leaving on-chain provenance, rather than a groundless `initial=authorized`.

**Concurrency semantics (per document instance MUST serialize)**: event handling and `evaluate()` on the same document instance MUST be mutually exclusive; the `state_snapshot` that `evaluate()` sees is a consistent snapshot at evaluation start, no intermediate state allowed.

> Ring ③ is what the snapshot model (state materialized externally) cannot do, and is the core of an explicit state machine: the engine verifies "how the state legally arrived here" instead of accepting external state wholesale.

### 6a.6 Relationship to within/rate

`within`/`rate` are an extremely narrow special case of this FSM (state=counter, transition=+1, output=over-limit). State blocks generalize them without changing their existing semantics. The two coexist: `within`/`rate` remain injected via `temporal_state`; state blocks are injected via `state.*`. **State blocks and within/rate counters do not share a namespace**: state blocks use `state.<name>` (driven by the §6a.1 `state` declaration), within/rate use `field+operator+value` (§5.2 count-isolation key) — the two key-isolation rules are independent and do not collide.

### 6a.7 Event and Transition Evaluation Context (Controlled Injection)

Transition-rule guard evaluation is likewise brought into the "controlled injection" model (E1) and **does not read free fact**. The event object, guard context, and compilation discipline MUST be as follows:

#### 6a.7.1 Event object structure

**Event object**, structure MUST be:

```yaml
event:
  event_id: "evt-2026-09-12-0001"   # unique within the document; replay-deduplication basis
  on: revoke            # event name (matches transitions.on)
  at: "2026-09-12T10:00:00Z"  # engine-injected UTC moment (the transition evaluation's as_of)
  actor: "agent-A"      # authenticated event-source identifier
  payload: { ... }      # restricted payload (see below)
```

| Field | Type | Description |
|------|------|------|
| `event_id` | string | Unique within the document; replay-deduplication basis (the same `event_id` is processed only once) |
| `on` | string | Event name, matching `transitions.on` |
| `at` | string | Engine-injected UTC moment (the transition evaluation's as_of); MUST NOT be supplied externally (E9 no-wall-clock applies equally) |
| `actor` | string | Authenticated event-source identifier (provided by the identity layer, not self-asserted by payload); string MUST be NFC-normalized (E10, enters the transition-audit-record hash preimage) |
| `payload` | object | Restricted payload: ≤8 keys, depth ≤2, scalar leaf values, single value ≤256B; keys MUST NOT contain `.` and MUST NOT be the four reserved field names (`event_id`/`on`/`actor`/`at`) |

#### 6a.7.2 event.* resolution mechanism

**event.* resolution mechanism (MUST)**:

- `event.*` reuses the field node's first-segment interception just like `state.*` (in resolveField, a first segment of `event` routes to controlled event reads);
- **readable fields** = `event.event_id` / `event.on` / `event.actor` / `event.at` + payload keys (bound to the `event.<key>` namespace); a payload key's value may be an object (depth ≤2), and guards may read a nested `event.<key>.<sub>` path (depth ≤2), resolved like a fact field path (§3);
- **a non-existent key** null-propagates to false per E11 (`exists`/`not_exists` can sense absence);
- **payload strings MUST be NFC-normalized before evaluation (E10)**.

#### 6a.7.3 Transition evaluation context (the input to when)

**Transition evaluation context (the input to when)**: the `when` guard's evaluation context MUST be only the following two kinds, and MUST NOT read free fact:

1. **Pre-transition state snapshot** `state.*` (the state before any of this event's transitions take effect, §6a.2);
2. **Event object** `event.*` (`event.event_id`/`event.on`/`event.actor`/`event.at` + payload keys `event.<key>`; `event.at` is the engine-injected UTC moment, i.e. the transition evaluation's as_of).

A guard reading any field outside `state.*` and `event.*` (free fact) MUST be rejected at load (Error, see §6a.2 load-time validation full set).

#### 6a.7.4 Compilation and evaluation discipline

**Compilation and evaluation discipline**: transition evaluation MUST go through the same single compilation pipeline as rule evaluation (E7); its warning / errored conventions are fully consistent with §7.3.

#### 6a.7.5 Time and freshness (no time trigger)

**Time and freshness (no time trigger, MUST)**: the state machine has **no time trigger** — transitions are event-driven only, state never expires on its own. When a "freshness" state (e.g. `fresh`/`stale`) is needed, choose one of two modes:

1. **External sweeper injection**: the organization layer periodically injects an `on: expire` event, driving the `fresh → stale` transition (the engine keeps no timer);
2. **Guard time comparison**: `when` compares expiry moments using `event.at` / `epoch_ms`, deciding expiry at event arrival (no background timer).

Example (authorization expiry, mode 2):

```yaml
state:
  - name: authorization
    values: [authorized, revoked]
    initial: revoked
transitions:
  - on: exercise
    audit_as: ESCALATE
    reason: auth_expired
    when:
      gt:
        - epoch_ms: { field: "event.at" }
        - epoch_ms: { field: "event.expires" }
    set: { authorization: revoked }
```

> The engine does not "auto-expire over time" — time exists only as a controlled event attribute (`event.at`) or as a guard time-comparison input, consistent with E9 (no wall clock, controlled `as_of` injection).

---

### 6a.8 Enforcement-Boundary Check/Act Atomicity (Integration Requirement)

§6a's authority state is consumed by an **enforcement boundary** (the Action Guard / tool-call guard, §9.1) that gates security-sensitive side effects. `evaluate()` is a pure function (E1): it returns a decision plus a `state_snapshot = { values, state_version, transitions_head }` (§7.0.3), but it does **not** itself commit the gated side effect — that commit happens in the enforcement boundary, a distinct component, after `evaluate()` returns and releases the instance lock.

This leaves a check/act window: `evaluate()` may return `ALLOW` against `state_version = N`, a `revoke` event may then commit `state_version = N+1` before the effect lands, and the effect would still execute under a now-superseded authorization lineage.

**Enforcement-boundary re-validation (MUST)**: for a security-sensitive side effect whose authorization depends on §6a state, the enforcement boundary MUST ensure that no state-change event affecting the authorization lineage commits between the state version used for the authorization decision and the commit of the protected effect. A conforming boundary satisfies this by one of:

1. **Atomic re-validation**: immediately before committing the effect, re-read the document's current `{ state_version, transitions_head }` under the instance lock (§6a.5) and compare it with the decision's `state_snapshot`; on any mismatch, fail closed (do not execute — treat as unavailable/stale authority, AV-05/AV-10/AV-14 semantics); or
2. **Equivalent closure of the synchronous boundary**: hold the relevant lock (or an equivalent serialization guarantee) across the effect commit so no transition event can interleave between check and act.

**Layering (engine vs. boundary)**: the engine MUST expose the re-validation primitive — the current `state_version`/`transitions_head` readable under the instance lock — but it does **not** execute the side effect and does **not** hold the lock across the effect commit on the boundary's behalf (E1: evaluation is pure; the commit is outside the engine). Check/act atomicity is therefore an **integration obligation** the enforcement boundary discharges by re-validating against the engine's snapshot anchor, not an engine-side side-effect-execution guarantee.

**Adversarial conformance vector (V-STATE)**: `authorized@N → evaluate(ALLOW@N) → revoke@N+1 (before effect commit) → attempt the effect`. Expected: the effect MUST NOT execute under the stale `ALLOW`; the boundary re-validates and fails closed (or otherwise closes the boundary). This is the stateful continuation of AV-05 / AV-10 at the execution boundary.

### 6a.9 Latest-Authoritative-Head Freshness (Anti-Rollback, Integration Requirement)

§6a.5's replay verification proves that a snapshot is consistent with a valid transition-chain prefix (integrity/provenance), but it does **not** prove that the prefix is the current latest authoritative prefix (freshness). The two MUST be distinguished.

**Rollback attack (adversarial scenario)**: `authorized@N / HN` → `revoke` commits `@N+1 / HN+1` → a restart/recovery/replica restoration presents a valid historical prefix ending at `{N, HN}` → replay verification of that prefix **succeeds** (it was not forged or modified, only superseded) → evaluation sees `authorization = authorized` → the enforcement boundary re-validates against the same restored instance and again observes `{N, HN}`. Result: a previously revoked authorization becomes exercisable again without violating the existing hash-chain replay checks.

**Latest-authoritative-head freshness (MUST)**: for a security-sensitive side effect whose authorization depends on §6a state, the enforcement/recovery boundary MUST ensure that the accepted `{ state_version, transitions_head }` is the latest authoritative state for the same document instance — not a historical prefix superseded by a later authoritative state. A conforming boundary satisfies this by one of:

1. **Monotonic external anchor**: establish the latest authoritative head via a monotonically increasing external epoch (or a durable latest-head anchor, a signed/versioned checkpoint, a consensus-backed state version); or
2. **Equivalent anti-rollback mechanism**: any implementation-neutral equivalent mechanism that prevents a superseded historical prefix from being accepted as current.

If the freshness of the latest authoritative state cannot be established, the authority exercise MUST fail closed (treat as unavailable/stale authority, AV-05/AV-10/AV-14 semantics).

**Layering (engine vs. boundary)**: hash-chain integrity is guaranteed by the engine (§6a.5); latest-authoritative-head freshness across restart/recovery/replica boundaries is an **integration obligation** the enforcement/recovery boundary discharges via an external anchor — the engine maintains no cross-instance persistent epoch and does not decide recovery policy on the boundary's behalf (E1: evaluation is pure). The **durable freshness anchor is provided by the organization/deployment layer**; and the fail-closed property MUST be preserved: if the enforcement boundary cannot establish that the restored `{ state_version, transitions_head }` is sufficiently fresh relative to the authoritative persistence state, authority-bearing effects MUST NOT proceed — successful replay/integrity verification is never sufficient evidence that authority is still current.

**Adversarial conformance vector (V-STATE)**: `authorized@N / HN → revoke commits @N+1 / HN+1 → restore a valid historical prefix (ending at @N / HN) → replay verification succeeds → evaluate a protected action → attempt the effect`. Expected: the protected effect MUST NOT execute using the superseded authority state; the system MUST establish that `{N, HN}` is still the latest authoritative state, discover that it has been superseded, or fail closed when freshness cannot be established.

### 6a.10 Authorization-Root Provenance for Establishing/Re-establishing Authority (Integration Requirement)

§6a.2 models `authorize`/`revoke` uniformly as event-triggered state transitions (the FSM's F function), with event injection authenticated by `actor` (§6a.5.4). But `actor` authentication only proves "who triggered the event", it does **not** prove "whether the triggerer is entitled to establish that authority". Without constraining the provenance of establishing/re-establishing authority, revocation degenerates into a reversible local state bit — a revoked subject can flip `revoked → authorized` by merely triggering an `authorize`/`re-authorize` transition without proving where the renewed authority came from.

**Authorization-root provenance (MUST)**: for a state variable carrying authorization semantics, any transition that makes the authority exercisable (i.e. a `set` that moves the variable into an "exercisable" value such as `authorized`) MUST carry authorization-root provenance — the triggering event's `actor` MUST be attributable to a principal/authority entitled to establish/re-establish that authority (the authorization root), not the authorized subject itself. After revocation, a `revoked → authorized` re-authorization MUST be supported by a new valid authorization basis; a local state transition alone (without authorization-root provenance) MUST NOT make the authority exercisable again. A descendant or previously-authorized subject MUST NOT restore its own revoked authority by merely triggering an `authorize`/`re-authorize` state transition.

**Layering (engine vs. boundary)**: the engine exposes an identifiable marker for "authority-establishing/re-establishing" transitions (the `reason` semantic marker, e.g. `reason: authorize`) and records `actor` into the transition audit chain (§6a.5.4, already present); **determining authorization-root eligibility (who is entitled to establish that authority) is an integration obligation of the enforcement boundary / organization layer** — the §6a single-instance FSM does not model the P→A→B authority chain (§6a.1 layering boundary); who is entitled to authorize is adjudicated by the organization layer. Before committing an `authorize`/`re-authorize` event the enforcement boundary MUST verify the `actor`'s authorization-root eligibility; when the authorization root cannot be established, it MUST fail closed (treated as unavailable/unauthorized, AV-05 / AV-10 / AV-14 semantics).

**Interface to organization-layer invariants**: this section's authorization-root provenance is the single-instance-FSM-layer **primitive support** for the organization layer's delegated-authority invariants (authority non-amplification INV-01, narrow-only constraint inheritance INV-03, transitive revocation INV-04) — the organization layer consumes the "establishing/re-establishing authority must be attributable to the authorization root" primitive to guarantee the chain-level INV invariants. Their full definitions live in §6b, beyond this section's single-instance FSM scope (§6a.1 layering boundary).

**Adversarial conformance vector (V-STATE)**: `the authorization root establishes authority (authorized) → revoke (revoked) → the authorized subject (a non-root actor) triggers re-authorize → state authorized → attempt a protected effect`. Expected: DENY — the protected effect MUST NOT execute unless the re-authorization is attributable to a valid current authorization basis capable of establishing that authority.

**Positive control vector (V-STATE)**: `the authorization root establishes authority → revoke → the authorization root issues a new authorization basis → re-established → the authorized subject exercises within the renewed authority`. Expected: ALLOW.

## 6b. Delegated-Authority Security Model (Organization Behavior Layer)

§6a defines the single-instance FSM (the state machine of a single authorization relationship); this section defines the security invariants of the **delegation chain** (multiple authorization relationships composed along "authorization root → intermediate node → authorized subject") — constraining "how authority propagates along the delegation chain", the normative semantics of the organization behavior layer. Layering: §6a provides "verifiable adjudication of authorization state", this section guarantees "the delegation chain's security invariants"; per-relationship multi-instance state is carried by the organization layer instantiating one document per relationship (§6a.1 layering boundary). In this section "delegation" means **delegation of authority** (propagating authority along the authorization chain), distinct from the §5 `DELEGATE` decision type (human-in-the-loop: handing "what the machine cannot handle" to a human or process).

### 6b.1 Umbrella: Delegation Must Never Manufacture Authority (MUST)

All delegation, assignment, re-delegation, transitive delegation, privilege brokering, downstream constraint change, and revocation MUST NOT let effective authority **exceed or escape** the originating authority chain:

> `effective_authority(subject) ⊆ authority(chain)` — effective authority is a **subset** of the originating authority chain; no operation may amplify it.

### 6b.2 Five Delegated-Authority Invariants (INV-01~05)

Each invariant = property + violation shape + normative assertion.

#### INV-01 Authority Non-Amplification

- **Property**: `effective_authority ⊆ authority(chain)`. A delegator grants authority ⊆ its own; authority cannot be amplified through the chain.
- **Violation shapes**: direct amplification (granting beyond one's own), transitive amplification (multi-hop accumulation), **aggregate amplification** (several independent child grants aggregately consuming the same bounded originating authority — per-hop non-amplification is necessary but not sufficient).
- **Normative assertion**: after any delegation/assignment/promotion action, `effective_authority(delegate) MUST ⊆ authority(chain)`; aggregate consumption of multiple child grants against one bounded originating authority MUST satisfy aggregate conservation.

#### INV-02 Provenance Continuity

- **Property**: every decision has a continuous verifiable provenance chain (authorization basis → delegation → exercise), identity binding intact.
- **Violation shapes**: broken provenance chain, replay of a consumed delegation, broken identity binding, privilege laundering (disguising an authority's origin through a broker node).
- **Normative assertion**: every decision exercising authority MUST trace to a continuous, unconsumed authorization chain; the exercising identity MUST be bound to the chain's declared identity.

#### INV-03 Narrow-Only Constraint Inheritance

- **Property**: constraints only narrow, never widen. Constraints imposed at delegation (deadline / max_autonomy / escalation_to / scope) are inherited and downstream may only narrow further.
- **Violation shapes**: downstream constraint removal/widening.
- **Normative assertion**: `constraints(delegate) MUST ⊆ constraints(delegator)`; downstream constraint changes MUST NOT widen.

#### INV-04 Transitive Revocation

- **Property**: revocation propagates to all derived authority (including unexercised and re-delegated).
- **Violation shapes**: revoked-ancestor delegation (ancestor revoked after re-delegation → downstream derived authority not invalidated), stale-negative, missing state, non-reversibility of completed actions.
- **Normative assertion**: revoking a node MUST invalidate its entire downstream subtree (transitive closure), whether exercised or not; revocation is **irreversible**, re-exercisability MUST go through a new authorization basis (§6a.10). When multiple independent bases converge on one subject, the invalidation is **basis-scoped** (§6b.4) — it applies to the revoked basis's subtree, not the subject's global authority.

#### INV-05 Capability Boundary Axis

- **Property**: authority only decreases along agent → skill → tool → protected-resource.
- **Violation shapes**: out-of-bounds.
- **Normative assertion**: `authority(resource) MUST ⊆ authority(tool) ⊆ authority(skill) ⊆ authority(agent)`.

### 6b.3 Revocation Freshness (Mechanism-Neutral)

This section generalizes §6a.9 (latest-authoritative-head freshness) to the delegation-chain layer: §6a.9 constrains single-instance-FSM state-head freshness, this section constrains the freshness of a delegation-chain ancestor's revocation state.

Before exercising authority that depends on a revocable ancestor, the enforcement boundary MUST establish that revocation state satisfies the configured freshness requirement; **absence of visible revocation MUST NOT by itself establish continued validity**; when freshness cannot be established, fail closed. Mechanism-neutral: monotonic epoch / lease / version vector / signed status object / online introspection / equivalent mechanisms.

### 6b.4 Basis-Scoped Revocation (Multi-Root Composition)

A subject may hold the same (or overlapping) effective authority through more than one independent authorization basis — e.g. `P1 → A → B` grants `{read, write}` to B while `P2 → C → B` independently grants `{read}` to B. INV-04 (transitive revocation) establishes that revoking a node invalidates authority derived from the revoked ancestor; this section fixes the **scope** of that invalidation when multiple independent bases converge on one subject: revocation is **basis-scoped**, never subject-global.

**Effective-authority composition (MUST)**: a subject's effective authority is the union of the authority derivable from each of its currently-valid authorization bases:

> `EffectiveAuthority(B) = ⋃_{X ∈ currently-valid bases of B} authority_derivable(B, X)`

`authority_derivable(B, X)` is the effective authority B derives along the `X → … → B` path — the meet of basis-X's granted scope with the inherited constraints along that path (INV-03). A basis is **currently-valid** iff it is not revoked (INV-04), its revocation state is fresh (§6b.3), and it carries authorization-root provenance (§6a.10).

**Basis-scoped revocation (MUST)**: `revoke(basis-X)` removes **exactly** the authority derivable from `basis-X` — no less (the full transitive closure of `basis-X`'s downstream derivation, per INV-04), and no more (authority independently derivable from a still-valid basis-Y remains exercisable). Revoking one derivation path is **not** revocation of every independent basis held by the subject.

**Forbidden reduction (MUST NOT)**: a conforming implementation MUST NOT reduce a subject's authority to a single global per-subject state — neither a global subject-level `revoked` bit (**over-revocation**: destroying authority independently established by a still-valid basis) nor a global subject-level `authorized` bit (**under-revocation**: retaining authority that was unique to a revoked lineage). Authority state MUST be basis/lineage-scoped, so the invalidation of one basis neither collapses nor preserves the authority of another.

**No cross-basis preservation (MUST NOT)**: a surviving valid basis MUST NOT be used to preserve authority that was unique to a revoked lineage. The union is taken over each basis's own derivable authority — `revoke(basis-X)` removes `basis-X`'s contribution even when another basis grants an overlapping (but not identical) scope.

**Relationship to INV-04**: this refines INV-04's "entire downstream subtree" to be basis-relative — the subtree of the revoked basis, not the subject's global authority. INV-04's irreversibility and §6a.10's new-basis requirement still hold: re-exercisability of the revoked lineage's authority MUST go through a new, independently established authorization basis; it is not restored by the survival of an unrelated basis. §6b.1's `effective_authority ⊆ authority(chain)` holds **per basis** — each basis's contribution is bounded by its own originating chain, and the union composes those per-basis bounds without manufacturing authority. This multi-root composition is distinct from INV-01's aggregate amplification (several child grants consuming **one** origin's shared budget): here each basis is an independent origin with its own conservation bound.

**Discriminating conformance case (V-STATE)**: `P1 → A → B` grants `{read, write}`; `P2 → C → B` independently grants `{read}`; `revoke(P1 → A)`. Expected: B's `write` → DENY (write existed only through the revoked basis and MUST NOT survive on the strength of the surviving `P2` basis — under-revocation); B's `read` → ALLOW (read is independently derivable from the still-valid `P2 → C → B` basis and satisfies its inherited constraints (INV-03) — over-revocation). A global subject-level `revoked` bit fails the `read → ALLOW` side; a global subject-level `authorized` bit fails the `write → DENY` side.

### 6b.5 Adversarial Vector Family (AV-01~14 + AV-15/16)

Convergence criterion = `decision` + `matched_invariant` + `first_invalid_boundary`. Full vector table in the independent conformance suite (`vectors/` + `conformance/CONFORMANCE.md`). Two issue #3 vectors added: AV-15 (non-root re-authorization after revocation → DENY), AV-16 (root re-establishment → ALLOW).

## 7. Evaluation Semantics

### 7.0 Evaluation Overview

Evaluation = the pure-function process (E1) by which the expression tree (the compiled product of rules) judges the **input fact** node by node. This section defines the evaluation input contract, the algorithm steps, and the output contract, to align implementers and users.

#### 7.0.1 Input Contract (Fact Object)

The evaluation input is a **fact object** carrying the current state of the rule's subject entities, namespaced by Entity (§3):

```yaml
fact:
  tool:                 # Entity: tool
    name: "issue_refund"
    args: { amount: 8000, order_id: "O1024" }
  context:              # free-form context fields (referenced by rules as context.*)
    country: "CN"
    role: "operator"
  # other Entities: agent / task / workflow / human / guardian (provided as needed)
```

- field references (`tool.name`, `context.amount`, `tool.args.amount`) resolve by key path on the fact object (§3);
- `as_of` (the evaluation moment, UTC), `temporal_state` (the within/rate sliding-window state) and `state.*` (the §6a authority-state snapshot) are injected by the engine and are controlled external inputs (E1);
- a missing field is handled by the E11 null propagation (§7.3(a)).

#### 7.0.2 Evaluation Algorithm

```
Input: rule set rules[] + fact object fact (state-machine events already processed first, see step 0)
Output: the decision result (see 7.0.3)

0. Events happen first (happens-before declaration, no extra action): events are already processed at arrival (eager, §6a.2).
   evaluate() acquires the instance lock (§6a.5); its state.* input is the state after all arrived events have committed.
1. Sort: by priority ascending (smaller = higher priority)
2. Group: execute rings in order 0 to 3 (0 kernel → 1 recovery → 2 approval → 3 advice)
3. Within each ring, evaluate each rule in order:
   a. the unless exemption is judged before when — on exemption, record and skip the rule (unless and when share the same evaluation context: fact + state.* read-only injection)
   b. the compiled when expression tree judges fact node-by-node (true / false / error)
   c. a match does not short-circuit (only `EMERGENCY_HALT` / `WORKFLOW` are exceptions, noted below): only `EMERGENCY_HALT` / `WORKFLOW` short-circuit on match; other decisions (including DENY/ROLLBACK/QUARANTINE) continue (an override ALLOW may cover)
   d. override: only the DENY → ALLOW direction, never to a less-safe state (§7.1)
4. Fallback: no rule matched → metadata.decision (fallback decision, §2.2)
5. Summarize: produce decision + matched_rules + evidence (canonical_tree / hash / eval_trace / state_snapshot)
```

- **catch-all lazy two-pass**: a catch-all (empty-condition) rule is evaluated only when **no explicit-condition rule matched** — explicit rules (ring-major) are evaluated first, and only on no match are catch-all rules (ring-major) evaluated; a catch-all is lazily skipped once any explicit rule matched (not counted in `total_evaluated`).
- **catch-all (empty-condition) determination (MUST, compile-time definition, independent of writing form)**: a rule is catch-all if and only if its `when` is one of: ① `when: "true"`; ② its compiled product is a **literal `true` node** (including the compiled product of a decision table with only a default row). The determination is made at **compile time**, independent of the writing form; implementations MUST NOT constant-fold beyond literals (`1 eq 1` is not folded into catch-all, avoiding cross-implementation divergence). Note: `rules[].when` is a MUST field (§4.1), so there is no "`when` omitted" rule form; `transitions[].when` may be omitted (§6a.2), and its unconditional transition is determined separately by the conflict check (0) of that section.
- evaluation errors fold per E12: Guard contexts (safety-boundary evaluation) fail-close, covering all tiers; non-Guard contexts fail-close tier≤2 and fold tier 3–5 to false;
- `EMERGENCY_HALT` short-circuits on match; `WORKFLOW` short-circuits on match (enters the workflow state machine, §6 decision type WORKFLOW; **note: the authority state machine is in §6a**, they are distinct); `DENY`/`ROLLBACK`/`QUARANTINE` do not short-circuit — evaluation continues to judge whether an override ALLOW covers them.

#### 7.0.3 Output Contract (Evaluation Result)

The evaluation result MUST contain the following fields:

> **Absence encoding (MUST, §8.2a)**: nullable object-type fields (`primary_instruction`, `primary_reason`, `primary_explanation`, `primary_correction`, `temporal_state`, `state_snapshot`) encode as `null` when valueless, key MUST NOT be omitted; list-type fields (`unless_exemptions`, `eval_warnings`, `canonical_trees`) encode their empty state as `[]` (key not omitted), and `matched_rules` is always an array — keeping the DO hash-preimage structure constant. Exception: `errored` is a boolean flag (E3), always valued (EvaluationError → true, otherwise false); it does not participate in absence encoding. The full empty-state encoding boundary is in §8.2a.

| Field | Description |
|-------|-------------|
| `decision` | the final decision (one of the §6 enum, or the fallback decision) |
| `matched_rules` | the matched rules (in evaluation order) |
| `unless_exemptions` | rules exempted via unless (recorded separately, not counted in matched_rules) |
| `primary_instruction` | the primary instruction (ALLOW + instruction scenario) |
| `primary_reason` | the primary reason (DENY and other blocking scenarios) |
| `primary_explanation` | the primary explanation (may be bilingual) |
| `primary_correction` | the correction text (CORRECT decision; sourced from the rule field `correction`, see §4.1) |
| `total_evaluated` | the total number of rules whose `unless`/`when` evaluation was actually entered (rules skipped by catch-all inertness are NOT counted) |
| `total_matched` | the total number of rules matched |
| `temporal_state` | the within/rate sliding-window state snapshot (encoded as `null` when nothing matched, key not omitted, §8.2a) |
| `state_snapshot` | the `state.*` values read during evaluation: `{ values, state_version, transitions_head }` (encoded as `null` when no state was read, key not omitted, §8.2a); enters the DO hash preimage (§6a.5) |
| `canonical_trees` | the matched rules' canonical tree snapshots (tree = canonical-tree JSON) and hashes (sha256: prefix), E6 evidence |
| `eval_warnings` | non-fatal warnings collected during evaluation (E3) |
| `errored` | whether an evaluation error occurred (E3); Guard contexts fail-close, covering all tiers (E12) |
| `as_of` | the evaluation moment injected by the engine (ISO UTC, E9) |

> The evaluation evidence (canonical_tree snapshot, result hash, eval_trace) are independently recomputable derived products (§8.2, E6) — canonical_tree enters the hash, eval_trace does not (§8.3).

### 7.1 Precedence and Conflict Resolution

1. Sort by `priority` ascending (smaller value = higher precedence);
2. Among equal priority, those with an `override` marker go first;
3. `override` enumeration: `critical` > `high` > `normal` > `low` (default `normal`);
4. Equal priority and equal override: definition order;
5. `override` is allowed only in the DENY → ALLOW direction (it MUST NOT override to a less-safe state); when `override` is `critical`/`high` it works across rings: a higher-ring override ALLOW may cover a lower-ring DENY (**without comparing ring**);
6. **An empty-condition rule (catch-all / fallback) MUST NOT rewrite the decision established by an explicit-condition rule**: a rule whose `when` is empty (matches unconditionally), whether its `then` is DENY or ALLOW and whether or not it carries `override`, MUST NOT override the decision established by any explicit-condition (non-empty `when`) rule. A fallback rule takes effect **only when no explicit-condition rule matches** (synonymous with the decision-table "default row" in §5.4). Rationale: a fallback rule carries the weak, general intent of "all other cases", while an explicit-condition rule carries the strong, specific intent of "this particular case"; letting the fallback rewrite an explicit decision is an "override to a less-safe state" and violates the safety monotonicity of item 5.

### 7.2 Evaluation Constraints (E1–E12, all MUST)

| # | Constraint |
|------|------|
| E1 | Evaluation is a pure function: no side effects, no implicit external state, no clock reads; the state injection of `within`/`rate` (`temporal_state`), the authority state snapshot (`state.*`, §6a) and `as_of` are controlled external inputs — the state body is held by the engine, the expression tree reads only snapshots |
| E2 | Fixed-point decimal scale=14 + half-even string serialization (evaluation scope: output precision, not canonical encoding); intermediate computation uses high-precision bounded rationals, rounding only at output nodes |
| E3 | Evaluation errors are recorded as eval_warnings with errored=true; folding direction follows E12 by tier |
| E4 | Resource limits (graded): Grade A arithmetic depth≤2 / tree depth≤6 / nodes≤64 / array≤10000 / per-rule≤50ms (DoS-guard implementation hint, not evaluation semantics; the reference implementation substitutes deterministic node/depth limits for wall-clock timing, see E1/E9) / no nested quantifiers / regex steps≤10000; Grade B tree depth≤10 / nodes≤256 / arithmetic depth≤4, quantifier nesting≤2; Grade C not applicable |
| E5 | Type checking at load; `when` and `expr` MUST NOT coexist |
| E6 | Tree as evidence: canonical_tree (a tree snapshot) serves as evaluation evidence and enters the hash; eval_trace is a recomputable derived product, not entering the hash |
| E7 | Simple and Expression compile to the same evaluation core; a second evaluator is forbidden |
| E8 | Quantifier safe folding: empty array → all/any/none all false (anti-vacuous-truth) |
| E9 | No wall-clock reads; as_of is injected by the engine and recorded in the audit record |
| E10 | String NFC normalization |
| E11 | undefined sentinel semantics (null propagation, see §7.3) |
| E12 | Evaluation error handling: **Guard contexts** (safety-boundary evaluation; the reference `evaluate()` is a Guard context) default to fail-close — all tiers fold to the blocking side (DENY); **non-Guard contexts** (simulation/analysis) fail-close tier≤2 and fold tier 3–5 to false |

The kernel explicitly excludes: string concatenation, regex replacement, bitwise operations, date formatting, recursive references, and user-defined nodes — to keep evaluation closed and verifiable.

### 7.3 Deterministic Semantics (Cross-Implementation Divergence Protection)

The following semantics MUST be explicitly annotated in the document and vectors, to avoid semantic misunderstanding against standard implementations:

#### 7.3(a) Null propagation (E11)

Agent context is highly dynamic; missing fields are the norm. Evaluation MUST use safe failure under three-valued logic:

| Scenario | Behavior |
|------|------|
| Equality/numeric comparison on a missing field | returns false (not NPE) |
| `== null` / `!= null` check | returns true / false normally |
| Type-mismatched comparison | returns false (no implicit conversion; not an error, errored=false) |
| Arithmetic on a missing field | a comparison node (Simple condition) → returns false (errored=false); an arithmetic node (arith) → EvaluationError (errored=true) |
| Non-boolean operand to a logic node (`and`/`or`) | folds to false silently (no warning; not an error, errored=false) |

> **Warning asymmetry (must be reproduced exactly across implementations)**: comparison nodes, `between`, and logic nodes (`and`/`or`) over a non-boolean operand fold type mismatches to false **silently** (no warning); whereas `in` (non-array right operand), string nodes (`contains`/`match`/`starts_with`/`ends_with`), `length` (non-string/array), `aggregate` (non-array / non-numeric element), and quantifiers (`all`/`any`/`none`) over a non-array operand record a `type_mismatch` warning — these all set `errored: false` (they are type-mismatch warnings, not E3 EvaluationErrors). This asymmetry is internally consistent in the vector set (e.g. `gt-003` and `E3-002` both have warnings=[]); third-party implementations MUST reproduce it exactly.

#### 7.3(b) Quantifier safe folding (E8)

under standard quantifier semantics `all(empty)=true` (vacuous truth). This specification deliberately deviates: `all/any/none(empty)` all fold to false — preventing "nothing to check yet judged as allowed" — and record the safe fold in the audit record. An `over` that is **not an array** (missing/scalar/object) is a `type_mismatch` warning: `all/any/none` fold to `false` with `errored: false`. Third-party implementations MUST adopt this folding semantics.

#### 7.3(c) Fixed-point intermediate precision (E2)

intermediate computation uses high-precision bounded rationals (e.g. 128-bit integer numerator/denominator); only output nodes round to scale=14 + half-even string serialization (IEEE 754-2019 ROUND_HALF_EVEN). Conformance compares the **scale-14 fixed-point value** (numerically equal), not the string spelling: trailing zeros are insignificant (`"35"` ≡ `"35.0"`). This "string serialization" is the **evaluation scope** (output precision) and does not enter the canonical_tree hash; the canonical **encoding scope** is §8.2 (JCS number serialization).

#### 7.3(d) Regex ReDoS protection

the `match` node MUST satisfy: ① single-match step limit ≤10000; ② input length limit; ③ prefer a deterministic engine (RE2-class) or a safe syntax subset. The safe syntax subset MUST be restricted to regular languages: **backreferences (`\1`–`\9`, `\k<name>`) and lookaround (`(?=)` / `(?!)` lookahead, `(?<=)` / `(?<!)` lookbehind) are forbidden** — such non-regular constructs depend on backtracking order, cannot be made byte-deterministic, and cannot be expressed by the SMT verifier (erdl-formal). Inline case flags (`(?i)`) are not provided (matching is always case-sensitive, §5.2). A regex that violates these limits (nested quantifiers, backreferences, lookaround, or a step-limit violation) folds to `false` with a `regex_re_dos` warning and `errored: false` — it is not an E3 EvaluationError.

#### 7.3(e) aggregate empty-array safe folding

| Function | Empty-array result | Basis |
|------|-----------|------|
| `count(empty)` | `0` | standard counting semantics |
| `sum(empty)` | `0` | empty-sum identity |
| `avg(empty)` | `false` | safe-failure fold (avoid division by zero) |
| `min(empty)` | `false` | safe-failure fold (standard +Infinity, disabled) |
| `max(empty)` | `false` | safe-failure fold (standard −Infinity, disabled) |

The `over` of `aggregate` MUST be an array; a non-array (missing/scalar/object) returns `null` + `type_mismatch` warning (folded to false). `count(missing)` and `count(empty array)` differ: the former is type_mismatch, the latter is 0.

#### 7.3(f) Time-node UTC semantics (E9)

all time nodes evaluate uniformly in UTC, guaranteeing byte-for-byte consistency across implementations and time zones:

- Input parsing: date-only (`YYYY-MM-DD`) parses as UTC; date-time parses per ISO 8601 with timezone (whole-second precision, fractional seconds not supported), and without a timezone suffix as UTC;
- Component extraction (`date_part`): always takes UTC components;
- Date arithmetic (`date_add`, `month_last_day`): UTC calendar arithmetic; the `date_add` `amount` MUST be an **integer** (a non-integer returns `null` + a `type_mismatch` warning, folding to false) — a duration is an integer unit, half-even rounding of “add 1.5 months” has no business meaning, so implicit rounding is forbidden;
- Time difference (`days_between`): UTC millisecond difference ÷ 86400000, floor;
- Serialization: ISO 8601 UTC (`toISOString`).

Business local time zone is converted by the engine to a UTC instant when injecting `as_of`; the evaluator computes as a UTC pure function.

#### 7.3(g) Resource-limit violations (E4) and load-time exclusivity (E5) are constraint-verification results, not evaluation results

an E4 structural resource-limit violation (nodes / tree-depth / arithmetic-depth / array / quantifier-nesting over the grade limit) **throws** — the engine returns `value: null` with `value_type: "null"` and `threw: true` (not an E3 EvaluationError; `errored` stays `false`). A regex ReDoS violation (§7.3(d)) folds to `false` + `regex_re_dos` (not a throw). An E5 load-time exclusivity violation records `value: true` (= violation detected). The E12 fold and `errored` rules above apply to **evaluation** vectors only.

### 7.4 `when` Minimum-Completeness Constraints

`when: "true"` means "applies to all operations" and is allowed only for advisory rules:

| Rule | Level |
|------|------|
| `when: "true"` MUST NOT pair with `then: DENY` | MUST NOT |
| `when: "true"` MUST NOT pair with `then: EMERGENCY_HALT` | MUST NOT |
| `when: "true"` MUST NOT pair with `then: CORRECT` | MUST NOT |
| `when: "true"` MUST NOT pair with `then: REQUEST_HUMAN` | MUST NOT |
| `when: "true"` MAY pair with `then: ALLOW + instruction` | MAY |
| `when: "true"` MAY pair with `then: NOTIFY` | MAY |
| Safety rules (category=security) MUST contain at least 1 condition | MUST |
| Tool-interception rules SHOULD contain a `tool.name` condition | SHOULD |
| File-operation rules SHOULD contain `tool.args.path` | SHOULD |
| Command-operation rules SHOULD contain `tool.args.command` | SHOULD |

---

## 8. Serialization and Canonicalization

### 8.1 Serialization

An ERDL document is carried in YAML and can be losslessly converted to JSON. The canonical tree (`canonical_tree`) is serialized as a JSON object.

### 8.2 Canonical Tree (Canonical Form)

The expression tree is the single benchmark object for evaluation, hashing, and recomputation. For its hash to be byte-for-byte identical across implementations, the tree MUST have a unique canonical form:

| Canonicalization rule | Description |
|-----------|------|
| Fixed node order | child nodes are arranged in canonical order (strict left→right), independent of source writing order |
| Field names load-bearing | field reference paths are load-bearing — frozen once published (`[FREEZE-1]`); aliases MUST be normalized first |
| Literal canonicalization | the canonical **encoding scope** of number literals is JCS (RFC 8785) IEEE 754 number serialization (distinct from the E2 evaluation scope); strings NFC-normalized |
| var canonicalization | only `$` / `$.path`, with path segments as definite byte sequences |
| Metadata stripping | comments, source line numbers, formatting, authors, and other non-semantic metadata never enter the canonical tree |

> **The object of tree hashing is the canonical tree, not any particular implementation's memory representation or serialized text.** Two structurally equivalent trees (differing only in field writing order, whitespace, or variable naming) produce exactly the same byte sequence and hash after canonicalization.

### 8.2a DO Hash Preimage (field order + fixed key set + absence encoding)

The DO hash preimage of an evaluation result — its **field order, key set, and absence encoding** — MUST be defined as follows, otherwise two implementations will necessarily compute different hashes (v2.2 added a structured field to the DO, `state_snapshot`, whose local key ordering is defined but whose overall preimage is not — a global anchoring gap):

#### 8.2a.1 Evaluation-result DO field order and fixed key set

**Fixed field order (MUST)**:

```
decision → matched_rules → unless_exemptions → primary_instruction → primary_reason
→ primary_explanation → primary_correction → total_evaluated → total_matched
→ temporal_state → state_snapshot → canonical_trees → eval_warnings → errored → as_of
```

**Fixed key set (MUST)**: a valueless key is encoded as `null`, keys MUST NOT be omitted (keeping the preimage structure constant); arrays in occurrence order; strings NFC (E10); numbers JCS (§8.2 encoding scope). **Empty-state encoding (MUST)**: list-type fields (`matched_rules`, `unless_exemptions`, `eval_warnings`, `canonical_trees`) encode their empty state as `[]` (key not omitted); only nullable object-type fields (`primary_instruction`/`primary_reason`/`primary_explanation`/`primary_correction`, `temporal_state`, `state_snapshot`) encode as `null` when valueless — arrays are always arrays, objects may be null, a unique boundary.

#### 8.2a.2 Transition-chain audit-record preimage (three kinds)

**Transition-chain audit-record preimage field order (MUST, three kinds)**: the transition chain is composed of three kinds of audit records — successful transition (`type: "transition"`), transition error (`type: "transition_error"`), and genesis (`type: "genesis"`). The three have different field sets; **their respective field order and fixed key set MUST be as follows** (the `type` field enters the preimage to distinguish kinds):

**Successful transition record (`transition`)**:

```
type → event_id → on → actor → at → audit_as → set → state_version → previous_hash
```

**Transition error record (`transition_error`)**:

```
type → event_id → on → actor → at → audit_as → error → errored → previous_hash
```

**Genesis record (`genesis`)**:

```
type → protocol → doc_tree_hash → initial → at → previous_hash
```

**Fixed key set and absence encoding (MUST)**: each kind's key set is the field order listed above (missing fields are not padded across kinds); the keys of `set`/`initial` are ordered by state-variable-name UTF-8 code-point ascending; strings NFC (E10); numbers JCS (§8.2 encoding scope); `previous_hash` absent (genesis only) is encoded as `null` and the key is not omitted.

### 8.3 Relationship between the Canonical Tree and gloss

- gloss is generated from the tree by the frozen rendering template (G1);
- **what enters the hash is the tree (canonical form), not the gloss text** — the tree is byte-deterministic, satisfying the hash requirement;
- the gloss text does not enter the hash, so wording may differ across implementations without breaking cross-implementation consistency;
- gloss and tree are bound by render verification (G2) — changing gloss without changing the tree is judged invalid.

This "hash the tree, verify gloss equals the tree" mechanism lets gloss obtain cryptographic anchoring of the tree without needing byte-for-byte identity or entering the hash.

---

## 9. How to Integrate ERDL

The integration goal of ERDL is to extract critical decisions from model inference, framework code, or informal conventions, and turn them into loadable, executable, and verifiable rule assets. ERDL is typically delivered as YAML/JSON rule documents, makes decisions through `when → then`, and outputs hashable evaluation evidence that can be recomputed byte for byte. The following three integration paths correspond to three typical engineering integration points.

### 9.1 Scenario 1: AI Agent (Behavioral Constraint Layer / Action Guard)

**Role:** In an AI Agent pipeline, ERDL is the deterministic gate between LLM intent and system execution — the Agent may generate actions, but whether an action is permitted must be determined by rule evaluation.

**Simulation:** A customer-service Agent receives a user request for a refund of 8,000 yuan. The LLM converts the intent into the tool call `issue_refund(amount=8000, order_id=O1024)`. Before the call actually reaches the payment system, Action Guard packages the tool name, arguments, and session context into a fact object and submits it to ERDL for evaluation. In the rule set, R1 is written as `when tool.name == "issue_refund" and tool.args.amount > 5000 → REQUEST_HUMAN`, while R2 is written as `when tool.name == "issue_refund" → ALLOW`. Because R1 matches first, the system returns REQUEST_HUMAN. The Agent stops calling the payment tool, generates a human approval task instead, and returns a "manual review required" message to the user.

**Integration points:** First, rules are evaluated independently of the model, so prompts no longer carry the safety boundary. Second, match records, input digests, canonical_tree, and result hashes are written together to audit logs, making every interception replayable. Third, rule changes require only updating the ERDL document, without rewriting the Agent framework, tool implementations, or model prompts.

### 9.2 Scenario 2: MCP (Protocol Distribution / Cross-Implementation Interoperability)

**Role:** In the MCP ecosystem, ERDL rules are exposed as standard tools through an ERDL MCP Server. Any MCP-compatible Agent can invoke the same rule set, enabling compliance distribution and mutual recognition across implementations.

**Simulation:** An enterprise deploys its fund-compliance rules as an ERDL MCP Server and exposes the `guard_check` tool. A third-party Agent prepares to execute a high-value refund but does not possess the enterprise rules. Before execution, it calls `guard_check` through MCP, passing an action description (`action=issue_refund`, `amount=8000`, `channel=payment`). The ERDL MCP Server loads the rule set, performs evaluation, and returns `decision=REQUEST_HUMAN`, `matched_rule=R1`, `hash=0x9f...`. Based on the returned value, the third-party Agent stops direct execution, enters a human approval workflow, and records the decision evidence in its own execution log.

**Integration points:** The key here is "Rules-as-a-Service." Rules are no longer hard-coded in a specific Agent framework; they are distributed through a standard protocol. Clients from different vendors, programming languages, and runtime environments can consume the same decision logic. Because the response includes rule-match and hash information, callers can archive decision evidence for later auditing or independent recomputation even without storing the original rule text. When rules are upgraded, only the MCP Server side needs to be updated; clients do not need to refactor their execution chains.

### 9.3 Scenario 3: Rule Engine (Rule Definition Language / Deterministic Evaluation)

**Role:** Inside a rule engine, ERDL is the rule definition language itself, responsible for expressing business policies declaratively and providing deterministic evaluation semantics.

**Simulation:** An anti-money-laundering engine needs to express "large transaction involving a high-risk country → block." The business team writes the ERDL rule `when context.amount > 10000 and context.country in [high-risk country list] → DENY`. After loading the YAML, the engine does not treat it as ordinary configuration; it compiles it into an expression tree: comparison nodes handle amount thresholds, set nodes determine country membership, and logical nodes perform the AND operation. The engine then executes according to the E1–E12 evaluation semantics and outputs DENY. The rule can also generate canonical_tree and a hash value; another implementation can recompute the same result simply by loading the same rule and the same input.

**Integration points:** The core value here is "verifiable determinism." ERDL not only makes rules readable, but also allows engine implementations to be constrained by test vectors. V-ENGINE-class test vectors can prove that different engines, platforms, and versions produce byte-for-byte identical results for the same rule. As a result, a rule engine is no longer merely an internal black box inside a business system; it becomes an executor that can be independently verified by third parties. Regulators, auditors, or platform operators can determine whether the engine computed correctly based on inputs, rule hashes, and evaluation evidence.

---

## 10. Examples and Conformance Verification

### 10.1 Quick Start

A minimal ERDL document plus one evaluation, walking the full "write → load → evaluate → get result" chain (pipeline in §2.4).

**Step 1 · Write the rule** (`refund.erdl.yaml`):

```yaml
protocol: "erdl/v2"
version: "2.2.0"
metadata:
  name: "refund-guard"
  description: "Refund amount control"
  category: coding
  decision: ALLOW
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
    gloss: "tool.name equals issue_refund and tool.args.amount is greater than 5000"  # engine-generated (G2)
    then: REQUEST_HUMAN
    message: "Refund amount over 5000, human approval required"
```

**Step 2 · Load + validate + compile**: parse the YAML, validate it, then compile `when` into an expression tree (§2.4 steps ①②③).

**Step 3 · Evaluate**: given the fact object:

```yaml
fact:
  tool:
    name: "issue_refund"
    args: { amount: 8000 }
```

Rule `SEC-001` matches (`tool.name == "issue_refund"` and `amount > 5000`).

**Step 4 · Result**:

```yaml
decision: REQUEST_HUMAN
matched_rules: ["SEC-001-refund-limit"]
primary_reason: "Refund amount over 5000, human approval required"
total_evaluated: 1
total_matched: 1
```

If the input is changed to `amount: 100`, the rule does not match, and the `metadata.decision` fallback applies → `decision: ALLOW`.

### 10.2 Complete Examples

See §4.2 (Simple rule), §5.3 (Expression rule), and §5.4 (Decision Table).

#### 10.2.1 State-block complete example (§6a)

**State-block complete example (§6a)**:

```yaml
protocol: "erdl/v2"
version: "2.2.0"
metadata:
  name: "delegated-refund-authority"
  description: "Revocation and freshness of delegated refund authority"
  category: security
  decision: DENY
state:
  - name: authorization
    values: [authorized, revoked]
    initial: revoked
    display_name: { zh: 授权状态, en: authorization state }
transitions:
  - on: bootstrap
    audit_as: DELEGATE
    reason: authorize
    when: { eq: [{ field: "state.authorization" }, "revoked"] }
    gloss: "authorization state equals revoked"  # engine-generated (G2), lint-enforced
    set: { authorization: authorized }
  - on: revoke
    audit_as: DELEGATE
    reason: revoke
    gloss: "true"                                # unconditional transition: literal true
    set: { authorization: revoked }
rules:
  - name: "SEC-001-revoked-denies-exercise"
    description: "Block protected operations when authorization is revoked"
    priority: 10
    ring: 0
    when:
      logic: AND
      conditions:
        - field: "state.authorization"
          operator: eq
          value: revoked
    then: DENY
    message: "authorization revoked"
```

> Note: the `state` block is already updated by events (`transitions`) before rules evaluation; `state.*` is controlled injection (§6a.3), not a fact field.

#### 10.2.2 Evaluation output example (with `state_snapshot`)

**Evaluation output example (with `state_snapshot`, a V-STATE prototype)**: after the above example undergoes two events — `bootstrap` (authorize) and `revoke` (revoke) — the rule evaluation outputs:

```yaml
# Event sequence (processed before rule evaluation, eager):
#   bootstrap → set authorization: authorized   (state_version 0 → 1)
#   revoke    → set authorization: revoked      (state_version 1 → 2)

decision: DENY                                  # matches SEC-001, authorization=revoked
matched_rules: ["SEC-001-revoked-denies-exercise"]
primary_reason: "authorization revoked"
total_evaluated: 1
total_matched: 1
temporal_state: null                            # no within/rate match
state_snapshot:                                 # §6a.5, enters the DO hash preimage
  values: { authorization: revoked }            # state read at evaluation (on-demand, not full)
  state_version: 2                              # 2 committed transactions (bootstrap + revoke)
  transitions_head: "sha256:…"                  # hash of the revoke record
canonical_trees: [ { ruleId: "SEC-001-…", tree: …, hash: "sha256:…" } ]
eval_warnings: []                               # list-type field empty state is []
errored: false
as_of: "2026-09-12T10:00:00Z"
```

### 10.3 Conformance Verification

#### 10.3.1 Vector coverage

The semantics of this specification MUST be proven by independently recomputable test vectors. The expression-layer vectors (V-ENGINE / V-GLOSS / V-PROJ) cover: 34 nodes × 4 scenarios (normal/boundary/exception/empty), E1–E12 semantics, the Simple 30-operator compile mapping, and gloss rendering templates; the **state-layer vectors (V-STATE)** cover all MUST semantics of §6a: event-object validation (`event_id`/`on`/`actor`/`at`/`payload` restricted load), same-variable conflict check (0)–(4) positive/negative cases and same-event `audit_as` consistency, single-event multi-rule atomicity (stop at the first EvaluationError, commit all at once on full pass), guard-error fail-closed with `transition_error` chain position (no set applied / no version increment / no head movement), `state_version`/`transitions_head` replay verification, duplicate `event_id` idempotent drop, unmatched-event silence, load failure for rules referencing `event.*` / undeclared `state.*`, catch-all vs explicit-rule two-pass interaction, and enforcement-boundary check/act re-validation (`authorized@N → ALLOW@N → revoke@N+1` before effect commit, fail-closed, §6a.8), latest-authoritative-head freshness (`authorized@N/HN → revoke@N+1/HN+1 → restore historical prefix → replay succeeds → reject effect`, anti-rollback, §6a.9).

#### 10.3.2 Five-step verification

**Five-step verification**: load vector input → generate expression tree → recompute evaluation result → compare with the answer → judge consistency.

#### 10.3.3 Third-party Runner verification flow (from zero to conformance)

**Third-party Runner verification flow (from zero to conformance)**:

1. Read this specification;
2. Implement an independent verifier in your own chosen tech stack (without importing any existing implementation code);
3. Load the test vectors and compare byte-for-byte;
4. Confirm your implementation satisfies the Runner contract;
5. Submit results to the implementation registry for third-party audit re-verification.

---

## Appendix A · 34-Node Reference Table

| Group | Nodes | Count |
|----|------|:---:|
| Value | field · var · literal | 3 |
| Logic | and · or · not | 3 |
| Comparison | eq · ne · gt · gte · lt · lte | 6 |
| Set | in | 1 |
| String | contains · match · starts_with · ends_with | 4 |
| Existence/measure | exists · length · between | 3 |
| Quantifier | all · any · none | 3 |
| Arithmetic | add · sub · mul · div · round | 5 |
| Time | days_between · epoch_ms · date_add · date_part · month_last_day | 5 |
| Aggregate | aggregate (count/sum/avg/min/max) | 1 |

Total **34 nodes**.

## Appendix B · Simple 30-Operator Reference Table

| Family | Operators | Count |
|----|------|:---:|
| Comparison | eq · ne · gt · gte · lt · lte | 6 |
| List | in · not_in | 2 |
| String | contains · not_contains · match · starts_with · ends_with | 5 |
| Boundary negation | not_starts_with · not_ends_with | 2 |
| Existence | exists · not_exists | 2 |
| Length | length_gt · length_gte · length_lt · length_lte · length_eq | 5 |
| Range | between · not_between | 2 |
| Count | count_gt · count_gte · count_lt · count_lte | 4 |
| Modifier | within · rate | 2 |

Total **30 operators** (28 condition operators + 2 condition modifiers).

## Appendix C · Decision Type Enumeration (13 types)

See §6.

## Appendix D · Function Delegation and Rule Grading

For scenarios explicitly excluded by the kernel but genuinely needed, function delegation (FnRegistry) is provided as a controlled fallback:

| Constraint | Description |
|------|------|
| Registration | a function MUST be registered before it can be referenced; unregistered calls are rejected |
| Sandboxed execution | restricted environment under resource quota and timeout |
| Determinism exemption declaration | functions on the Guard evaluation path MUST declare and guarantee determinism |
| Auditability | every call is recorded in the audit record for offline verification |

> **fn node reading state (§6a)**: an fn node is **not part of the 34-node frozen kernel** (Appendix D controlled fallback, Grade C) — the fn's **arguments** may reference `state.*`/`event.*` (controlled state is injected via a field node and passed in as an argument); but the fn itself MUST remain deterministic (per the determinism-exemption declaration above), and **MUST NOT write state** (state is updatable only by `transitions[].set`, §6a.3).

**Rule grading (Grade)**:

| Grade | Expression form | Audit SLA |
|:---:|------|------|
| A | pure Simple (30 operators) | highest, plain-text recomputable |
| B | Expression tree | high, eval_trace MUST |
| C | with function delegation | layered, Grade C MUST NOT pose as plain-text recomputable |

Rules with function delegation (Grade C) MUST explicitly mark "contains non-recomputable function delegation" in gloss; the delegated function's call input + output hash MUST enter the result hash's preimage.

---

## Appendix E · Glossary

| Term | One-line definition |
|------|---------------------|
| Entity | a rule subject type (agent/tool/task/workflow/human/guardian), the namespace for field references (§3) |
| Rule | a `when → then` decision unit |
| DO (Decision Object) | the cryptographic audit record of a single evaluation, JCS (RFC 8785) + SHA-256, independently verifiable |
| genesis | the chain-start audit record generated for `initial` at state-block load (initial snapshot + document canonical-tree hash, §6a.5) |
| transition_error | a first-class on-chain record produced by a transition guard EvaluationError (does not apply set, does not increment version, does not move head, §6a.5) |
| event (event object) | the transition trigger input `{ event_id, on, at, actor, payload }` (§6a.7) |
| actor | the authenticated event-source identifier (provided by the identity layer, enters the transition audit record, §6a.7) |
| when | a rule's trigger condition (compiled to an expression tree) |
| then | the decision type after a rule matches (§6) |
| tier | rule level 0–5, low to high for constraint strength; tier 0–2 uses Simple, ≥3 may use Expression |
| ring | execution ring 0–3 (kernel/recovery/approval/advice); evaluation runs in ring order |
| Guard context | a safety-boundary evaluation context (the reference `evaluate()`); evaluation errors fail-close (E12), covering all tiers |
| non-Guard context | a simulation/analysis evaluation outside the safety boundary; tier 3-5 evaluation errors fold to false (E12) |
| override | override level critical > high > normal > low; only the DENY → ALLOW direction is allowed |
| expression tree | the evaluation semantic kernel (34 nodes, 10 groups); all three writing forms compile to it |
| canonical_tree | the canonical tree, the sole basis for hashing and recomputation (§8.2) |
| gloss | the natural-language readable projection deterministically generated from the tree (§5.5) |
| eval_trace | the node-level evaluation trace (recomputable derived product, does not enter the hash, E6) |
| eval_warnings | non-fatal warnings during evaluation (E3) |
| errored | whether evaluation errored (E3): EvaluationError (division by zero / invalid date / arity / type-mismatched arithmetic) → true (even though E12 folds to false); type-mismatched comparison and null propagation → false |
| temporal_state | the **temporal state**: within/rate sliding-window state (stateful operators, counter semantics) — distinct from "authority state" (state block) |
| state block | the **authority state**: the named state machine declared by §6a (the `state` top-level block + `transitions` rules) — distinct from the "temporal state" temporal_state; the two do not share a namespace |
| state variable | a named state declared by the state block (§6a), `state.<name>` namespace, updatable only by transition rules |
| state space | the full set of state variables and their enum values declared by a document (finite, capped) |
| state transition | an event-triggered deterministic state change `state.<name> ← value` (the FSM's F function, §6a.2) |
| controlled injection | engine-held inputs (as_of/temporal_state/state.*) not writable externally, updatable only by engine mechanisms (§6a.3, E1) |
| state_snapshot | the state snapshot at evaluation, entering the DO hash preimage (§6a.5) |
| enforcement boundary | the component (Action Guard / tool-call guard) that consumes the §6a decision and commits the gated side effect (§6a.8) |
| check/act atomicity | the §6a.8 obligation that no authorization-lineage state change commits between the authorization decision and the gated side effect's commit |
| latest authoritative head | the current latest authoritative state anchor `{state_version, transitions_head}` for a document instance; its freshness across restart/recovery/replica boundaries requires an external anchor (§6a.9) |
| durable freshness anchor | the persistent anchor provided by the organization/deployment layer that establishes latest-authoritative-head freshness across restart/recovery/replica boundaries (monotonic epoch / durable anchor / signed checkpoint / consensus backing); the enforcement boundary uses it to determine whether restored state is sufficiently fresh (§6a.9) |
| authorization basis | where an authority comes from — a root grant or an independently verified re-authorization decision object that establishes/re-establishes authority for a subject; distinct from the authorization root (the principal entitled to establish it) and the authority chain (the lineage). Revocation is basis-scoped: revoking one basis removes only that basis's derivable authority (§6b.4) |
| authorization root | the principal/authority entitled to establish/re-establish an authority; the `actor` of a transition that makes authority exercisable MUST be attributable to it (§6a.10) |
| delegation chain | the composition of multiple authorization relationships along "authorization root → intermediate node → authorized subject" (§6b) |
| effective authority | the authority a subject can actually exercise; MUST ⊆ the originating authority chain (§6b) |
| authority chain | the complete authorization lineage from the authorization root to the authorized subject; effective authority MUST be a subset of it (§6b) |
| delegated-authority invariants | the five delegation-chain security invariants INV-01~05 (non-amplification / provenance continuity / narrow-only inheritance / transitive revocation / capability boundary, §6b) |
| transition validity | the engine validates transitions: only declared ones execute, values belong to the enum, undeclared transitions do not execute (fail-closed) |
| as_of | the evaluation moment injected by the engine (UTC, E9) |
| fact object | the evaluation input carrying the current state of entities (§7.0.1) |
| fallback decision | the metadata.decision fallback verdict when no rule matches (§2.2) |
| NFC | Unicode Normalization Form C (string normalization, E10) |
| ReDoS | regular-expression denial of service; the match node MUST guard against step explosion (§7.3(d)) |
| half-even | banker's rounding (ROUND_HALF_EVEN), the E2 fixed-point output rounding |
| null propagation | the safe-failure semantics of returning false uniformly for missing fields (E11) |
| evaluation scope | the E2 fixed-point output precision (scale=14 + half-even string serialization); does not enter the canonical_tree hash |
| encoding scope | the §8.2 canonical serialization of number literals (JCS number); enters the hash |

---

## Revision History

| Version | Date | Changes |
|------|------|------|
| v2.2 | 2026-09-16 | §6b.4 new: basis-scoped revocation (multi-root composition) — a subject's effective authority is the union over its currently-valid authorization bases; `revoke(basis-X)` removes exactly basis-X's derivable authority (no less — full transitive closure of its downstream derivation; no more — other bases' contribution survives); MUST NOT reduce a subject's authority to a global per-subject revoked/authorized bit (forbids over-revocation and under-revocation); a surviving basis MUST NOT preserve authority unique to a revoked lineage; refines INV-04's "downstream subtree" to be basis-relative; glossary adds authorization basis |
| v2.2 | 2026-09-15 | §6 decision types gain a design rationale: 13 types exist to maximize LLM value in the AI era, not simply allow/deny; five groups (allow-block / guide / human-in-the-loop / safety fallback / process) |
| v2.2 | 2026-09-15 | §6a.9 new: latest-authoritative-head freshness (anti-rollback, integration requirement) — successful replay verification does not establish currentness (distinguish integrity/provenance from freshness); before authorizing a security-sensitive side effect the enforcement/recovery boundary MUST establish that `{state_version, transitions_head}` is the latest authoritative head (not superseded), implementation-neutral (monotonic epoch / durable anchor / signed checkpoint / consensus); fail closed when freshness cannot be established; V-STATE adds the `authorized@N/HN → revoke@N+1/HN+1 → restore historical prefix → replay succeeds → reject effect` anti-rollback vector |
| v2.2 | 2026-09-15 | §6a.9 layering clarification (Finding 2 sign-off): the durable freshness anchor is provided by the organization/deployment layer; the fail-closed property is preserved — if the enforcement boundary cannot establish that the restored `{state_version, transitions_head}` is sufficiently fresh relative to the authoritative persistence state, authority-bearing effects MUST NOT proceed; successful replay/integrity verification is never sufficient evidence that authority is still current |
| v2.2 | 2026-09-15 | §6a.10 new: authorization-root provenance for establishing/re-establishing authority (integration requirement) — a transition that makes authority exercisable MUST carry authorization-root provenance (actor attributable to a principal entitled to establish it); re-authorization after revocation MUST have a new valid authorization basis; a descendant MUST NOT self-restore revoked authority; authorization-root eligibility is a boundary/organization-layer obligation (fail closed when unestablishable); V-STATE adds root-establish→revoke→non-root-re-authorize→attempt (DENY) and root-reestablish→ALLOW vectors |
| v2.2 | 2026-09-15 | §6b new: delegated-authority security model (organization behavior layer) — umbrella "delegation must never manufacture authority"; five invariants INV-01~05 (non-amplification / provenance continuity / narrow-only inheritance / transitive revocation / capability boundary), each = property + violation shape + normative assertion; mechanism-neutral revocation freshness; adversarial vector family AV-01~14 + AV-15/16 |
| v2.2 | 2026-09-14 | §6a.8 new: enforcement-boundary check/act atomicity (integration requirement) — for §6a-dependent security-sensitive side effects, the boundary MUST re-validate or close the synchronous boundary so no authorization-lineage state change commits between decision and effect; the engine exposes the re-validation primitive, the boundary discharges the obligation (E1 purity preserved); V-STATE adds the `authorized@N → ALLOW@N → revoke@N+1 → attempt-effect` fail-closed vector |
| v2.2 | 2026-09-12 | New §6a state blocks and state transitions (controlled state source): `state`/`transitions` optional top-level fields; controlled state injection (`state.*` reuses the field node, no new nodes); resource caps (≤4 variables/2–4 enums/≤256 combinations/≤32 transition rules/≤16 event names/≤8-key payload) |
| v2.2 | 2026-09-12 | State-transition audit closure: transition chain + snapshot + validity + provenance anchoring; `state_snapshot` extended to {values,state_version,transitions_head}, keys code-point-ascending by state-variable name + string NFC normalization |
| v2.2 | 2026-09-12 | Same-variable conflict decidable mutual-exclusion check ((0)-(4) sound constraints: unconditional-unique + top-level-conjunct-only proof basis, reject rather than silently accept) |
| v2.2 | 2026-09-12 | §6a.7 event and transition evaluation context: event object event_id/on/at/actor/payload; guards read only state.* + event.*, not free fact |
| v2.2 | 2026-09-12 | Event-handling atomicity (evaluate guards one by one in definition order → stop at the first EvaluationError committing no set, fail-closed → commit all sets at once on full pass; order within one event must not affect the result); event injection authentication (actor enters the audit record, unauthenticated events rejected); concurrency serialization (event handling and evaluate are mutually exclusive); genesis record (initial generates an initial snapshot + canonical-tree hash) |
| v2.2 | 2026-09-12 | Load-time validation full set (any expression position referencing an undeclared state.<name>, a field exactly "state", or a transitions.when referencing free fact are all rejected); state scoping (only a first-segment-`state` path enters the controlled namespace, context.state.* still resolves as fact but lint warns) |
| v2.2 | 2026-09-12 | `decision` renamed `audit_as` (audit carrier only, does not participate in evaluation/short-circuit, narrowed to {ALLOW,NOTIFY,DELEGATE,ESCALATE,REQUEST_HUMAN}); `transitions` gains `enabled` (default true) and `reason` constraint (`[a-z][a-z0-9_]{0,31}` + document-unique); `state` gains `display_name` (bilingual, gloss uses en falling back to name) |
| v2.2 | 2026-09-12 | `transitions.when` node whitelist (Simple conditions + time nodes; no quantifiers/arithmetic/aggregates/fn/within/rate); state machine has no time trigger (freshness via external sweeper or guard time comparison) |
| v2.2 | 2026-09-12 | §7.0.2 evaluation algorithm gains an events-happen-first declaration (step 0) and catch-all lazy two-pass, fixes the WORKFLOW cross-reference (state machine split: §6 workflow / §6a authority); §7.0.3 adds the `state_snapshot` output field (enters the hash preimage); E1 extends the authority-state snapshot as a controlled external input; glossary adds state variable / state space / state transition / controlled injection / state_snapshot / transition validity |
| v2.1 | 2026-09-12 | §8.2 pins the canonical encoding of number literals to JCS (RFC 8785) IEEE 754 number serialization (aligned with the reference implementation); distinguishes the *evaluation* convention (E2 fixed-point) from the *encoding* convention (§8.2 canonical serialization); E12 clarifies Guard-context semantics (a Guard context fail-closes for all tiers; a non-Guard context fail-closes tier≤2 and folds tier 3–5 to false); glossary adds non-Guard context / evaluation scope / encoding scope; §7.3(a) spells out the missing-field arithmetic split (comparison node→false, arith node→EvaluationError); §7.0.2/§7.0.3 aligned with E12 |
| v2.1 | 2026-09-10 | §7.3(c) clarifies conformance compares the scale-14 fixed-point value **numerically** (trailing-zero insensitive: `"35"` ≡ `"35.0"`), not the string spelling — the decimal-string form is an *encoding*, not the comparison unit; §7.3(a) extends the warning asymmetry to logic nodes (`and`/`or` over a non-boolean operand fold silently) and quantifiers (`all`/`any`/`none` over a non-array operand record `type_mismatch`); §7.3(b) clarifies quantifier non-array `over`; §7.3(d) clarifies the ReDoS fold (`false` + `regex_re_dos`, `errored: false`); §7.3(g) new: E4 structural resource-limit violations throw (`value: null` + `threw: true`), E5 exclusivity records `value: true`; §5.5 adds gloss rendering details (not(eq) normalization, quoted string/list literals, parenthesized arithmetic); §7.3(a) clarifies the `errored` reading: `in`/string/`length`/`aggregate` record a `type_mismatch` warning but `errored: false` (a warning only, not an E3 EvaluationError) |
| v2.1 | 2026-09-09 | §7.3(a) annotates the warning asymmetry (comparison/`between` fold silently with no warning; `in`/string/`length`/`aggregate` record `type_mismatch`); §5.5 aligns gloss template wording to the renderer (`in`/`between`/`length`/`match`/`epoch_ms`/`date_part`/`date_add`/`aggregate`/`quantifier`/`var`); §5.5 pins gloss rendering to English canonical (G3 display_name takes the English value; Chinese template is a presentation-only optional projection); §7.2 E3 / §7.3(a) / Appendix E add the `errored` evaluation-error flag: EvaluationError (division by zero / invalid date / arity / type-mismatched arithmetic) → `errored=true` (even though E12 folds to false); type-mismatched comparison and null propagation → `errored=false` (not an error) |
| v2.1 | 2026-09-05 | §7.1 adds item 6: an empty-condition rule (catch-all/fallback) MUST NOT rewrite the decision established by an explicit-condition rule (in either direction); the fallback takes effect only when no explicit rule matches; §7.3(f) clarifies date-time input parsing is whole-second precision (fractional seconds not supported), aligned across implementations |
| v2.1 | 2026-09-04 | §7.3(d) clarifies the safe syntax subset as a regular language: backreferences (`\1`–`\9`, `\k<name>`) and lookaround (`(?=)`/`(?!)`/`(?<=)`/`(?<!)`) are forbidden; inline case flags are not provided (matching is always case-sensitive) |
| v2.1 | 2026-09-03 | §4.1 adds three optional fields — `category` (rule-level override), `enabled` (enable flag), `correction` (CORRECT fix text) — completing the field table and fixed order; §7.0.3 adds the `primary_correction` source cross-reference. Protocol `erdl/v2` unchanged; rule-format version 2.0.0 → 2.1.0 (additive optional fields, non-breaking) |
| v2.0 | 2026-08-30 | Finalized |

---

## Normative References

- **[RFC 2119]** Key words for use in RFCs to Indicate Requirement Levels.

---

*© 2026 Shenzhen Miaojing Technology Co., Ltd. · MIT License*
