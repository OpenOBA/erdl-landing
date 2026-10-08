# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This repository carries **three version lines** (see the "version semantics" note at the head of `erdl-language-spec-v2.3.md`):
- **Spec document version**: `v2.0` → `v2.3` … (the document's own revision; independent)
- **Rule-format version** (the top-level `version:` field of `*.erdl.yaml`): `2.0.0` → `2.2.0` …
- **npm package version** (tracked here, as the CHANGELOG section titles): tracks the rule-format version — `2.0.0` → `2.1.0` → `2.2.0-beta.1`.
- **Protocol identifier** `protocol: "erdl/v2"` is a frozen value and does not change with spec upgrades.

## [Unreleased]

### Fixed (2026-10-06, each with regression tests)

- **`then` closed-enumeration check at load (fail-closed)** — a typo'd `then` (e.g. `DENYY`) or a WORKFLOW substate (`WORKFLOW_WAITING`) is now rejected at load time (SPEC §6: the 13-type closed enumeration); previously such values loaded and silently folded as the weakest non-blocking decision at evaluation time (fail-open).
- **`event.at` is engine-injected only** — `injectEvent` no longer accepts an externally provided `at` (SPEC §6a.7.1 / E9 no-wall-clock); previously a caller could forge the evaluation time into freshness guards.
- **`ne` excluded from the exclusivity proof base (soundness)** — §6a.2.3 (2) admits only `eq`/`in` as mutual-exclusion proof bases. Treating `ne x≠5` as the singleton `{5}` unsoundly proved `ne 5` vs `ne 6` mutually exclusive (x=7 satisfies both); such pairs now correctly report a transition conflict at load.
- **Decision-table default row and per-row priority (SPEC §5.4)** — the default row (`when: []`) MUST be the last row (else load error — it would shadow every subsequent row); explicit per-row `priority` is honored (previously silently discarded in favor of row order) and a priority conflicting with row order is a load error.
- **§7.1a tier 0–2 interception lock implemented** — a restrictive rule with declared `tier` 0–2 can no longer be covered by any override ALLOW (locked rules always count as uncovered); undeclared `tier` preserves existing behavior.

### Removed (2026-10-06)

- **`op-sem-registry` module removed** (ts + yaml): the operation-semantics classifier had no consumers in this package and no SPEC / REGISTRY.md / API.md anchor. Recoverable from git history.
- **`Evaluator.simulate()` removed**: unused public API carrying a side effect — it consumed within/rate counters, violating E1 purity.
- **Dead constant `MAX_REGEX_STEPS` removed** from `limits.ts`: superseded by `REGEX_MAX_INPUT_LENGTH` in `safe-regex.ts` (the operative E4 regex input-length cap).
- **AV-15/16 and §6b.4 removed** (2026-10-07) — the delegated-authority adversarial family converges to AV-01~14; AV-15 (re-authorization provenance, §6a.10) and AV-16 (multi-root basis-scoped revocation, §6b.4) together with §6b.4 (multi-root composition) are out of current scope (single-root delegation model).

### Fixed (2026-10-07, final review)

- **tier enters the rule canonical object** — `rule_set_hash` now includes the rule `tier` (absent encodes as `null`), so two rule sets differing only in `tier` no longer share a hash while folding differently (§8.2a.1a).
- **§7.1a resolve pseudo-code completed** — the fold now short-circuits on `EMERGENCY_HALT` (terminal, strength 0) and, when `indeterminate_rules` is non-empty in Guard context, merges `on_indeterminate` as a synthetic hit (§7.0.2, §7.1a).
- **E1 within/rate refined** — `within`/`rate` counting is a controlled side effect written during evaluation (not idempotent for these two operators), replacing the earlier two-phase description (§5.2.5, E1).
- **Event authentication evidence downgraded** — §6a.5.4/§13 now state an authenticated event SHOULD carry verifiable authentication evidence (the chain records only the `actor` string today, so "who approved" is not yet independently verifiable).
- **§11 conformance criterion clarified** — "DO" denotes the RFC-002 governance-layer decision object (the cross-implementation vector layer); the language-layer evaluation-result DO is pinned formally and self-verified by the engine.
- **Adversarial vector family renumbered** — removal-reference cleanup: §6b.5 → §6b.4, AV-01~14 in the glossary/acknowledgements, and the "authorization basis" glossary entry no longer cites the deleted section.

### Docs (2026-10-06)

- **API.md marks the template engine as a non-normative tool** (the 12-template YAML generator is an engine-bundled convenience, not part of SPEC conformance).
- **spec: S2 number-encoding sync complete** (2026-10-07) — §8.2.1 literal row and §8.2a “numbers JCS” now encode numbers as the typed object `{"n":"<decimal>"}` (aligned with §8.2 body); §4.1 field table adds ring default 3 (advisory) and tier absent = undeclared (never locked); §8.2a.1 adds the language-layer DO verification approach (formal pinned field order/key set + engine self-verification, no dedicated cross-impl vector family).

### Security & Correctness (S1–S6 + M1/M2/M5/M7/M10 closure — breaking)

- **S2 typed number literals** — number literals canonicalize as a typed object `{"n":"<decimal string>"}` (not a bare decimal string), eliminating the number/string hash collision (`eq(x, 15)` vs `eq(x, "15")`); tree hashes gain a versioned domain-separation prefix `erdl-tree-v3:`.
- **S1 DO sub-structure definition** — added key-set/key-order/absence encoding for `matched_rules`/`unless_exemptions`/`canonical_trees`/`eval_warnings`/`temporal_state`; unified naming to snake_case; added `indeterminate_rules` to the DO field order.
- **S4 engine_id out of the hash preimage** — `eval_profile` no longer enters `engine_id` into the preimage (it broke cross-implementation byte-identity); `spec_version` remains as the schema selector.
- **S3 on_indeterminate** — `metadata.on_indeterminate` defaults to `REQUEST_HUMAN` (tier 0–2 MAY configure `DENY`); a rule whose `when` evaluates to unknown no longer falls through to the fallback ALLOW (fail-open fixed); unknown rules are recorded in `indeterminate_rules`.
- **S5 set-based fold** — decision merge is now set-based (permutation-invariant) instead of sequential; an override ALLOW covers a DENY only when `level(o) > level(r)` and `ring(o) ≤ ring(r)` (an outer ring MUST NOT cover an inner ring); WORKFLOW is no longer terminal (only EMERGENCY_HALT short-circuits); tier 0–2 restrictive rules are `locked`.
- **S6 scope** — the condition-level `scope` field now loads and groups counters by the subject field's value (not a literal path); counter keys include rule name + window + scope value.
- **M1/M2 unknown propagation** — missing-field arithmetic and empty aggregates/quantifiers fold to `unknown` (not `false`/EvaluationError), so `not(...)` never flips to true (fail-open fixed).
- **M5 rule text enters rule_set_hash** — `instruction`/`reason`/`correction`/`explanation`/`alternative` now enter the rule canonical object (they surface as `primary_*`; correction is safety-relevant).
- **M7 audit record fields** — `transition`/`transition_error` records now carry `fired` (the fired transition name) and `reason` (the transition's semantic identifier).
- **M10 resource-limit violations recorded** — expression resource-limit breaches now record an `eval_warnings` entry (not a bare console warning), preserving audit information.

### Added
- **§7.1a decision merge (fold)** — new section defining the decision-strength partial order (EMERGENCY_HALT/WORKFLOW=0 → DENY/ROLLBACK/QUARANTINE=1 → REQUEST_HUMAN=2 → ESCALATE=3 → DELEGATE=4 → DEFER=5 → CORRECT=6 → GUIDE=7 → ALLOW=8) and the fold algorithm; NOTIFY is a side action that does not participate in the main decision. (review A1)
- **§8.2a.1a rule-set hash** — `rule_set_hash` = sha256(JCS({ fallback_decision, rules: [rule canonical objects] })) where each rule canonical object is { name, when_tree, unless_tree, then, priority, override, ring, enabled }; added to the DO field order (after canonical_trees) and the evaluation result; closes the gap that canonical_trees covers only matched rules' when trees, so a third party can verify "no other rule should have matched". (review A2)
- **§8.2a.1b evaluation options (eval_profile)** — `eval_profile` = { strict, context, contract_hash, spec_version, engine_id } added to the DO field order; strict mode, Guard/analysis context, field-contract hash, spec version and engine id now enter the preimage so a third party can recompute. (review A3)
- **§8.2.1 canonical-tree encoding** — pinned the S-expression node JSON shape for every node (literal/field/var/and/or/not/compare/in/string/exists/length/between/quantifier/arith/temporal/aggregate/fn); commutative nodes (and/or/add/mul) keep definition order (not sorted); precedence clause: prose prevails over vectors. (review A4)
- **§7.3(c) numeric-scope hardening + §8.2 decimal-string encoding** — load-time rejection of out-of-range literals (fractional digits ≤ 14, significant digits ≤ 34); overflow/division-by-zero are EvaluationError (E12 fail-closed); comparison acts on the exact rational; round(x[, digits]) with half-even mode; canonical number literals serialize as **decimal strings** (not JCS IEEE754) to avoid loss/collision beyond 2^53. (review A5)
- **§7.3(a) Kleene three-valued logic** — true/false/unknown; `not(unknown)=unknown` (closes the "missing → false → not true → fail-open" hole); `and`/any-false→false, `or`/any-true→true, otherwise unknown; a rule matches only when `when === true`; top-level unknown does not match (Guard may configure `metadata.on_indeterminate`). (review A6)
- **§7.0.2/E1 evaluation side effects & short-circuit clarified** — logic nodes (`and`/`or`/`quantifier`) evaluate fully (no short-circuit); `WORKFLOW` MUST NOT block later interception (starts only when no DENY/ROLLBACK/QUARANTINE/EMERGENCY_HALT matched); `within`/`rate` counting is two-phase (evaluate reads only the pre-state; the Guard commits `record` atomically after the decision, consistent with §6a.8). (review A7)
- **§5.2.5 counting-subject scope** — `within`/`rate` gain an explicit `scope` (which field to group by, e.g. `user.id`/`tool.name`), so distinct subjects no longer share a single global counter; the count-isolation key includes `scope`. (review A8)
- **§6a.5.5 instance identity + create/restore entries** — genesis carries an `instance_id` (distinct instances of the same document get distinct genesis hashes, preventing chain transplant across instances); two load entries: create (write genesis) and restore (verify the latest authoritative head, fail-closed — never reset state to `initial`). (review B1)
- **§8.2a.1 fact Merkle commitment (optional profile)** — `fact` may contain personal data/secrets; optionally commit it via a Merkle commitment (salted-hash leaves, DO stores only the root `fact_hash`, on-demand field disclosure with proofs); desensitization MUST precede evaluation (the evaluated value equals the recorded value). (review A9)
- **§6a.2.1 event-handling receipt** — `injectEvent` returns an explicit receipt `committed | noop | rejected` (not just a boolean); a revoke-semantics `noop` MUST write a chain-external alert (or chain summary) so operators do not wrongly believe a revocation happened. (review B2)
- **§6a.7 expiry/entitlement carrying** — expiry/quota scalar constraints MUST be carried by an authorization-root-signed credential field (written into the chain), NOT by caller-payload `event.expires` (a caller can omit/extend it); "inject an `exercise` event before every `evaluate`" is an explicit boundary obligation. (review B3)
- **§6a.5.5 rule_set_hash binding** — `doc_tree_hash` excludes rules, so `rule_set_hash` (§8.2a.1a) and `doc_tree_hash` jointly anchor "state machine + rules" (verification requires both consistent); `metadata.name` is not a security boundary. (review B4)
- **§6a.2.2 error-attribution vs order-independence clarified** — the set result is order-independent, but error attribution follows definition order, so definition order is hash semantics (resolves the internal contradiction between §6a.2.1 and §6a.2.2). (review B5)
- **§6a.5.4 event authentication evidence** — an authenticated event MUST carry verifiable evidence (signature or proof digest, e.g. JWS `kid` + digest) written into the transition record, so "who approved" is independently verifiable (closing the forgeable-string `actor` hole). (review B6)
- **§5.4 decision table is syntactic sugar for `rules[]`** — the table expands row-by-row into rules (one rule per row, fields attributed per row); the example priority direction is unified with §4.1 (smaller = higher precedence), and the default row MUST be last with the largest priority. (review C1)
- **§5.5 gloss contradiction fixes** — removed the `exists` `is_*`/`has_*` "is true" special case (renders "is present" uniformly, since false also counts as present); G3 now falls back to the raw field path when no field contract exists (so `gloss == render(tree)` lint remains reproducible). (review C2)
- **§1.1/§3 Entity namespace wording + field-path grammar** — Entity reworded as a preset namespace convention (not a top-level declaration, resolving the §1.1 contradiction); added a field-path grammar (dot-separated snake_case segments, `# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This repository carries **three version lines** (see the "version semantics" note at the head of `erdl-language-spec-v2.3.md`):
- **Spec document version**: `v2.0` → `v2.3` … (the document's own revision; independent)
- **Rule-format version** (the top-level `version:` field of `*.erdl.yaml`): `2.0.0` → `2.2.0` …
- **npm package version** (tracked here, as the CHANGELOG section titles): tracks the rule-format version — `2.0.0` → `2.1.0` → `2.2.0-beta.1`.
- **Protocol identifier** `protocol: "erdl/v2"` is a frozen value and does not change with spec upgrades.

## [Unreleased]

### Added
- **§7.1a decision merge (fold)** — new section defining the decision-strength partial order (EMERGENCY_HALT/WORKFLOW=0 → DENY/ROLLBACK/QUARANTINE=1 → REQUEST_HUMAN=2 → ESCALATE=3 → DELEGATE=4 → DEFER=5 → CORRECT=6 → GUIDE=7 → ALLOW=8) and the fold algorithm; NOTIFY is a side action that does not participate in the main decision. (review A1)
- **§8.2a.1a rule-set hash** — `rule_set_hash` = sha256(JCS({ fallback_decision, rules: [rule canonical objects] })) where each rule canonical object is { name, when_tree, unless_tree, then, priority, override, ring, enabled }; added to the DO field order (after canonical_trees) and the evaluation result; closes the gap that canonical_trees covers only matched rules' when trees, so a third party can verify "no other rule should have matched". (review A2)
- **§8.2a.1b evaluation options (eval_profile)** — `eval_profile` = { strict, context, contract_hash, spec_version, engine_id } added to the DO field order; strict mode, Guard/analysis context, field-contract hash, spec version and engine id now enter the preimage so a third party can recompute. (review A3)
- **§8.2.1 canonical-tree encoding** — pinned the S-expression node JSON shape for every node (literal/field/var/and/or/not/compare/in/string/exists/length/between/quantifier/arith/temporal/aggregate/fn); commutative nodes (and/or/add/mul) keep definition order (not sorted); precedence clause: prose prevails over vectors. (review A4)
- **§7.3(c) numeric-scope hardening + §8.2 decimal-string encoding** — load-time rejection of out-of-range literals (fractional digits ≤ 14, significant digits ≤ 34); overflow/division-by-zero are EvaluationError (E12 fail-closed); comparison acts on the exact rational; round(x[, digits]) with half-even mode; canonical number literals serialize as **decimal strings** (not JCS IEEE754) to avoid loss/collision beyond 2^53. (review A5)
- **§7.3(a) Kleene three-valued logic** — true/false/unknown; `not(unknown)=unknown` (closes the "missing → false → not true → fail-open" hole); `and`/any-false→false, `or`/any-true→true, otherwise unknown; a rule matches only when `when === true`; top-level unknown does not match (Guard may configure `metadata.on_indeterminate`). (review A6)
- **§7.0.2/E1 evaluation side effects & short-circuit clarified** — logic nodes (`and`/`or`/`quantifier`) evaluate fully (no short-circuit); `WORKFLOW` MUST NOT block later interception (starts only when no DENY/ROLLBACK/QUARANTINE/EMERGENCY_HALT matched); `within`/`rate` counting is two-phase (evaluate reads only the pre-state; the Guard commits `record` atomically after the decision, consistent with §6a.8). (review A7)
- **§5.2.5 counting-subject scope** — `within`/`rate` gain an explicit `scope` (which field to group by, e.g. `user.id`/`tool.name`), so distinct subjects no longer share a single global counter; the count-isolation key includes `scope`. (review A8)
- **§6a.5.5 instance identity + create/restore entries** — genesis carries an `instance_id` (distinct instances of the same document get distinct genesis hashes, preventing chain transplant across instances); two load entries: create (write genesis) and restore (verify the latest authoritative head, fail-closed — never reset state to `initial`). (review B1)
- **§8.2a.1 fact Merkle commitment (optional profile)** — `fact` may contain personal data/secrets; optionally commit it via a Merkle commitment (salted-hash leaves, DO stores only the root `fact_hash`, on-demand field disclosure with proofs); desensitization MUST precede evaluation (the evaluated value equals the recorded value). (review A9)
- **§6a.2.1 event-handling receipt** — `injectEvent` returns an explicit receipt `committed | noop | rejected` (not just a boolean); a revoke-semantics `noop` MUST write a chain-external alert (or chain summary) so operators do not wrongly believe a revocation happened. (review B2)
- **§6a.7 expiry/entitlement carrying** — expiry/quota scalar constraints MUST be carried by an authorization-root-signed credential field (written into the chain), NOT by caller-payload `event.expires` (a caller can omit/extend it); "inject an `exercise` event before every `evaluate`" is an explicit boundary obligation. (review B3)
- **§6a.5.5 rule_set_hash binding** — `doc_tree_hash` excludes rules, so `rule_set_hash` (§8.2a.1a) and `doc_tree_hash` jointly anchor "state machine + rules" (verification requires both consistent); `metadata.name` is not a security boundary. (review B4)
- **§6a.2.2 error-attribution vs order-independence clarified** — the set result is order-independent, but error attribution follows definition order, so definition order is hash semantics (resolves the internal contradiction between §6a.2.1 and §6a.2.2). (review B5)
- **§6a.5.4 event authentication evidence** — an authenticated event MUST carry verifiable evidence (signature or proof digest, e.g. JWS `kid` + digest) written into the transition record, so "who approved" is independently verifiable (closing the forgeable-string `actor` hole). (review B6)
- **§5.4 decision table is syntactic sugar for `rules[]`** — the table expands row-by-row into rules (one rule per row, fields attributed per row); the example priority direction is unified with §4.1 (smaller = higher precedence), and the default row MUST be last with the largest priority. (review C1)
- **§5.5 gloss contradiction fixes** — removed the `exists` `is_*`/`has_*` "is true" special case (renders "is present" uniformly, since false also counts as present); G3 now falls back to the raw field path when no field contract exists (so `gloss == render(tree)` lint remains reproducible).  root, `$.path`, controlled `state.*`/`event.*`). (review C3)
- **§6a/§6b dangling-reference cleanup + normative references** — removed the dangling `§0` layering reference; fixed `DELEGATE` decision-type cross-reference (§5 → §6); removed internal ticket `P0-4`; added normative references (RFC 8785/8259, YAML 1.2, UAX #15, FIPS 180-4, ISO 8601, IEEE 754). (review C4)
- **§7.2 E-table contradiction fix** — removed the wall-clock `per-rule≤50ms` hint from the all-MUST E4 row (contradicted E1/E9); downgraded it to an explicit non-MUST "operational suggestion" note below the table. (review C5)
- **Version-strategy clarification (header + §2.3)** — added a three-state maturity model (Working Draft / Candidate / Stable) and clarified that breaking changes are limited to document major versions; resolved the §2.3 non-breaking-promise tension by scoping it to rule-format compatibility only, with the DO hash-preimage schema versioned by `eval_profile.spec_version`. (review C7)
- **String-normalization extension nodes** — added unary `string_transform` nodes `casefold`/`trim`/`path_normalize` (deterministic, extension profile) to close the string-capability gap; `match` stays case-sensitive, case-insensitive matching is done via explicit `casefold`. Engine (`node-types`/`s-expression`/`evaluator`/`limits`/`gloss`) + spec (§5.2.2/§5.3.1/§8.2.1) + tests (string-transform.spec.ts). (review D1)
- **External-list node `in_set{ref,digest}`** — added the unary `in_set` extension node for large-list membership (e.g. AML/sanction lists >256 items) that is not subject to `in`'s 256 inline cap; list body is injected via `resolveSet(ref)`, versioned-hash `digest` pins integrity (digest mismatch / unregistered ref → fail-closed). Engine (`node-types`/`s-expression`/`evaluator`/`limits`/`gloss`) + spec (§5.2.2/§5.3.1/§8.2.1/§9.3) + tests (in-set.spec.ts). (review D2)
- **Regex dialect portability (§7.3(d))** — dropped the non-portable "regex steps ≤10000" metric (RE2 has no backtracking step count) in favor of an input-length cap + linear-time engine; added the safe-syntax-subset EBNF; over-limit folds to `unknown` (not `false`) so `not(match(...))` does not flip (fail-open). Engine `stringMatch` returns `TriBool`. (review D3)
- **Key-order alignment with JCS (§6a.5.3/§6a.1)** — replaced "UTF-8 code-point ascending" (diverges from RFC 8785 JCS UTF-16 code-unit order for non-BMP characters) with the JCS key order; restricted state variable `name`/`values` to ASCII identifiers so key order is unambiguous. (review D5)
- **Scope claims vs. mechanism (§1.2/§1.3/§1.5)** — marked the "LLM deterministically executes / conversational interface is the unified entry point" claim as informative with the premise that determinism covers only the post-translation evaluation layer (translation is LLM-dependent); scoped "who approved" traceability to actor identity with authentication evidence (§6a.5.4); changed the core commitment from "Semantics = tree = hash" to the one-directional "same canonical tree ⇒ same hash" (equivalent semantics do not guarantee the same tree). (review E1)
- **`audit_as` semantics (§6a.2)** — changed from MUST to MAY (defaults to `NOTIFY`); clarified it is an audit *classification* label that borrows the `then` vocabulary but is not an evaluation decision (aligns the spec with the engine, which already treats it as optional). (review B7)
- **Boundary minimal API (§6a.11)** — pinned the engine's minimal revalidation API (`get_head`/`get_value`/`get_chain`/`snapshot`/`inject_event`) as interface signatures, resolving the "§6a.8–§6a.10 integration obligations without interface definitions" gap (aligned with the engine's exposed primitives). (review B8)
- **`when` type unification (§4.1)** — changed `when` from `object` to `object / string`, clarifying the string form is only the catch-all `"true"` literal and the decision-table default row `when: []` is a row-level sub-field (§5.4), not a third top-level form. (review C6)
- **Naming unification (C8)** — renamed field-contract `displayName` → `display_name` (snake_case, matching §6a.1 state `display_name`); clarified `definition_period` is informational (not entering kernel/hash); distinguished the DO (Decision Object) from the Evaluation Result (§7.0.3 runtime output). (review C8)
- **Time-semantics de-implementation (§7.3(f))** — replaced the JS-specific `toISOString` serialization name with a language-neutral RFC 3339 UTC subset; clarified `epoch_ms` returns milliseconds (whole-second constrains only string-literal parsing); pinned `days_between` floor to toward-negative-infinity. (review D4)
- **Function-delegation convention & registry (Appendix D)** — pinned the calling convention (`name(params) -> returnType`), registry entry shape, hash preimage (`fn_id`/`version`/`args_hash`/`result_hash`), and forbade Grade C (fn delegation) at tier 0–2. (review D6)
- **Design trade-offs & related work (Appendix F)** — added a non-normative comparison against CEL/DMN/XACML/UCAN/OAuth 2.0 Token Exchange, and articulated the kernel/writing-form separation trade-off. (review D7)
- **Standard chapters (§11–§15)** — added Conformance (core/extension levels), Security Considerations, Privacy Considerations (fact Merkle commitment + desensitize-before-evaluate), Extension Registration (FREEZE-2 + profile registration), and Trademark & Patent Policy. (review D8)

### Changed
- **Evaluator decision merge rewritten as a fold** — `DECISION_STRENGTH` + `foldDecision()` replace the ad-hoc first-match/accumulate branches; tightening is free, relaxing requires `override`, same-direction takes the stronger; NOTIFY records into `matched_rules` without changing the decision. (review A1)
- **EvaluationResult gains `ruleSetHash`** — `computeRuleSetHash()` hashes the full rule-set semantics (fallback decision + every rule's canonical object). (review A2)
- **EvaluationResult gains `evalProfile`** — `computeContractHash()` hashes the field contracts; `SPEC_VERSION` (`v2.3`) + `ENGINE_ID` (`erdl-engine`) constants added. (review A3)

## [2.2.0-beta.1] - 2026-10-04

### Added
- **State blocks and state transitions (§6a, new)** — `state`/`transitions` as two optional top-level fields: controlled state source; resource caps (≤4 variables / 2–4 enums / ≤256 combinations / ≤32 transition rules / ≤16 event names / ≤8-key payload); state-transition audit closure (transition chain + snapshot + validity + provenance anchoring, `state_snapshot` extended to `{values, state_version, transitions_head}`); same-variable conflict decidable mutual-exclusion check; event injection authentication; genesis record; concurrency serialization; load-time validation full set.
- **§6a engine implementation (load + runtime)** — `state-definition.ts` (load-time validation: state/transitions structure, same-variable conflict, state/event reference checks, transition-guard whitelist) + `state-machine.ts` (event-injected FSM: eager FIFO, event_id de-dupe, atomic guard evaluation, genesis/transition/transition_error audit chain, on-demand `state_snapshot`); `Evaluator` gains `stateMachine` option + `state.*` controlled read + `EvaluationResult.stateSnapshot`.
- **§6a.8 enforcement-boundary check/act atomicity** — the boundary re-validates `{state_version, transitions_head}` or closes the synchronous boundary before committing a security-sensitive side effect.
- **§6a.9 latest-authoritative-head freshness (anti-rollback)** — replay verification proves integrity/provenance, not freshness; the boundary MUST establish the latest authoritative head (not superseded) or fail closed.
- **§6 decision-type design rationale** — 13 types exist to maximize LLM value in the AI era, not simply allow/deny.
- **§6a.10 authorization-root provenance** — a transition that makes authority exercisable MUST carry authorization-root provenance (actor attributable to a principal entitled to establish it); re-authorization after revocation MUST have a new valid authorization basis; a descendant MUST NOT self-restore revoked authority.
- **§6b delegated-authority security model (organization behavior layer)** — umbrella "delegation must never manufacture authority"; five invariants INV-01~05; mechanism-neutral revocation freshness; adversarial vector family AV-01~14 + AV-15/16.
- **§6b.4 basis-scoped revocation (multi-root composition)** — effective authority = union over currently-valid authorization bases; `revoke(basis-X)` removes exactly basis-X's derivable authority (no less/no more); MUST NOT reduce a subject to a global per-subject revoked/authorized bit; a surviving basis MUST NOT preserve authority unique to a revoked lineage; glossary adds `authorization basis`.
- **§7.0.1a + §7.3(a) field contract + strict mode (engine)** — EntityFieldContract `default_value`/`optional: false` (fail-closed E12) + comparison-node type mismatch records a `type_mismatch` warning under strict mode; fixes "fail-open" and "silent false".
- **§8.2a.1 fact in the DO** — added `fact` (the input fact object, `context` in RFC-002) to the evaluation-result DO field order; fixes the normative gap of "DO hash preimage missing the input fact" (breaking: field-order change).

### Changed
- **`decision` renamed `audit_as`** — audit carrier only, narrowed to {ALLOW, NOTIFY, DELEGATE, ESCALATE, REQUEST_HUMAN}.
- **`transitions` gains `enabled` (default true) and `reason`; `state` gains `display_name` (bilingual).**
- **§7.3 subsections renumbered to letter labels (a)–(g)**; long chapters split into numbered subsections (§5.2/§5.3/§5.4/§5.5/§6a.2/§6a.5/§6a.7/§8.2a/§10.2/§10.3).
- **SPEC document version bumped to v2.3** (fact + strict mode + field contract); rule-format `version:` stays 2.2.0 (no rule-format change); spec file renamed `erdl-language-spec-v2.1.md/.en.md` → `erdl-language-spec-v2.3.md/.en.md`. **npm package version 2.1.0-alpha.9 → 2.2.0-beta.1** (first beta; tracks the rule-format version, not the SPEC document version).

### Fixed
- **§7.1 item 5**: `override` on a DENY is inert — tightening (DENY/ROLLBACK/QUARANTINE covering an ALLOW) is the default and no longer blocked by same-ring override. Evaluator `restrictive` branch now tightens unconditionally.
- **§7.1 items 2/6 + override-absent sort**: clarified item 2 ("sort by `override` level") and item 6 ("`when` is the literal `true`"); aligned `override` absent to "default normal" (erdl-formal absent rank 4 → 2), closing erdl-vectors#4 SPEC-REVIEW A/B/C.

## [2.1.0-alpha.9] - 2026-09-12

### Added
- **`EvaluationResult.canonicalTrees` now carries the canonical tree snapshot** (`tree` field, the canonical-tree JSON) alongside the `sha256:` hash — a matched rule's evidence is independently recomputable (E6).
- **`RuleDefinition.tier` (0–5) wired into loading and evaluation** — E12 folds evaluation errors by tier: tier 0–2 (or unspecified) fail-close (`DENY`), tier 3–5 fold to `false`.
- **`evaluate(rules, context, options)` accepts `options.asOf` and `options.fallbackDecision`** — the explicit fallback replaces the `context['metadata.decision']` string-key hack (S9); `asOf` is recorded into the result (E9).
- **`EntityFieldContract.displayName` is bilingual `{ zh, en }`** — `buildFieldNameMap(contracts, lang)` selects the language (G3; canonical English gloss takes `en`).
- **fn delegation: non-deterministic functions are rejected on the Guard path** — a registered but non-deterministic fn returns an errored result (`not_ruleable`); `invoke`/`invokeSync` both record `argsHash` + `resultHash` (sha256, Appendix D).

### Changed
- **SPEC §4.1** adds the `tier` field; **§7.0.3** lists `canonical_trees` / `eval_warnings` / `errored` / `as_of`; **§8.2** disambiguates the E2 evaluation scope (fixed-point string) from the encoding scope (JCS number); **E4** marks the 50ms per-rule limit as a DoS-guard implementation hint, not evaluation semantics.
- **override no longer skips the remainder of its ring** — the `skipRing` short-circuit is removed, aligning with §7.0.2 "no short-circuit".

### Fixed
- **`unlessExemptions` is now returned on the metadata-decision fallback branch** — an unless-exempted rule with no other match previously lost its exemption record.
- **load-time validation**: `when` strings accept only `"true"`; `expr`+`conditions` are mutually exclusive; `metadata.name` required; unknown top-level fields rejected; duplicate rule ids rejected (B4/S6/N5).
- **decision tables compile into one rule per row** — operator-tuple rows, empty-row catch-all (literal `true`), row-order priority (B3).
- **gloss**: aligned §5.5 templates (`the last day of…`, `at least one element in…`, `not (X exists)`, `ne` only for `not(eq)`); every rule carries a gloss + `lintGloss` (B5).
- **removed dead code**: `field_absent` warning kind, `MAX_EVAL_MS`, `js-yaml` dependency (N2/N3).

## [2.1.0-alpha.8] - 2026-09-11

### Changed
- **SPEC §7.3(a)**: clarified the `errored` reading in the warning asymmetry — `in`/string/`length`/`aggregate` record a `type_mismatch` warning but `errored: false` (a warning only, not an E3 EvaluationError). Removes the ambiguity an independent runner surfaced (A17).
- **SPEC §7.3(a)/(b)**: extended the warning asymmetry — logic nodes (`and`/`or` over a non-boolean operand) fold silently; quantifiers (`all`/`any`/`none` over a non-array operand) record `type_mismatch` (both `errored: false`). Closes the gaps an independent runner surfaced beyond A17.
- **SPEC §7.3(d)**: clarified the ReDoS fold — a regex violating the limits folds to `false` + `regex_re_dos` warning + `errored: false` (not an E3 EvaluationError).
- **SPEC §7.3(g)** (new): E4 structural resource-limit violations throw (`value: null` + `threw: true`, not an evaluation error); E5 load-time exclusivity records `value: true` (= violation detected). Constraint-verification results are not evaluation results.
- **SPEC §5.5**: added gloss rendering details — `not(eq(x,y))` normalizes to `ne`, string/list literals render quoted, arithmetic nodes render parenthesized.
- **SPEC §7.3(c)**: clarified conformance compares the scale-14 fixed-point value **numerically** (trailing-zero insensitive: `"35"` ≡ `"35.0"`), not the string spelling — the decimal-string form is an *encoding*, not the comparison unit.

- **Language spec renamed to `erdl-language-spec-v2.3.md`** — `erdl-spec.md` / `erdl-spec.en.md` are renamed to `erdl-language-spec-v2.3.md` / `erdl-language-spec-v2.3.en.md` (language-spec vs product-spec naming); all in-repo references are updated.
- **Expression-layer vector count aligned to 240** — the V-ENGINE expression layer now counts 240 vectors (was 239); the 240 expression-layer vectors are independently verified by the `concordia-python-expression` runner (Erik Newton, Concordia).

## [2.1.0-alpha.7] - 2026-09-09

### Fixed
- **Evaluation errors mark `errored: true` (E3)**: division by zero, invalid date, arity violation, and type-mismatched arithmetic operands now return `err()` (`errored: true`) instead of `ok(null)` (`errored: false`); a type-mismatched **comparison** and null/missing-field propagation stay normal `false` results (`errored: false`). Aligns the reference engine with the newly-specified `errored` flag (spec §7.2 E3 / §7.3(a)).
- **`length` over a scalar folds to `false`**: present non-string/non-array values fold to `false` with a `type_mismatch` warning (like aggregate non-array §7.3(e)); `length(missing)` still returns `0` (spec §5.2 exists-guard rationale).
- **`in` membership comparison NFC-normalizes strings (E10)**: decomposed vs precomposed strings compare equal, matching `eq`/`ne`.

### Changed
- **SPEC §7.2 E3 / §7.3(a) / Appendix E**: added the `errored` evaluation-error flag — EvaluationError → `errored=true` (even though E12 folds the value to `false`); type-mismatched comparison and null propagation → `errored=false`.
- **SPEC §7.3(a)**: annotated the warning asymmetry (comparison/`between` fold silently with no warning; `in`/string/`length`/`aggregate` record `type_mismatch`).
- **SPEC §5.5**: pinned gloss rendering to English canonical (G3 display_name takes the English value; Chinese template is a presentation-only optional projection).

## [2.1.0-alpha.6] - 2026-09-07

### Fixed
- **`total_evaluated` count drift**: the evaluator derived `total_evaluated` inconsistently — `allMatched.length` on the EMERGENCY_HALT short-circuit path (undercounting a non-match evaluated before it) and `enabled.length` elsewhere (overcounting rules skipped by `skipRing` or catch-all inertness). An explicit `evaluatedCount` now increments when a rule's unless/when evaluation is actually entered, used on every return path. Conformance vectors: non-match + EMERGENCY_HALT = 2 evaluated; explicit match + inert catch-all = 1.

### Changed
- **SPEC §7.0.3 `total_evaluated` wording** (EN + CN): clarified as "the total number of rules whose `unless`/`when` evaluation was actually entered (rules skipped by `skipRing` or catch-all inertness are NOT counted)".

## [2.1.0-alpha.5] - 2026-09-06

### Fixed
- **`BLOCKING_DECISIONS` (quality-gate wild-when prohibition) expanded 4 → 6**: `when: true` + `ROLLBACK`/`QUARANTINE` is now as unsafe as `when: true` + `DENY` (§7.4). The evaluator's resolution-polarity set was renamed `BLOCKING_DECISIONS` → `RESTRICTIVE_DECISIONS` (`isBlocking` → `isRestrictive`) to disambiguate the two concepts.
- **§7.0.2 first-match-wins contradiction fixed** (step 3c said "short-circuits the ring" while the same section said "DENY does not short-circuit").
- **§7.1 override cross-ring wording fixed**.
- **`date_add` amount MUST be an integer (§7.3(f))**.
- **Type-mismatched `eq`/`ne` fold to `false` (§7.3(a))** — no fail-open via JS coercion.
- **`!= null` on a present field folds `true`** (G4 regression fix).

### Changed
- README/CHANGELOG default to English (Chinese moved to `.zh-CN.md`); added badges, POC-welcome note and support contact.

## [2.1.0-alpha.4] - 2026-09-05

### Fixed
- **An empty-condition rule (catch-all / fallback) must not rewrite the decision established by an explicit-condition rule (§7.1 item 6, new)**: the `evaluator.ts` ALLOW branch previously lacked a catch-all guard — an empty-`when` (unconditional) ALLOW carrying `override: critical/high` would override an explicit-condition DENY across rings, letting the fallback swallow the explicit block ("override to a less-safe state", violating §7.1 item 5). Now symmetric with the DENY branch: a catch-all ALLOW is popped when an explicit decision is already set, and only acts as fallback when nothing explicit matches. Also adds §7.1 item 6 (bilingual) and the revision-history entry.

## [2.1.0-alpha.3] - 2026-09-05

### Fixed
- **`not_*` Simple operators in the Expression projection (§5.2 exists guard / E7)**: `fromSExpr` previously parsed `not_in`/`not_contains`/`not_starts_with`/`not_ends_with`/`not_exists`/`not_between` leniently as bare `not(...)`, dropping the exists guard added by the simple compiler — on a missing field this flips null-propagation to true (fail-open), and the same operator produced two different canonical trees. Now **removes the lenient branch for `not_in`/`not_contains`/`not_starts_with`/`not_ends_with`/`not_between`** (`{not_in:[...]}` reports `unknown node key`, forcing the Expression projection to write `{not:{in:[...]}}` + an explicit exists); **keeps `not_exists` as the §5.2 exception alias** (bare `not(exists)`, missing field → true, consistent with the canonical tree); aligned with erdl-formal (which never accepts `not_*`) and the V-ENGINE `not_in` vector (exists guard).
- **Strict ISO 8601 parsing for time nodes (§7.3(f), no-suffix ⇒ UTC)**: `epochMs`/`daysBetween`/`toDate` previously used `new Date(String(...))`, parsing a no-timezone-suffix datetime in **local time**, breaking byte-for-byte cross-implementation agreement on non-UTC hosts. Added `parseIsoDateStrict` (date-only → UTC midnight; no-suffix datetime → append `Z`; `Z`/`±HH:MM` → pass through; non-ISO and invalid calendar dates (`2026-02-30`, `hour>23`, etc.) → `invalid_date`), now used by all three, aligned with erdl-formal's strict UTC encoding.
- **Time nodes reject fractional seconds (§7.3(f), whole-second precision)**: `parseIsoDateStrict` drops the `(\.\d{1,9})?` group; `YYYY-MM-DDTHH:MM:SS.SSS` and similar fractional-second inputs return `invalid_date`, aligned with erdl-formal's whole-second SMT encoding, eliminating the JS `Date` fractional-second truncation/rounding ambiguity.

### Changed
- `node-types.ts` header freeze semantics changed from "may only be pruned, never extended" to "additive-only (may add, semantics unchanged, no deletion or redefinition)", aligned with `[FREEZE-2]` and `erdl-schema.ts`/`REGISTRY.md`; the `s-expression.ts` header key list gained `date_add`/`date_part`/`month_last_day`.

## [2.1.0-alpha.2] - 2026-09-04

### Fixed
- **`match` safe-regex subset completion (§7.3(d)③)**: `analyzePattern` previously rejected only "nested quantifiers + adjacent quantified atoms", not **backreferences (`\1`–`\9`, `\k<name>`) and lookaround (`(?=)`/`(?!)` lookahead, `(?<=)`/`(?<!)` lookbehind)** — these non-regular constructs depend on backtracking order, cannot be byte-determined, and cannot be expressed by the SMT verifier (erdl-formal). Added a character-level scan (skipping escapes and character classes, without misreading `\\1`, `[\]]`) that explicitly rejects backreferences and lookaround; atomic groups / possessive quantifiers / conditional groups / inline `(?i)` are already rejected by the JS RegExp parser (SyntaxError) and covered by safeRegExp's try-catch.
- Corrected the misleading "(?i)" wording in the `evaluator.ts` match comment (JS RegExp does not support inline `(?i)`; matching is always case-sensitive).

### Changed
- §7.3(d) (bilingual) clarifies the safe syntax subset as a regular language: backreferences and lookaround forbidden; no inline case flags.

## [2.1.0] - 2026-09-03

### Added
- **`correction` rule field** (§4.1): correction text for the CORRECT decision, the input source of the evaluation output `primary_correction` (§7.0.3). Closes the spec's prior contradiction where the output contract required `primary_correction` but the input field table had no `correction`.
- **`category` rule field** (§4.1, rule-level): defaults to inheriting `metadata.category`; allows mixed categories within one document.
- **`enabled` rule field** (§4.1): rule enable flag, default `true`; when `false` the rule is skipped at evaluation.
- Reference implementation `erdl-loader` maps `correction` → `action.correction`; `rule-yaml-serializer` now emits `correction`/`category`/`enabled` (fixing round-trip loss).
- Added a "Revision History" section at the end of the spec document.

### Fixed
- §4.1 field table and fixed field order now include the three fields above (`correction` was used in implementations/presets before the spec ever defined it — implementation preceded spec; now written back into alignment).
- `rule-yaml-serializer` F3 field-order comment was stale (only reached `unless`, but it also emits `explanation`/`alternative`/`legal_basis`/`source_text`), now aligned with the spec's full order.

### Changed
- Rule-format version `2.0.0` → `2.1.0` (additive optional fields, non-breaking; existing 2.0.0 rules remain valid).
- Spec document version `v2.0` → `v2.1`.
- README bilingual split: `README.md` rewritten as a developer-first narrative (English) then bilingualized per this repo's naming convention — Chinese promoted to `README.md` (primary), English moved to `README.zh-CN.md`, with mutual language-switch links; consistent with `erdl-spec.md`/`.en.md` and the sibling repos (erdl-formal, erdl-vectors) `.md`/`.en.md` convention.

## [2.0.0] - 2026-08-30

### Added
- ERDL language specification v2.0 finalized (`erdl-spec.md` Chinese + `erdl-spec.en.md` English).
- Expression-tree semantic kernel (34 nodes / 10 groups), Simple 30 operators, 13 decision types.
- Reference implementation: `erdl-loader` (document loading), `evaluator` (evaluation engine), `rule-yaml-serializer` (serialization).
