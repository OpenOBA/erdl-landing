# DESIGN: verify.js — Universal Zero-Dependency Verifier v1.3

> Copyright (c) 2026 Tang Qixin. All rights reserved.

> Version: 1.3.3 · 2026-08-06
> Status: Released
> Goal: Cross-language, cross-implementation, zero-dependency DO verifier with dual verification (Check 1 audit.hash + Check 2 answers file)

---

## 1. Design Goals

| Goal | Description |
|------|-------------|
| **Zero-dependency** | Uses only Node.js built-in modules (`crypto`, `fs`, `path`) |
| **Single file** | `scripts/verify.js` — copy to any Node.js environment and run |
| **Dual verification** | Check 1: audit.hash self-consistency + Check 2: answers file cross-comparison |
| **Three-level compatibility** | L1 Basic (28) / L2 Verified (45) / L3 Full (101) |
| **Portable** | Pure algorithm implementation, translatable to Python/Go/Rust |
| **Self-documenting** | Code serves as living documentation of verification logic |

## 2. Core Algorithm: Five-Step Verification

### 2.1 Self-Built JCS (No External Libraries)

`verify.js` must implement its own JCS serializer because:

1. The verifier's authority rests on "trust no external library"
2. The verifier is the algorithm's "living document"
3. Self-built JCS counters the `json-canonicalize` npm library — if results differ, one has a bug

### 2.2 Number Canonicalization

JCS (RFC 8785) = ECMAScript number serialization. `String(n)` in JS is JCS-compliant.
Integers: no `.0` suffix. NaN/Infinity rejected.

### 2.3 Omit over Null

Optional fields with `null`, `undefined`, or `[]` must be physically deleted (`delete obj.field`).

## 3. CLI Interface

```
Usage: node scripts/verify.js [path/to/vectors.json] [--answers <path>] [--ci]

Arguments:
  path/to/vectors.json    Vector set JSON (default: ./decision-object-vectors-v1.3.json)
  --answers <path>        Answers file for Check 2 cross-comparison (independent oracle)
  --ci                    CI mode: generate conformance/CONFORMANCE.md

Modes:
  Single (no --answers):  Check 1 only — audit.hash self-consistency
  Dual (with --answers):  Check 1 + Check 2 — dual verification
  CI (with --ci):         Full dual verification + CONFORMANCE.md generation

Examples:
  node verify.js
  node verify.js decision-object-vectors-v1.3.json
  node verify.js decision-object-vectors-v1.3.json --answers decision-object-answers-v1.3.json
  node verify.js decision-object-vectors-v1.3.json --answers decision-object-answers-v1.3.json --ci
```

## 4. Verification Logic

### 4.1 Check 1: Audit Hash Self-Consistency

Five-step JCS (RFC 8785) + SHA-256 verification per RFC 001 §13.3:
1. Deep clone decision_object
2. Delete audit.hash / signature / signing_key_id (keep audit.previous_hash + audit.commitment)
3. JCS serialize remaining fields
4. SHA-256 hash
5. Compare with stored audit.hash

### 4.2 Check 2: Answers File Cross-Comparison (Erik Newton, 2026-08-06)

Independent oracle verification: recomputed canonical bytes are compared against the pre-generated answers file. This catches runners that pass Check 1 but produce incorrect canonical bytes, and vice versa.

The July lesson: a runner can pass one check while never checking the other. A runner must pass **both** checks to be considered verified.

```javascript
function verifyAgainstAnswers(vectorsData, answersData) {
  // For each DO and AV vector:
  //   1. Compute JCS canonical hex via computeCanonicalHex()
  //   2. Compare against answers file's stored hex
  //   3. Report MATCH / MISMATCH / SKIP
}
```

### 4.3 AV-013 Special Handling

AV-013 is the chain position tampering canary. Its `audit.previous_hash` in the DO body is tampered to `sha256:ffff...` (pointing outside the chain). The stored `audit.hash` is the digest a regressed runner (deleting the entire `audit` object, excluding `previous_hash` from the JCS preimage) would compute.

- **Check 1**: Correct runner → MISMATCH (detects tampered previous_hash) ✓
- **Check 2**: Correct runner → MATCH (canonical bytes match answers file) ✓
- **Dual conclusion**: Check 1 MISMATCH + Check 2 MATCH → canary correctly discriminates

Verifiers MUST NOT special-case AV-013 by hardcoded ID.

## 5. Shared Functions

### computeCanonicalHex()

Extracted from Check 1 (verifyDO) and Check 2 (verifyAgainstAnswers) to avoid code duplication. Computes JCS canonical hex for a decision_object by deleting audit.hash, signature, and signing_key_id before serialization.

## 6. Portability Design

`verify.js` follows **Literal Translation** principles:

1. No ES6 features beyond arrow functions (translatable)
2. `jcsCanonicalize()` is a pure recursive function
3. `sha256()` maps to `crypto.createHash('sha256')` (Node) / `hashlib.sha256()` (Python)
4. No Node-specific API patterns (Stream/Buffer advanced features)

## 7. Error Handling

| Scenario | Behavior |
|----------|----------|
| Vector file missing | Exit code 1: `ERROR: Vector file not found` |
| Answers file missing (with --answers) | Exit code 1 |
| Vector/answers file > 100MB | Exit code 1: DoS protection |
| Invalid format (missing audit_vectors) | Exit code 1: `ERROR: Invalid vector format` |
| AV-013 expected MISMATCH | Status `EXPECTED_MISMATCH`, not counted as failure |
| Dual verification failure | Exit code 1 with detailed Check 1/Check 2 status |
| NaN/Infinity in JCS | Process exit: `JCS: NaN/Infinity not allowed` |

## 8. Exit Codes

| Code | Meaning |
|:---:|---------|
| 0 | All PASS (including AV-013 expected failure, dual verification both passing) |
| 1 | File I/O error, format error, or verification failure |

## 9. Test Strategy

```bash
# Check 1 only (backward compatible)
node scripts/verify.js decision-object-vectors-v1.3.json
# Expected: ALL VERIFICATIONS PASSED · 11/11 MATCH + AV-013 CHAIN CANARY DETECTED

# Dual verification
node scripts/verify.js decision-object-vectors-v1.3.json --answers decision-object-answers-v1.3.json
# Expected: DUAL VERIFICATION PASSED · Check 1 ✓ + Check 2 ✓ + AV-013 canary active

# CI mode
node scripts/verify.js decision-object-vectors-v1.3.json --answers decision-object-answers-v1.3.json --ci
# Expected: DUAL VERIFICATION PASSED + CONFORMANCE.md generated
```

---

> "Neutrality is tested, not declared."

## Verification Results (2026-08-06)

```
verify.js (Check 1):  63/63 DO audit.hash self-consistent
verify.js (Check 1):  11/11 AV MATCH + AV-013 EXPECTED_MISMATCH
verify.js (Check 2):  63/63 DO + 12/12 AV MATCH (answers file cross-check)
verify.js (Dual):     ✅ DUAL VERIFICATION PASSED
```
