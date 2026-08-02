# ERDL Decision Object — Cross-Implementation Test Vectors

> Maintainer: OpenOBA | License: MIT
> Last Updated: 2026-08-02
>
> **Authoritative source**: [erdl-vectors](https://github.com/OpenOBA/erdl-vectors) — independent repository. This directory is a mirror.
>
> **Version Identification**: The `version` field within vector files is a semantic label. Implementers **SHOULD** pin to a specific **Git commit hash**. This defect was independently discovered and documented by Christopher Hopley (chopmob-cloud) during the v1.1 freeze-period audit.

## Directory

| File / Directory | Description | Vectors |
|------|------|:---:|
| `decision-object-vectors-v1.0.json` | v1.0 baseline (archived) | 28 (23 decision + 5 audit) |
| `decision-object-vectors-v1.1.json` | v1.1 consolidated (archived) | 45 (37 decision + 8 audit) |
| `../vectors-v1.3/` | **v1.3 current — 101 vectors + verifier + runner reference impl**. See [subdirectory README](../vectors-v1.3/README.md) | 63 DO + 12 AV + 26 dynamic |

## Quick Start

```bash
cd ../../vectors-v1.3
npm install
node verify.js
# → ALL VERIFICATIONS PASSED (11/11 MATCH + AV-013 CANARY DETECTED)
```

## Independent Verification Record

Only independently cloneable implementations with a public repository are listed here.

| Implementation | Language | Verifier | Date | Vectors | Result |
|----------------|----------|----------|------|:---:|--------|
| Concordia | Python | Erik Newton | 2026-08-02 | 13 audit (AV-001~013) | ✅ 12 byte-identical + canary discriminated |

## Acknowledgments

- **Erik Newton (Concordia)** — first independent Runner implementer. Verified all 13 audit vectors byte-perfectly from the spec text alone. Established the principle that neutrality is tested, not declared.
- **Christopher Hopley (chopmob-cloud)** — independent technical reviewer. His JCS edge-case analysis, version-identification defect discovery, and compliance audit feedback directly shaped the v1.3 audit hash structure.

## Verification Method

A conformant implementation **MUST**:

1. Load the Decision Object from the vector set.
2. Extract `decision_object.audit.hash` as the **claimed hash**.
3. **Delete** the `audit.hash` key from `decision_object`. MUST delete; MUST NOT set to `null` or `""` — these produce different canonical byte sequences.
4. Serialize the remaining object using JCS (RFC 8785).
5. Compute SHA-256 (FIPS 180-4) of the canonical bytes, prepend `sha256:`.
6. Compare against the claimed hash.

## References

- SPEC: [erdl-spec-v1.1.md](../erdl-spec-v1.1.md) · §12 Decision Object
- Authoritative vectors: [github.com/OpenOBA/erdl-vectors](https://github.com/OpenOBA/erdl-vectors) (v1.3, 101 vectors, Frozen)
- JCS: [RFC 8785](https://datatracker.ietf.org/doc/rfc8785/)
- SHA-256: [FIPS 180-4](https://csrc.nist.gov/publications/fips/fips180-4)
