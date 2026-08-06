# Changelog — ERDL Decision Object Test Vectors

> Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.

## v1.3.3 (2026-08-06)

### Dual Verification (Erik Newton Feedback)
- **Check 2: Answers File Cross-Comparison**: New `--answers <path>` CLI flag adds an independent oracle check — recomputed canonical bytes are compared against the pre-generated answers file
- **Dual gate**: A runner must pass BOTH Check 1 (audit.hash self-consistency) AND Check 2 (answers file cross-check) to be considered verified
- **AV-013 behavior confirmed**: Check 1 MISMATCH (correct runner detects tampered hash) + Check 2 MATCH (canonical bytes match oracle) → canary correctly discriminates in dual mode

### Code Quality
- `computeCanonicalHex()` shared function extracted from DO and AV loops (DRY)
- `verifyDO()` cleaned: unused `canonical_hex` return value and dead `canonicalHex` local variable removed
- `generateConformance()`: AV-013 count now dynamic (not hardcoded `-1`); MISMATCH count included in CONFORMANCE.md when non-zero
- Answers file DoS protection: 100MB size limit added

### CI/CD
- `clean-room-verify.yml`: New Step 3 (Check 2 — Answers File Cross-Comparison) + Step 4 (dual-verification CI generation)
- `CONFORMANCE.md`: Now reports dual verification results (Check 1 + Check 2 + AV-013 status)

### Documentation
- `DESIGN-verify-js-v1.3.md`: Updated to v1.3.3 — CLI interface, dual verification, shared functions, exit codes
- `RUNNERS-GUIDE.md` §8: Rewritten — answers file role clarified, dual verification explained, v1.3.1−v1.3.3 evolution documented

### Verification
- ✅ Check 1: 63/63 DO + 11/11 AV MATCH + AV-013 MISMATCH
- ✅ Check 2: 63/63 DO + 12/12 AV MATCH (answers file cross-check)
- ✅ Dual: PASSED

## v1.3.2 (2026-08-05)

### CI/CD — Clean-Room Verification Architecture
- **Clean-Room Workflow**: New `.github/workflows/clean-room-verify.yml` — SDK absence check at startup (hard fail if `@openoba-ai/erdl-mcp` is importable), self-built JCS+SHA-256 verification, auto-generated CONFORMANCE.md
- **CONFORMANCE.md**: New `conformance/CONFORMANCE.md` — auto-generated per-run verification report (63/63 DO + 12/12 AV)
- **IMPLEMENTATIONS.md**: New cross-implementation registry — measurements-only, no endorsement. Concordia 13/13 (Erik Newton) + OpenOBA Clean-Room 101/101
- **conformance/README.md**: Documentation for the conformance artifact pipeline
- **Erik Newton contribution**: generated-artifact pattern + clean-room sequencing adopted as CI architecture foundation

### Documentation
- README.md: Added Clean-Room Verification section; repository structure updated with conformance/ and IMPLEMENTATIONS.md
- Erik Newton acknowledgment expanded to include CI/CD architecture contribution
- All references to AV count unified to 13 (AV-001–AV-012 + AV-013)

## v1.3.1 (2026-08-02)

### Vector Data Fixes (7 vectors)
- **DO-011**: Added `override: high` to `rule-allow-safe-tool` (SPEC §3.2 override sorting)
- **DO-030**: Swapped priority values (500↔400) between `rule-allow-a` and `rule-allow-b`
- **DO-042**: Added `override: high` to `rule-not-in-allow`
- **DO-012**: Fixed `rule-allow-risky` ring 4→2; category ALLOW→DENY
- **DO-027**: Operator `neq`→`ne` (SPEC §3.3 canonical form)
- **DO-034**: Category NOTIFY→DENY

### Compliance Profile Alignment
- `compliance_profile.profile_id`: `erdl-compliance-v1.2` → `erdl-compliance-v1.3` (76 occurrences)
- `agent.version`: `v1.2.0` → `v1.3.0` (75 occurrences)

### RFC-001 (CN+EN)
- Version unified to v1.3 throughout (v1.2 was an unpublished intermediate design)
- AV-008 documented as superseded by AV-013 (chain integrity canary)

### Answers File
- `decision-object-answers-v1.3.json` withdrawn from repository
- Added to `.gitignore`; local copy regenerated for development diagnostics only

### Documentation
- README (CN+EN): directory tree updated, AV-008→AV-013
- RUNNERS-GUIDE: answers file status updated
- DESIGN docs: v1.2-era files archived to `docs/archive/`
- Test files: profile_id + model version updated to v1.3

