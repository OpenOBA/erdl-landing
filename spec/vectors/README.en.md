# ERDL Decision Object — Cross-Implementation Test Vectors

> Maintainer: OpenOBA | License: MIT
> Last Updated: 2026-07-26
>
> **⚠️ Version Identification**: The `version` field within vector files is a semantic label and does not guarantee uniqueness (different revisions may share the same version string). Implementers **SHOULD** pin to a specific **Git commit hash** (e.g., `git show <commit>:spec/vectors/decision-object-vectors-v1.1.json`). A version string alone cannot distinguish two byte-different states of a vector file — a defect independently discovered and documented by Christopher Hopley (chopmob-cloud) during the v1.1 freeze-period audit.

## Files

| File | Description | Vectors |
|------|-------------|:---:|
| `decision-object-vectors-v1.0.json` | Decision Object v1.0 baseline vector set | 28 (23 decision + 5 audit) |
| `decision-object-vectors-v1.1.json` | Decision Object v1.1 consolidated vector set | 45 (37 decision + 8 audit) |

## Audit Hash Vectors (AV-001 through AV-008)

v1.1 contains 8 audit hash vectors for verifying cross-implementation JCS (RFC 8785) canonicalization + SHA-256 hash consistency.

### Vector Structure

Each audit vector carries the following key fields:

| Field | Purpose |
|-------|---------|
| `canonical_bytes` | Hex-encoded JCS-canonicalized byte sequence. **Diagnostic artifact** — when two independent implementations produce different hashes, this enables byte-level comparison to localize the divergence without requiring access to the other party's canonicalizer code. |
| `decision_object.audit.hash` | The self-referential claimed hash stored in the Decision Object. A runner **MUST** recompute SHA-256 from `canonical_bytes` and compare against this value. |

### `expected_sha256` Removed

The v1.1 vector set has removed the `expected_sha256` field. This field was an answer key — a shorthand runner could skip JCS+SHA-256 recomputation by directly comparing `expected_sha256` against `decision_object.audit.hash`. With the field removed, all runners must re-derive the hash from `canonical_bytes`.

The `canonical_bytes` field (hex plaintext format) is retained as a diagnostic tool, enabling cross-implementation divergence to be localized without canonicalizer code.

This design change is based on independent review and recommendations by Erik Newton (Concordia) and Christopher Hopley (chopmob-cloud) during the v1.1 freeze-period audit (2026-07-24, A2A Discussion #2031).

### AV-008 Stale Regression Vector

AV-008 is a **deliberately stale** vector: `canonical_bytes` was updated (em-dash spacing fix), but `decision_object.audit.hash` retains the pre-fix value. Result: SHA-256(canonical_bytes) ≠ audit.hash.

- **Correct runner** (recomputes JCS+SHA-256 from first principles) → detects mismatch → **this is correct behavior** ✅
- **Shorthand runner** (uses cached/precomputed answer tables) → skips computation → may falsely report pass → **exposed** ❌

The value of AV-008: any implementation claiming compliance must prove it genuinely re-derived the hash from `canonical_bytes`.

## Verification Method (Six-Step Full Procedure)

A conformant implementation **MUST** execute the following steps (see SPEC v1.1 §12.7.3):

1. Load the Decision Object from the vector set.
2. Extract `decision_object.audit.hash` and store it as the **claimed hash**.
3. **Delete** the `audit.hash` key from `decision_object`. MUST delete the key; MUST NOT set it to `null` or the empty string `""`. Deleting a key vs. blanking it produce different canonical byte sequences under JCS (RFC 8785), and therefore different digests.
4. Serialize the remaining object using JCS (RFC 8785) to obtain the canonical bytes.
5. Compute SHA-256 (FIPS 180-4) of the canonical bytes, prepend `sha256:`, to obtain the **recomputed hash**.
6. Compare the recomputed hash (step 5) against the claimed hash (step 2). MUST match byte-for-byte. Any mismatch constitutes a conformance failure.

### Critical Constraint: Delete the Key, Never Blank It

```
// ✅ Correct: delete audit.hash → JCS omits "hash" key entirely
//   {"audit":{"commitment":"x","previous_hash":null},"decision_id":"d1"}
//   sha256:023c4b7d...

// ❌ Wrong: set audit.hash to "" → JCS includes "hash":""
//   {"audit":{"commitment":"x","hash":"","previous_hash":null},"decision_id":"d1"}
//   sha256:bd0925a9... (completely different!)
```

The two approaches produce different canonical byte sequences under JCS, therefore different SHA-256 digests. An implementation that blanks instead of deletes will produce **systematic drift across all vectors**.

## Empirical Failure Record

During the v1.1 freeze period on 2026-07-24, the vector file at commit `c3f22df` received em-dash spacing fixes to AV-003, AV-004, and AV-005 — updating `canonical_bytes` and `expected_sha256`, but inadvertently leaving `decision_object.audit.hash` unchanged.

The five-step shorthand (strip → JCS → SHA-256 → compare expected_sha256) reported **7/7 PASS**, but the full six-step verification exposed that **3 vectors' audit.hash did not match their canonical_bytes**. Commit `5cff368` corrected the affected hash values.

See SPEC v1.1 §12.7.3 Rationale for the full account.

## Independent Verification Record

| Implementation | Verifier | Date | Vectors | Result |
|----------------|----------|------|:---:|--------|
| Rulsynor (TypeScript) | OpenOBA | 2026-07-26 | 8 audit | ✅ All byte-perfect match |
| Concordia (Rust) | Erik Newton | 2026-07-14 | 5 audit (AV-001~005) | ✅ All byte-perfect match |
| chopmob-cloud (Python) | Christopher Hopley | 2026-07-25 | 8 audit (steps 5-6) | ✅ hex+SHA-256 reproducible |

## References

- SPEC: [erdl-spec-v1.1.md](../erdl-spec-v1.1.md) · §12 Decision Object
- JCS: [RFC 8785](https://datatracker.ietf.org/doc/rfc8785/)
- SHA-256: [FIPS 180-4](https://csrc.nist.gov/publications/fips/fips180-4)
- Standalone Vectors Repository: [github.com/erdl-vectors](https://github.com/erdl-vectors)
