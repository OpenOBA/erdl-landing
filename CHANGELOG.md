# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This repository carries **two orthogonal version lines** (see the "version semantics" note at the head of `erdl-language-spec-v2.1.md`):
- **Spec document version** (tracked here): `v2.0` → `v2.1` …
- **Rule-format version** (the top-level `version:` field of `*.erdl.yaml`): `2.0.0` → `2.1.0` …
- **Protocol identifier** `protocol: "erdl/v2"` is a frozen value and does not change with spec upgrades.

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

- **Language spec renamed to `erdl-language-spec-v2.1.md`** — `erdl-spec.md` / `erdl-spec.en.md` are renamed to `erdl-language-spec-v2.1.md` / `erdl-language-spec-v2.1.en.md` (language-spec vs product-spec naming); all in-repo references are updated.
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