### erdl-landing sync
- Mirror files in `vectors-v1.3/` synchronized from erdl-vectors master

### Security Hardening (canonical_hex → diag_hash)
- **Vector file zero-answer**: All 12 AV vector `canonical_hex` fields removed. Replaced with `diag_hash` — first 14 characters of `audit.hash` (`"sha256:"` + 8 hex digits). SHA-256 is a one-way function; `diag_hash` cannot invert to recover JCS output.
- **verify.js**: Removed canonical_hex comparison logic. Now pure five-step JCS+SHA-256 verification with audit.hash comparison only.
- **reference-runner.js**: Mode 2 rewritten — shortcut path blocked by design (no canonical bytes to lean on).
- **RFC 001 §13.3/§13.6**: Updated all descriptions — `diag_hash` as debug anchor, `canonical_hex` in separate answers file only.
- **Cross-implementation audit**: 4 independent verifiers confirm 12/12 (Rulsynor + Erik Newton/Concordia + Chris Hopley/AlgoVoi + Qwen3.7 MAX). 7/7 cheat strategies fail.

## v1.3.0 (2026-07-29)

### Bug Fixes (Third-Party Audit)
- **E1 (Erik Newton)**: RFC 001 §13.3 now matches verify.js — both delete only `audit.hash` (not entire `audit` object). Previously, `delete clone.audit` removed `previous_hash` and `commitment` from the JCS preimage.
- **E2 (Erik Newton)**: Chain position tampering detection restored. `audit.previous_hash` and `audit.commitment` now participate in JCS → any tampering with a record's position in the chain changes `audit.hash`.
- **E3 (Erik Newton)**: `canonical_hex` moved from vector file to separate `decision-object-answers-v1.3.json`. Conformance runners MUST NOT read the answers file — this eliminates the SHA-256-only shortcut attack.
- **S2 (Chris Hopley)**: §9.6 dual-hash transition — "verify every hash present" replaces "at least one" (CWE-757 algorithm downgrade fix).
- **S3 (Chris Hopley)**: §11.2 schema_ref SSRF hardening confirmed (offline-first, allowlisted, size-capped).
- **C3 (Chris Hopley)**: §3.3 explicitly overrides §3.1(5) for `extensions` empty array retention.
- **C2 (Chris Hopley)**: Numeric canonicalization constraint added (§3.1 constraint 8) — prevention measure for string-encoded decimal ambiguity.

### Design Changes
- All 75 DO vectors now carry full `audit` object: `hash` + `previous_hash` + `commitment`
- AV-008 (stale regression canary) replaced by AV-013 (chain position tampering canary)
- AV-013 strategy: `audit.previous_hash` in DO body tampered to point outside chain, but `audit.hash` computed with original `previous_hash`. Correct runners detect mismatch.
- Audit vector count remains 12 (AV-001~AV-012 + AV-013)

### Documentation
- RFC 001: v1.2 DRAFT-3 → v1.3 DRAFT-4 (CN + EN, OPENOBA-DOBJ-RFC-001)
- Runner's Guide: Step 2 deletion logic updated; Answers file section added; §5 field list corrected; §9/§10/§11 numbering fixed
- DESIGN documents: verify.js v1.2 → v1.3; generate §5 aligned; CLI docs synced to actual impl
- ALIGNMENT-REPORT: v1.3 upgrade summary

### Full-Project Audit (2026-07-29)
- Test count corrected: 153→152 (66 gen + 86 ver); "v1.2 protocol"→"v1.3 protocol" in README CN/EN
- LICENSE file added (MIT)
- §3.1(8): `priority`→`policies[].version` (removed reference to undefined Schema field)
- §4.2 #24: clarified "signature preimage = JCS preimage"

### RFC Preparation
- Regulatory 12→14: LGPD (Brazil) + DPDP (India) added to §6.1, §8, Appendix B; all references updated
- §9.4: 5 queue reliability constraints (durable writes, at-least-once, WAL, crash recovery, missing DO alert)
- §9.5: SMB minimal deployment mode (NATIVE + JSONL, 1 vCPU/512MB); progressive upgrade path (50/500 Tool Calls/s)
- §9.4: performance benchmarks (Node.js v24: ~110 µs/DO, ~8 ms/75 DO)
- Appendix C: Threat Model (STRIDE — 13 threats, 10 mitigated, 3 accepted); risk acceptance statement
- §14: expanded 8→10 RFC items
- erdl-landing SPEC v1.1: DEFER decision type added to §3.4/3.5/3.6/12.3/Appendix E (separate repo)

