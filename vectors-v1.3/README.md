# ERDL Decision Object v1.3.3 — Cross-Implementation Test Vectors (Mirror)

> This is a mirror of the authoritative [erdl-vectors](https://github.com/OpenOBA/erdl-vectors) repository.
> For the full verification suite including JCS corpus tests and generate-vectors, clone the authoritative repo.

> **Version**: v1.3.3 · 2026-08-06  
> **Status**: Released  
> **Maintainer**: OpenOBA (https://openoba.com)  
> **License**: MIT

## Background

The ERDL Decision Object is the standardized, tamper-evident audit trail for AI Agent rule evaluation. Every decision is fully traceable — which rules fired, which operator matched, what context was evaluated — sealed by JCS (RFC 8785) canonicalization and SHA-256 hashing.

This directory is a mirror of the v1.3 vector set, included as part of the erdl-landing specification site. **No answers file (local only, never committed) is included** — conformance runners must implement JCS+SHA-256 verification independently.

## Quick Start (in this directory)

```bash
npm install
node verify.js
# → ALL VERIFICATIONS PASSED (63/63 DO + 11/11 AV MATCH + AV-013 CHAIN CANARY DETECTED)
```

With answers file (local only):

```bash
node verify.js --answers decision-object-answers-v1.3.json
# → DUAL VERIFICATION PASSED (Check 1 ✓ + Check 2 ✓ + AV-013 canary active)
```

CI mode:

```bash
node verify.js --answers decision-object-answers-v1.3.json --ci
# → DUAL VERIFICATION PASSED + CONFORMANCE.md generated
```

> For the full test suite and generate-vectors, clone the authoritative repository:
> ```bash
> git clone https://github.com/OpenOBA/erdl-vectors.git
> cd erdl-vectors && npm test
> ```

## Files

| File | Purpose |
|------|---------|
| `decision-object-vectors-v1.3.json` | 101 cross-implementation test vectors (63 static DO + 12 AV + 26 dynamic) |
| `verify.js` | Zero-dependency dual verifier (Check 1: audit.hash + Check 2: answers file) |
| `reference-runner.js` | Third-party reference runner (independent JCS impl, SDK-uninstalled compatible) |
| `generate-vectors.cjs` | Deterministic vector generator (maintainer use only) |
| `RUNNERS-GUIDE.md` | Implementation guide for Runner developers |
| `CHANGELOG.md` | Version history (includes v1.3.3 dual verification) |
| `IMPLEMENTATIONS.md` | Cross-implementation registry (measurements only, no endorsement) |
| `DESIGN-verify-js-v1.3.md` | Verifier architecture and design |
| `ci-verify.yml` | GitHub Actions CI pipeline (dual verification, clean-room, zero SDK) |
| `verified-runners.json` | Registry of independently verified implementations |

> **Dual Verification** (v1.3.3+): The CI pipeline runs two independent checks — Check 1 (audit.hash self-consistency via five-step JCS+SHA-256) and Check 2 (answers file cross-comparison as independent oracle). A runner must pass **both** to be considered verified. Results auto-generated into `conformance/CONFORMANCE.md` in the authoritative repository.

## Verified Runners

| Implementer | Language | Vectors | Date | Result |
|-------------|----------|:---:|------|--------|
| Erik Newton (Concordia) | Python | 13/13 AV | 2026-07-30 | 12 byte-identical + AV-013 canary discriminated |

## Acknowledgments

- **Erik Newton (Concordia)** — first independent Runner implementer, CI/CD architecture contributor, and dual verification proponent (2026-08-06). Verified all 13 audit vectors byte-perfectly from the spec text alone, including the AV-013 chain-position canary. Established the principle of "neutrality is tested, not declared." Proposed the dual verification pattern — Check 1 (audit.hash) + Check 2 (answers file oracle) — to close the gap identified in the July lesson where a runner passed one check while never checking the other.
- **Christopher Hopley (chopmob-cloud / AlgoVoi)** — independent technical reviewer. His JCS edge-case analysis and compliance audit feedback directly shaped the v1.3 audit hash structure and the answers file (local only, never committed) separation architecture. Cross-validated JCS libraries across 8 languages on 24 canonicalisation vectors.

## Five-Step Audit Hash Verification (Check 1)

```
Step 1: Deep clone decision_object
Step 2: Delete self-referencing fields (audit.hash — keep previous_hash and commitment)
Step 3: JCS (RFC 8785) canonicalize the entire remaining object
Step 4: SHA-256 the canonical representation
Step 5: Compare computed hash with stored audit.hash
```

## Answers File Cross-Comparison (Check 2)

```
Step 1: Compute JCS canonical hex for each DO/AV vector
Step 2: Compare against the independent oracle (answers file)
Step 3: Report MATCH / MISMATCH for each vector
Step 4: AV-013: Check 2 should MATCH (canonical bytes correct) while Check 1 MISMATCHES (hash tampered)
```

## References

- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme (JCS)
- [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562) — Universally Unique IDentifiers (UUID)
- [FIPS 180-4](https://csrc.nist.gov/publications/detail/fips/180/4/final) — Secure Hash Standard (SHA-256)
- [ERDL Specification v1.1](https://openoba.github.io/erdl-landing/)
- [Authoritative Repository](https://github.com/OpenOBA/erdl-vectors)
