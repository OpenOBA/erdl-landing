# ERDL Decision Object — Implementer's Guide

> How to write a conformant Decision Object canonicalizer and verifier from scratch.
>
> Version: 1.0 · 2026-07-26
> Target SPEC: ERDL Protocol Specification v1.1 §12

## Who This Guide Is For

You are implementing an ERDL-compatible rule engine and need to produce Decision Objects whose `audit.hash` matches the published test vectors byte-for-byte. This guide walks you through the complete procedure using AV-001 as a worked example, then shows you how to verify your implementation against the full vector set.

**Prerequisites:** Working knowledge of JSON, SHA-256, and your language's standard library. No prior JCS experience required.

---

## 1. The Six-Step Procedure

The canonical reference is SPEC v1.1 §12.7.3. Here it is in implementation terms:

```
Step 1: Load the Decision Object from the vector set
Step 2: Extract audit.hash → store as "claimed hash"
Step 3: DELETE the audit.hash key from the object
Step 4: JCS (RFC 8785) canonicalize the remaining object → canonical bytes
Step 5: SHA-256 (FIPS 180-4) the canonical bytes → "recomputed hash"
Step 6: Compare recomputed hash (step 5) against claimed hash (step 2)
```

Step 6 is NOT optional. Skipping it is the "five-step shorthand" — a known defect that masked 3/7 stale vectors during the v1.1 freeze period. **Implement all six steps.**

---

## 2. Worked Example: AV-001

### 2.1 The Decision Object

AV-001 is a security DENY: a financial services Agent attempts `exec("sudo systemctl restart nginx")` and is blocked by a Ring 0 rule.

Here is the Decision Object you need to verify (abridged — the full object is in `decision-object-vectors-v1.1.json`):

```json
{
  "spec": "decision-object-v1.0",
  "decision_id": "018c4a3e-0001-7000-8000-000000000001",
  "timestamp": "2026-07-13T03:30:00.000Z",
  "agent": {
    "id": "did:erdl:sha256:test-runner-v1",
    "role": "guardian",
    "version": "v1.0.0"
  },
  "context": {
    "tool.name": "exec",
    "tool.args": { "command": "sudo systemctl restart nginx" },
    "tool.args.command": "sudo systemctl restart nginx"
  },
  "policies": [
    {
      "id": "FIN-SEC-001",
      "name": "restrict_exec_to_allowlist",
      "version": 1,
      "hash": "sha256:f97dd5afe5647ccb4c3c05584c941c2094e0bfb442def6b7f816d547d8003ce3"
    }
  ],
  "evaluation": {
    "proposal_id": null,
    "matched_rules": [
      {
        "rule_id": "FIN-SEC-001",
        "decision": "DENY",
        "reason": "exec blocked by financial security policy",
        "ring": 0
      }
    ],
    "total_evaluated": 1,
    "total_matched": 1
  },
  "result": {
    "decision": "DENY",
    "severity": "high",
    "reason": "exec blocked by financial security policy",
    "action_taken": "blocked"
  },
  "audit": {
    "hash": "sha256:25b5602d0fb01b9f5591530dee51107722ad13547e7abac61bfd93dedbe08db3",
    "previous_hash": null,
    "commitment": "2026-07-13T03:30:00.000Z|did:erdl:sha256:test-runner-v1|exec|DENY"
  }
}
```

### 2.2 Step-by-Step Walkthrough

#### Step 1 & 2: Load and Extract

Parse the JSON. Store the claimed hash:

```
claimed_hash = "sha256:25b5602d0fb01b9f5591530dee51107722ad13547e7abac61bfd93dedbe08db3"
```

Strip the `sha256:` prefix for comparison later:

```
claimed_hex = "25b5602d0fb01b9f5591530dee51107722ad13547e7abac61bfd93dedbe08db3"
```

#### Step 3: Delete audit.hash

**This is critical.** You MUST remove the `audit.hash` key from the object. Do NOT set it to `null`, `""`, or `undefined`.

```
// Correct: remove the key entirely
delete decision_object.audit.hash

// Wrong — produces a DIFFERENT canonical byte sequence:
decision_object.audit.hash = ""
decision_object.audit.hash = null
```

Why this matters: JCS (RFC 8785) sorts keys alphabetically and serializes every key:value pair. A missing key is absent from the output. A key set to `""` produces `"hash":""` in the output. Two different byte sequences → two different SHA-256 digests.

**Concrete proof (verified during v1.1 freeze-period audit):**