### Verification
- ✅ verify.js: 63/63 DO audit.hash self-consistent
- ✅ verify.js: 11/11 AV MATCH + AV-013 EXPECTED_MISMATCH (chain canary detected)
- ✅ vitest: 152/152 passed (66 generator + 86 verifier)
- ✅ CN↔EN RFC 001: cross-references aligned
- Baseline: commit `3131548` (v1.2 DRAFT-3, clean working tree)

## v1.2.0 (2026-07-28)

### Decision Vectors
- **101 vectors total** (63 static DO + 26 dynamic + 12 audit hash)
- 13 decision types fully covered: ALLOW, DENY, PASS, REQUEST_HUMAN, EMERGENCY_HALT, CORRECT, ESCALATE, NOTIFY, QUARANTINE, ROLLBACK, WORKFLOW, WORKFLOW_WAITING, WORKFLOW_PROGRESS
- 13 operators fully covered: eq, neq, gt, gte, lt, lte, in, not_in, contains, matches, starts_with, ends_with, exists
- 7 edge cases: null-propagation, strict-type-matching, ReDoS-protection, rate-limiting, integer-safe-range, object-deep-comparison, empty-extension-normalization
- DO-064 (DELEGATE) reserved for v1.3

### Architecture
- **Deterministic generation**: `generate-vectors.cjs` produces byte-identical output every run (SHA-256: `700a683d...`)
- **RFC 9562 UUIDv7**: All `decision_id`/`execution_trace_id` fully compliant (frozen timestamp `2026-07-28T00:00:00.000Z`)
- **Five-step flat hashing**: JCS (RFC 8785) → SHA-256 → audit.hash, extensions participate directly in main JCS
- **Canonical hex format**: `canonical_hex` field stores hex encoding of UTF-8 JCS bytes for cross-implementation comparison

### Verification
- **Zero-dependency verifier**: `verify.js` uses self-built JCS (no npm deps) → truly cross-implementation verifiable
- **Stale regression canary**: AV-008 intentionally mismatches — catches validators that skip five-step verification (replaced by AV-013 chain integrity canary in v1.3)
- **152 tests**: JCS RFC 8785 compliance, SHA-256 determinism, 5-step verification, tamper detection, full vector integrity (66 generator + 86 verifier as of v1.3.0)

### Security
- **Independent security review** — 0 critical/high findings
- JCS type guards: BigInt, Symbol, Date, non-plain objects all rejected with clear errors
- Input validation: verify.js validates vector file structure before processing
- Dependency pinned: `json-canonicalize` locked to `2.0.0`

### Compliance
- `erdl-compliance-v1.2` profile embedded in all vectors
- 4 regulatory frameworks: EU AI Act 2024, GB/Z 185-2026, NIST AI RMF, COSO GenAI
- HIPAA reference in DO-016 updated to include HITECH Act (2009) and 21st Century Cures Act (2016)

### Documentation
- README.md: full project overview with deterministic guarantees
- DESIGN-generate-vectors-v1.2.md: generator architecture
- DESIGN-vector-inventory-v1.2.md: full vector inventory
- DESIGN-verify-js-v1.2.md: verifier architecture
- AUDIT-REPORT.md: independent security audit
- CONTRIBUTING.md: contributor guidelines

### Breaking Changes from v1.0/v1.1
- `expected_sha256` field removed entirely — verification is now via five-step recomputation
- `canonical_bytes` renamed to `canonical_hex` for cross-implementation clarity
- `policies[].hash` is now JCS-based (previously unspecified)
- `rule_set_version.id` is JCS-based on full policy set content
- `compliance_profile` upgraded from `v1.0` → `v1.2` with 4 regulatory frameworks
- UUID format changed from v1.0/v1.1 mixed to RFC 9562 UUIDv7

### Migration from v1.1
- v1.1 vector IDs are not preserved; v1.2 is generated from scratch
- All v1.1 scenario categories are covered with improved test designs
- v1.1's technical pitfalls (T1-T10 from audit report) are all addressed in v1.2 design

---

## v1.1.0 (2026-07-10)

- 45 vectors (37 DO + 8 AV)
- Generated via `generate-v1.1-vectors.cjs`
- `json-canonicalize` as JCS dependency
- `expected_sha256` answer key (removed in v1.2)

## v1.0.0 (2026-06-14)

- 22 vectors (Decision Object v1.0 draft)
- Manual construction
- Cross-implementation verified by Erik Newton (Concordia): AV-001~AV-005 byte-matched
