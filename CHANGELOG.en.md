# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This repository carries **two orthogonal version lines** (see the "version semantics" note at the head of `erdl-spec.md`):
- **Spec document version** (tracked here): `v2.0` → `v2.1` …
- **Rule-format version** (the top-level `version:` field of `*.erdl.yaml`): `2.0.0` → `2.1.0` …
- **Protocol identifier** `protocol: "erdl/v2"` is a frozen value and does not change with spec upgrades.

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
- README bilingual split: `README.md` rewritten as a developer-first narrative (English) then bilingualized per this repo's naming convention — Chinese promoted to `README.md` (primary), English moved to `README.en.md`, with mutual language-switch links; consistent with `erdl-spec.md`/`.en.md` and the sibling repos (erdl-formal, erdl-vectors) `.md`/`.en.md` convention.

## [2.0.0] - 2026-08-30

### Added
- ERDL language specification v2.0 finalized (`erdl-spec.md` Chinese + `erdl-spec.en.md` English).
- Expression-tree semantic kernel (34 nodes / 10 groups), Simple 30 operators, 13 decision types.
- Reference implementation: `erdl-loader` (document loading), `evaluator` (evaluation engine), `rule-yaml-serializer` (serialization).