```
Object with audit.hash DELETED:
  JCS: {"audit":{"commitment":"x","previous_hash":null},"decision_id":"d1"}
  SHA-256: 023c4b7d9b5d1e5053b0b6356b32e4d62c6eb4aa048215f52dc62acc2b026ecb

Object with audit.hash BLANKED (set to ""):
  JCS: {"audit":{"commitment":"x","hash":"","previous_hash":null},"decision_id":"d1"}
  SHA-256: bd0925a922d5232ed55e8bbc21440f28208f6b1afd96c65ce5ee6c02089c9e69
```

#### Step 4: JCS Canonicalize

Apply JCS (RFC 8785) to the object **after** deleting `audit.hash`.

JCS rules in brief:
1. Serialize all objects with keys in **lexicographic order**
2. No whitespace outside string values
3. Strings use JSON escaping (`\n`, `\"`, `\\`, etc.)
4. Numbers follow JSON number format
5. `null`, `true`, `false` are literal
6. Undefined keys are omitted (same as deleted)

The first 120 bytes of AV-001's canonical output are:

```
{"agent":{"id":"did:erdl:sha256:test-runner-v1","role":"guardian","version":"v1.0.0"},"audit":{"commitment":"2026-07-13T...
```

Full canonical bytes (hex): `7b226167656e74223a7b226964223a226469643a...`  
(1882 hex characters = 941 bytes. See the vector file for the complete value.)

**Implementation options:**

| Language | Library | Notes |
|----------|---------|-------|
| TypeScript/JS | `json-canonicalize` (npm) | Used by Rulsynor. Configuration: `filterUndefined: true` |
| Python | `json-canonical` (PyPI) | RFC 8785 compliant |
| Rust | `serde_json` + manual key sorting | Used by Concordia |
| Go | Manual implementation (~50 lines) | JCS is simple enough to implement directly |

**Verification checkpoint:** Your JCS output for AV-001 must be **byte-for-byte identical** to the `canonical_bytes` hex in the vector file. You can verify this without a second implementation — just compare your output against:

```
canonical_bytes: "7b226167656e74223a7b226964223a226469643a..."
```

#### Step 5: SHA-256

Compute SHA-256 (FIPS 180-4) of the canonical bytes. The output is a 32-byte binary hash.

Format: `"sha256:"` + 64 lowercase hex characters.

```
SHA-256(canonical_bytes) = 25b5602d0fb01b9f5591530dee51107722ad13547e7abac61bfd93dedbe08db3
```

Prepend the prefix:

```
recomputed_hash = "sha256:25b5602d0fb01b9f5591530dee51107722ad13547e7abac61bfd93dedbe08db3"
```

#### Step 6: Compare

```
recomputed_hash == claimed_hash ?
  "sha256:25b5602d0fb01b9f5591530dee51107722ad13547e7abac61bfd93dedbe08db3"
==
  "sha256:25b5602d0fb01b9f5591530dee51107722ad13547e7abac61bfd93dedbe08db3"
→ ✅ MATCH
```

AV-001 passes. Your JCS implementation is byte-correct and your SHA-256 implementation is standard-conformant.

### 2.3 Quick Diagnostic: Verify Without a Canonicalizer

Even without a JCS canonicalizer, you can verify **steps 5 and 6** using the published `canonical_bytes` hex:

```python
import hashlib

# From the vector file
canonical_bytes_hex = "7b226167656e74223a7b226964223a..."
audit_hash         = "sha256:25b5602d0fb01b9f5591530dee51107722ad13547e7abac61bfd93dedbe08db3"

computed = hashlib.sha256(bytes.fromhex(canonical_bytes_hex)).hexdigest()
claimed  = audit_hash.replace("sha256:", "")

print(f"SHA-256(canonical_bytes) = {computed}")
print(f"audit.hash (claimed)      = {claimed}")
print(f"Match: {computed == claimed}")
```

This validates that your SHA-256 implementation is correct and that the vector's `canonical_bytes` genuinely produces the claimed `audit.hash`. What it does NOT validate is that your own JCS canonicalizer produces the same `canonical_bytes` — for that, you need the byte-for-byte comparison in step 4.

---

## 3. Verifying All 8 Audit Vectors

Once AV-001 passes, run the same six-step procedure against AV-002 through AV-008.

### Expected Results

| Vector | Step 6 Result | Notes |
|:---|:---:|------|
| AV-001 | ✅ MATCH | Single security DENY |
| AV-002 | ✅ MATCH | PHI access → REQUEST_HUMAN |
| AV-003 | ✅ MATCH | Dual-rule override (DENY → ALLOW) |
| AV-004 | ✅ MATCH | EMERGENCY_HALT short-circuit |
| AV-005 | ✅ MATCH | Multi-agent trust ESCALATE |
| AV-006 | ✅ MATCH | `unless` exemption: test file allowed |
| AV-007 | ✅ MATCH | Null-safe field access → PASS |
| AV-008 | ❌ MISMATCH | **Stale regression vector — mismatch is CORRECT** |

