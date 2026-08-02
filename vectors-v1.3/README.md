# ERDL Decision Object v1.3.1 — Cross-Implementation Test Vectors (Mirror)

> This is a mirror of the authoritative [erdl-vectors](https://github.com/OpenOBA/erdl-vectors) repository.
> For the full verification suite including JCS corpus tests and generate-vectors, clone the authoritative repo.

> **Version**: v1.3.1 · 2026-08-02  
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
# → ALL VERIFICATIONS PASSED (75/75)
```

> For the full test suite and generate-vectors, clone the authoritative repository:
> ```bash
> git clone https://github.com/OpenOBA/erdl-vectors.git
> cd erdl-vectors && npm test
> ```

## Files

| File | Purpose |
|------|---------|
| `decision-object-vectors-v1.3.json` | 101 cross-implementation test vectors (75 static DO+AV, no answers) |
| `verify.js` | Zero-dependency five-step JCS+SHA-256 verifier |
| `reference-runner.js` | Third-party reference runner (independent JCS impl) |
| `RUNNERS-GUIDE.md` | Implementation guide for Runner developers |
| `ci-verify.yml` | GitHub Actions CI pipeline (from erdl-vectors) |
| `verified-runners.json` | Registry of independently verified implementations |
| `CHANGELOG.md` | Version history |

## Verified Runners

| Implementer | Language | Vectors | Date | Result |
|-------------|----------|:---:|------|--------|
| Erik Newton (Concordia) | Python | 13/13 AV | 2026-07-30 | 12 byte-identical + AV-013 canary discriminated |

## Acknowledgments

- **Erik Newton (Concordia)** — first independent Runner implementer. Verified all 13 audit vectors byte-perfectly from the spec text alone, including the AV-013 chain-position canary. Established the principle "neutrality is tested, not declared."
- **Christopher Hopley (chopmob-cloud)** — independent technical reviewer. His JCS edge-case analysis and compliance audit feedback directly shaped the v1.3 audit hash structure and answers file (local only, never committed) separation architecture.

## Five-Step Audit Hash Verification

```
Step 1: Deep clone decision_object
Step 2: Delete self-referencing fields (audit.hash — keep previous_hash and commitment)
Step 3: JCS (RFC 8785) canonicalize the entire remaining object
Step 4: SHA-256 the canonical representation
Step 5: Compare computed hash with stored audit.hash
```

## References

- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme (JCS)
- [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562) — Universally Unique IDentifiers (UUID)
- [FIPS 180-4](https://csrc.nist.gov/publications/detail/fips/180/4/final) — Secure Hash Standard (SHA-256)
- [ERDL Specification v1.1](https://openoba.github.io/erdl-landing/)
- [Authoritative Repository](https://github.com/OpenOBA/erdl-vectors)
