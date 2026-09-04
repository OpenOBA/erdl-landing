# ERDL Registry — Namespace & Registrable Entries Ledger

> [中文](./REGISTRY.md) | English
> **Last updated**: 2026-09-04 — Initial version: registry entries extracted from `src/erdl-schema.ts` (single source of truth) into an external ledger.

> **Purpose**: This file is the **external ledger** for ERDL's *extensible registrable entries*. The frozen semantic enums (34 nodes / 30 operators / 13 decisions / 20 expression-tree types) live in [erdl-spec.md](./erdl-spec.md) — this file **references, never duplicates** them. The single code source of truth is [`src/erdl-schema.ts`](./src/erdl-schema.ts) (prefixes / categories) and [`src/fn-registry.ts`](./src/fn-registry.ts) (function delegation); this file is their human-readable projection, and the code source wins on any conflict.

---

## 1. Rule-name prefixes (CAT prefix → category)

> **Registration-based, extensible, not a closed set.** A new business-domain prefix MUST be registered here and synced to `erdl-schema.ts` before use — **"use first, register later" is forbidden**. The naming gate (`rule-validator`) validates against this table unconditionally.

| Prefix | Category | Notes |
|--------|----------|-------|
| `SEC` | security | Security rules |
| `COD` | coding | Coding standards |
| `ENG` | engineering | Engineering discipline |
| `PRF` | performance | Performance |
| `TST` | testing | Testing |
| `WRT` | writing | Writing |
| `OBS` | observability | Observability |
| `CUS` | custom | Custom |
| `ETH` | compliance | Ethics |
| `CMP` | compliance | Compliance |
| `POL` | compliance | Policy |
| `CNV` | writing | Convention |

## 2. Rule categories (11)

Organizational categories for rules. The category enum is **not frozen** and may be extended (a new category must also register a prefix, see §6).

`coding` · `engineering` · `security` · `writing` · `design` · `performance` · `testing` · `compliance` · `accessibility` · `observability` · `custom`

> ⚠️ **Categories without a prefix**: `design` and `accessibility` currently have **no registered prefix**. To constrain rules under either, register a new prefix first (e.g. `DSN`→design, `A11Y`→accessibility) per §6.

## 3. Forbidden prefixes (6)

Rejected unconditionally by the naming gate (reserved for test/scratch code, kept out of production rule sets):

`test-` · `old-` · `temp-` · `debug-` · `wip-` · `tmp-`

## 4. Rule-name format

A rule name MUST match `[CAT]-[NNN]-[description]`:

- `[CAT]`: 2–4 uppercase letters, registered in §1;
- `[NNN]`: 3–4 digit number;
- `[description]`: lowercase kebab-case.

Regex (same as `rule-validator`): `^[A-Z]{2,4}-(\d{3,4})-[a-z0-9][a-z0-9-]*$`

Examples: `SEC-001-block-exec` · `CMP-014-gdpr-erasure` · `CNV-003-large-write-advisory`

## 5. Function delegation registry (FnRegistry)

For scenarios the ERDL kernel explicitly excludes, the controlled escape hatch is [`src/fn-registry.ts`](./src/fn-registry.ts): register an `fn` and delegate via `fn:<name>` in rules.

| Field | Type | Notes |
|-------|------|-------|
| `signature.name` | string | Function name (unique key; duplicate registration throws) |
| `signature.signature` | string | Signature description, e.g. `isBusinessHours(tz) → boolean` |
| `signature.params` | string[] | Parameter names |
| `signature.returns` | string | Return type |
| `impl` | function | Implementation |
| `timeoutMs` | number | Timeout (default 5000) |
| `onTimeout` | `'throw' \| 'fallback'` | Degradation on timeout (default `throw`) |
| `fallbackValue` | unknown | Fallback when `onTimeout='fallback'` |
| `sandbox` | `'pure' \| 'network' \| 'filesystem'` | Sandbox scope (default `pure`) |
| `deterministic` | boolean | Determinism declaration; fns on the Guard evaluation path **must** declare and guarantee determinism (default false, not allowed on the evaluation path) |

> Global resource quota (`FnQuota`: `maxInvocations` total-invocation cap / `maxConcurrent` concurrency cap) is set globally via `setQuota()` — runtime configuration, **not a registrable entry**.

## 6. Registration process (adding an entry)

To add a prefix / category / fn delegation, in order:

1. **Change the code source**: register the entry in `src/erdl-schema.ts` (prefix / category) or `src/fn-registry.ts` (fn);
2. **Sync this ledger**: add a row in the relevant section above (prefix, category, notes);
3. **Sync the SPEC**: if the entry introduces new semantic constraints, update `erdl-spec.md` (§4 Rule definition / §9 Integration);
4. **Add tests**: one coverage test for the naming gate / evaluation path;
5. **PR review & merge**: one PR registers one logical unit; "use first, register later" is forbidden.

> Red line: **"use first, register later" is forbidden** — a rule with an unregistered prefix is rejected at load (`NON_STANDARD_NAME`).

## 7. Frozen enums (reference only, never duplicated)

These semantic sets are frozen in [erdl-spec.md](./erdl-spec.md) (`[FREEZE-2]`, additive-only, no semantic change) and are **not** re-maintained here:

| Enum | Count | SPEC section |
|------|:---:|------|
| Semantic nodes | 34 (10 groups) | §5.3 |
| Simple operators | 30 (28 conditions + 2 modifiers) | §5.2 |
| Decision types | 13 | §6 |
| Expression-tree discriminant types | 20 | §5.3 |

---

*Rules decide everything. Registrable entries are the extension boundary of semantics — registration is load-bearing.*