### AV-008: The Deliberately Stale Vector

AV-008 shares the same `canonical_bytes` as AV-003 (post em-dash fix), but its `decision_object.audit.hash` is the **pre-fix** value from commit `c3f22df` (`342b4e...`).

A correct runner will:
1. JCS-canonicalize the AV-008 Decision Object (sans `audit.hash`) → same bytes as AV-003
2. SHA-256 → `c4d85ace...` (the correct, post-fix hash)
3. Compare against the **claimed** hash in AV-008's `audit.hash` → `342b4e...` (the old, pre-fix hash)
4. **Detect mismatch** ✅

A shorthand runner that skips recomputation (using cached answers, precomputed tables, or direct string comparison) will fail to detect this mismatch — and fail the compliance check.

**If AV-008 passes your step 6**, your implementation is not recomputing the hash. Something is wrong.

---

## 4. Common Pitfalls

### 4.1 Blanking Instead of Deleting

```javascript
// JavaScript/TypeScript:
// ❌ Wrong
obj.audit.hash = "";
// ✅ Correct
delete obj.audit.hash;

// Python:
// ❌ Wrong
obj["audit"]["hash"] = ""
// ✅ Correct
del obj["audit"]["hash"]

// Rust:
// ❌ Wrong
obj.audit.hash = Some("".to_string());
// ✅ Correct
obj.audit.hash = None;  // and ensure serde skips None during serialization

// Go:
// ❌ Wrong
obj.Audit.Hash = ""
// ✅ Correct
delete(obj.Audit, "hash")  // or omit the field from the struct entirely
```

Symptom: ALL vectors fail step 6 with completely different hash values. This is a systematic drift — if AV-001 through AV-007 all fail with the same pattern, you are probably blanking instead of deleting.

### 4.2 Non-Lexicographic Key Ordering

JCS requires keys in lexicographic (dictionary) order. `JSON.stringify()` in most languages does NOT guarantee key order. `json-canonicalize` on npm does. If your hashes don't match and you're using a generic JSON serializer, this is the most likely cause.

### 4.3 Including audit.hash in the Serialization

The Decision Object in the vector file ships WITH `audit.hash`. You must strip it before canonicalizing. If you forget, you will serialize an object that includes `"hash":"sha256:..."` — and the SHA-256 will be wrong for every vector.

### 4.4 Unicode/Normalization Issues

The em-dash character (—, U+2014) in AV-003/004/005 was the root cause of the c3f22df incident. JCS does NOT perform Unicode normalization. If your JSON parser normalizes Unicode (e.g., NFC vs NFD), your canonical bytes will diverge. Ensure your JSON parser preserves raw byte sequences for string values.

### 4.5 Number Formatting

JCS specifies that numbers follow JSON number format: no leading zeros, optional decimal point, optional exponent. `1.0` and `1` are different in JCS. The vector file uses integer `1` for `version` and `ring` values — ensure your serializer doesn't add `.0`.

---

## 5. Compliance Levels

| Level | Requirement | Vectors |
|:---|:---|---:|
| **L1 Basic Compatible** | Pass all v1.0 vectors | 28 (23 decision + 5 audit) |
| **L2 Verified Compatible** | Pass all v1.1 vectors | 45 (37 decision + 8 audit) |

For L2, AV-001 through AV-007 must pass step 6 (match), and AV-008 must correctly fail step 6 (mismatch detected).

---

## 6. Reference Implementations

| Implementation | Language | JCS Library | Verified |
|----------------|----------|-------------|:---:|
| Rulsynor | TypeScript | `json-canonicalize` v1.2.0 | ✅ AV-001~008 |
| Concordia | Python | RFC 8785 native implementation | ✅ AV-001~008 (2026-07-26) |

---

## 7. Relevant Specifications

- [ERDL Protocol Specification v1.1](../erdl-spec-v1.1.md) — §12 Decision Object
- [RFC 8785 — JSON Canonicalization Scheme (JCS)](https://datatracker.ietf.org/doc/rfc8785/)
- [FIPS 180-4 — Secure Hash Standard (SHA-256)](https://csrc.nist.gov/publications/fips/fips180-4)
- [IETF UUID v7 (RFC 9562)](https://datatracker.ietf.org/doc/rfc9562/) — decision_id format

---

> *"Neutrality is not declared but tested. Three independent implementations, one open specification, no single owner."*
> — Erik Newton, A2A Discussion #2031

---

_Guide maintained by OpenOBA. Corrections and improvements welcome via [GitHub Issues](https://github.com/OpenOBA/erdl-landing/issues)._
