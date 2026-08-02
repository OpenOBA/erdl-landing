# Runner's Guide — Implementing an ERDL Decision Object Verifier

> Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.

> **目标读者**: 想在自己的 ERDL 规则引擎中实现 Decision Object v1.3 支持的开发者  
> **前提**: 理解 JSON、SHA-256、RFC 8785 (JCS)  
> **时间**: 读完本文约 15 分钟，实现基础 Runner 约 2-4 小时  

---

## 目录

1. [What Is a Runner?](#1-what-is-a-runner)
2. [Minimal Runner in 40 Lines](#2-minimal-runner-in-40-lines-pseudocode)
3. [The Five-Step Verification Algorithm](#3-the-five-step-verification-algorithm)
4. [JCS: The Hardest 50 Lines You'll Write](#4-jcs-the-hardest-50-lines-youll-write)
5. [Your Engine's Role: Populating Decision Objects](#5-your-engines-role-populating-decision-objects)
6. [Testing Against the Vector Set](#6-testing-against-the-vector-set)
7. [Common Pitfalls](#7-common-pitfalls)
8. [Answers File and Diagnostic Anchor (v1.3.1)](#8-answers-file-and-diagnostic-anchor-v131)
9. [Language-Specific JCS Notes](#9-language-specific-jcs-notes)
10. [Compatibility Levels](#10-compatibility-levels)
11. [Reference Implementations](#11-reference-implementations)

---

## 1. What Is a Runner?

A **Runner** is any piece of code that can take an ERDL Decision Object and validate its `audit.hash`. The canonical Runner is `scripts/verify.js` in this repository — a zero-dependency Node.js script that you can study, copy, or translate to your language of choice.

You don't need to implement the **Generator**. The Generator produces the static test vectors (`decision-object-vectors-v1.3.json`). You only need to implement verification — taking a Decision Object and checking that its `audit.hash` is correct.

## 2. Minimal Runner in 40 Lines (Pseudocode)

```python
import json
import hashlib

def sha256(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def jcs(value) -> str:
    """RFC 8785 JSON Canonicalization Scheme"""
    if value is None:     return 'null'
    if isinstance(value, bool): return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        assert value == value and value != float('inf') and value != float('-inf'), \
            'JCS: NaN/Infinity not allowed'
        return str(value)   # ECMAScript Number.toString()
    if isinstance(value, str): return json.dumps(value, ensure_ascii=True)
    if isinstance(value, list):
        return '[' + ','.join(jcs(v) for v in value) + ']'
    if isinstance(value, dict):
        keys = sorted(value.keys())
        return '{' + ','.join(
            json.dumps(k, ensure_ascii=True) + ':' + jcs(value[k])
            for k in keys if value[k] is not None   # omit undefined/null
        ) + '}'
    raise TypeError(f'{type(value)} not serializable')

def verify_do(decision_object: dict) -> tuple[bool, str, str]:
    """Five-step audit hash verification. Returns (passed, computed_hash, stored_hash)."""
    # Step 1: Deep clone
    clone = json.loads(json.dumps(decision_object))

    # Step 2: Delete self-referencing fields
    # Only delete audit.hash — previous_hash and commitment MUST stay in JCS preimage
    # extensions stays — participates directly in main JCS
    del clone['audit']['hash']
    del clone['signature']
    del clone['signing_key_id']

    # Step 3-4: JCS → SHA-256
    canonical = jcs(clone)
    computed_hash = 'sha256:' + sha256(canonical)
    stored_hash = decision_object['audit']['hash']

    # Step 5: Compare
    return computed_hash == stored_hash, computed_hash, stored_hash
```

That's it. 50 lines. If your language's `json.dumps()` doesn't produce RFC 8785-compliant output (most don't), you need a proper JCS implementation. See Section 4.

## 3. The Five-Step Verification Algorithm

The algorithm ([RFC 001 §13.3](OPENOBA-DOBJ-RFC-001-EN.md)) is designed to be implementable in any language with only two primitives: JCS serialization and SHA-256.

```
Input:  decision_object (JSON-parsed object)
Output: (passed: bool, computed_hash: str, stored_hash: str)

Step 1: Deep-clone the decision_object
        → clone = JSON.parse(JSON.stringify(decision_object))

Step 2: Delete self-referencing / external fields
        → delete clone.audit.hash
        → delete clone.signature
        → delete clone.signing_key_id
        (extensions stays, audit.previous_hash stays, audit.commitment stays)
        → (defensive) delete any __-prefixed internal fields

Step 3: JCS canonicalize the entire object
        → canonical = jcs(clone)
        (all fields including extensions are included)

Step 4: SHA-256 hash
        → hash_bytes = sha256(canonical)

Step 5: Compare
        → passed = 'sha256:' + hash_bytes == decision_object.audit.hash
```

**Key insight**: Steps 1-3 are identical in every language. The only language-specific parts are SHA-256 (trivial, every stdlib has it) and JCS (requires a careful implementation — see next section).

## 4. JCS: The Hardest 50 Lines You'll Write

RFC 8785 specifies exactly how JSON values must be serialized. Most JSON libraries get it *almost* right but fail on one of these:

### 4.1 Object Key Ordering

Keys MUST be sorted by **UTF-16 code unit order**. This is NOT alphabetical (Unicode) order.

```
Correct (UTF-16):  {"A":1,"a":2}     // 'A' (65) < 'a' (97)
Wrong (alphabetical): {"a":2,"A":1}   // locale-aware sort is wrong
```

In most languages, sorting by byte value or using a simple string sort works. Avoid locale-aware collation.

### 4.2 Number Serialization

RFC 8785 §3.2.2.3: "Numbers MUST be serialized as if by applying the ECMAScript `Number.prototype.toString` method."

| Value | Correct JCS | Wrong |
|-------|-------------|-------|
| `1` | `1` | `1.0` |
| `1.5` | `1.5` | `1.50` |
| `0` | `0` | `0.0` |
| `-0` | `0` | `-0` |
| `1e20` | `100000000000000000000` | `1e+20` |
| `0.0000001` | `1e-7` | `0.0000001` |
| `NaN` | **REJECT** | — |
| `Infinity` | **REJECT** | — |

This is the most common source of cross-implementation bugs. **Test against the vector set early.**

**Python tip**: Python's `str(float)` is NOT ECMAScript-compliant for large numbers. Use `repr()` and convert:

```python
def jcs_number(n: float) -> str:
    if n != n or n == float('inf') or n == float('-inf'):
        raise ValueError('JCS: NaN/Infinity not allowed')
    # Python float repr is close to ES6 but not identical for edge cases
    # The safest approach: if your engine produces DOs, use integer arithmetic where possible
    # For verification, your implementation must match the reference.
    return str(n)  # good enough for the integer-heavy DO vector set
```

**Go tip**: `fmt.Sprintf("%v", n)` is NOT guaranteed to match ES6. Use `strconv.FormatFloat(n, 'G', -1, 64)` and strip trailing `.0`.

### 4.3 Omit over Null

Fields whose values are `undefined` or `None`/`null` MUST be **physically absent** from the JSON object before serialization. A field with value `null` is NOT the same as a missing field in JCS — if the spec says "omit over null", you must delete the key.

```python
# WRONG — null values will appear in JCS output
obj = {'a': 1, 'extensions': None}
jcs(obj)  # → '{"a":1,"extensions":null}' <— different hash!

# RIGHT — delete before JCS
obj = {'a': 1}
# (extensions was never added, or was deleted with `del obj['extensions']`)
jcs(obj)  # → '{"a":1}' <— correct
```

### 4.4 String Escaping

Use JSON-standard string escaping (RFC 8259 §7). `\n`, `\t`, `\\`, `\"`, and Unicode escapes where needed. Most language JSON libraries handle this correctly.

### 4.5 Negative Zero

`-0` MUST serialize as `0`. In JavaScript: `String(-0) === '0'`. In Python: `str(-0.0) === '-0.0'` → **wrong**. You must special-case this.

```python
def jcs_number(n: float) -> str:
    if n == 0.0:           # catches both 0.0 and -0.0
        return '0'
    return str(n)
```

### 4.6 Quick Self-Test

Your JCS implementation must produce these exact outputs:

```python
assert jcs(None) == 'null'
assert jcs(True) == 'true'
assert jcs(42) == '42'
assert jcs(0) == '0'
assert jcs(-0.0) == '0'
assert jcs('hello') == '"hello"'
assert jcs([]) == '[]'
assert jcs({}) == '{}'
assert jcs({'b': 2, 'a': 1}) == '{"a":1,"b":2}'
assert jcs([1, 'two', None]) == '[1,"two",null]'
assert jcs({'z': {'y': 1}, 'a': 2}) == '{"a":2,"z":{"y":1}}'
```

All passing? Good. Now verify against the real vector set (Section 6).

## 5. Your Engine's Role: Populating Decision Objects

If you're building an ERDL rule engine (not just verifying), your engine produces Decision Objects. The seven fields that affect the audit hash are:

| Field | Your engine's responsibility |
|-------|-----------------------------|
| `decision_id` | Generate a unique identifier |
| `timestamp` | ISO 8601 timestamp of evaluation |
| `agent` | Your agent's identity and capabilities |
| `context` | The evaluation context (tool call params, etc.) |
| `policies` | The rule set evaluated, each with JCS-based hash |
| `evaluation` | Which rules matched, which triggered, why |
| `result` | The final decision and applied rule |

Everything else (`compliance_profile`, `impact_assessment_id`, `extensions`, etc.) is either fixed or optional.

**The hash formula** (what your engine computes before signing):

```
audit.hash = SHA-256(
  JCS({
    spec,
    decision_id,
    compliance_profile,
    execution_trace_id,
    timestamp,
    evaluation_duration_ms,
    agent,
    model_id,
    context,
    context_snapshot_hash,
    sanitized_context,
    rule_set_version,
    policies,
    fairness_assessment,
    impact_assessment_id,
    autonomy_level,
    confidence_score,
    evaluation,
    data_modification_expected,
    result,
    human_oversight,
    // audit.previous_hash and audit.commitment (v1.3: chain integrity fields)
    // extensions (participates directly in main JCS)
  })
)
```

Note: `audit.hash`, `signature`, and `signing_key_id` are NOT included in the hash preimage. `extensions`, `audit.previous_hash`, and `audit.commitment` ARE included — they participate directly in the main JCS.

## 6. Testing Against the Vector Set

### Step 1: Verify audit.hash (Five-Step)

```bash
node scripts/verify.js --vectors=decision-object-vectors-v1.3.json
```

Expected reference output (from our verify.js): `ALL VERIFICATIONS PASSED · 11/11 MATCH + AV-013 CHAIN CANARY DETECTED`

With your runner, do the same: for each of the 12 audit hash vectors, run the five-step verification. You should get 11 MATCH + 1 MISMATCH. If all 12 report MATCH, your verifier is not independently computing the hash — it is comparing pre-computed values.

### Step 2: Verify your engine's DO output

Once your JCS is verified correct, test your engine:

1. Take DO-001 from the vector set as input context
2. Run your engine's rule evaluator against it
3. Your engine must produce a Decision Object
4. Run five-step verification on your engine's output
5. If the hash matches, your DO format is compatible

### Step 3: Full L3 compatibility

Run all 63 static DO vectors through your engine's evaluate → produce DO → verify cycle. All 63 must pass.

## 7. Common Pitfalls

### P0: Using the wrong hash formula

The audit hash covers the **entire DO minus audit.hash/signature/signing_key_id**. `extensions`, `audit.previous_hash`, and `audit.commitment` participate directly in the main JCS. If you delete the entire `audit` object → `previous_hash` and `commitment` excluded from hash → chain position tampering undetectable.

### P0: Self-referential hash fields — forget to exclude the hash key

`policies[].hash` and `compliance_profile.profile_hash` are computed from the object they sit inside. When computing these hashes, you MUST **temporarily remove the hash key itself** before JCS. If you leave `hash` in the policy object while canonicalizing, your result will differ from the reference implementation.

```python
# WRONG — hash key participates in its own computation
policy = {'id': 'rule-001', 'hash': '', 'when': {...}}
policy['hash'] = sha256(jcs(policy))  # ← hash key is still in policy!

# RIGHT — exclude hash key first
policy = {'id': 'rule-001', 'when': {...}}  # no hash yet
h = sha256(jcs(policy))  # JCS without hash
policy['hash'] = h  # write back after
```

This is the exact same class of bug as c3f22df — accidental serialization form affecting the hash.

### P0: Including `null` fields in JCS

If your DO has `sanitized_context: null`, your JCS will include `"sanitized_context":null` → different hash from an implementation that omits it. The generator explicitly sets it to `null`; you must match. **Read the generator source to see exactly which fields have null values.**

### P1: Number formatting differences

`1.0` vs `1`. This is the #1 cross-language bug. Python's `str(1.0)` → `'1.0'`. JavaScript's `String(1.0)` → `'1'`. You must strip the trailing `.0` or better, avoid floats entirely in your DOs.

### P1: Object keys with special characters

Keys containing spaces, colons, or Unicode require proper JSON string escaping in both the key AND the JCS output. Most JSON libraries handle this, but hand-rolled implementations often miss it.

### P1: Schema pruning — field removal differs by language

[RFC 001 §5.4](OPENOBA-DOBJ-RFC-001-EN.md) requires removing non-activated JURISDICTION fields from the DO before JCS. The meaning of "remove" varies by language, and inconsistent removal produces different canonical bytes:

**Correct**: physically delete the key from the object, so the key does not appear in the JCS output at all.
**Wrong**: set the key to `null` / `undefined` / empty string (these all produce different JCS output than omitting the key).

Language-specific recommendations:

| Language | Correct | Wrong |
|----------|---------|-------|
| JavaScript | `delete obj[key]` | `obj[key] = null` or `obj[key] = undefined` |
| Python | `del d[key]` or `d.pop(key, None)` | `d[key] = None` |
| Go | Use `map[string]interface{}` — delete with `delete(m, key)`; for structs, build a new map excluding the field | Setting a struct field to zero value |
| Java | `map.remove(key)` (if using Map) or build a new Jackson ObjectNode without the field | `node.putNull(key)` |
| Rust | `map.remove(key)` (if using serde_json::Map) or use `#[serde(skip_serializing_if)]` on Option fields | `map[key] = Value::Null` |

**Verification**: after pruning, serialize the DO to JSON and confirm the pruned keys do NOT appear in the output. Then run JCS on the pruned object.

### P2: All 12 audit vectors report MATCH

If your runner reports all 12 audit vectors as MATCH, your five-step verification is NOT computing from scratch — you're comparing pre-computed hashes. The vector set includes one intentionally stale audit vector where `audit.hash` does not match the independently computed hash. Only a runner that recalculates the hash (not just reads stored values) will detect the MISMATCH.

> ⚠️ **Important**: A runner should NEVER special-case any vector by id. All 12 audit vectors go through the same five-step pipeline regardless of their identity. AV-013's stored `audit.hash` was computed by a regressed runner (delete entire audit — no `previous_hash` in JCS preimage). A correct runner that includes `previous_hash` in JCS will detect the mismatch. A regressed runner that excludes `previous_hash` will falsely report MATCH — and the canary catches this.

### P2: Timestamp format

The vector set uses `'2026-07-28T00:00:00.000Z'`. Your engine should use ISO 8601 with milliseconds and `Z` suffix.

## 8. Answers File and Diagnostic Anchor (v1.3.1)

v1.3.1 removes ALL `canonical_hex` fields from the vector file. AV vectors now carry `diag_hash` (first 14 characters of `audit.hash`, i.e. `"sha256:"` + 8 hex digits) as a one-way SHA-256 debug anchor. Full canonical_hex answers were previously in a separate answers file. Since v1.3.1, the answers file has been withdrawn from the repository per E1-E3 principles — runners MUST implement their own JCS canonicalizer.

### What this means for runners

- The vector file contains ZERO canonical bytes — **no JCS output is exposed**
- `diag_hash` is an SHA-256 prefix — **cannot** be inverted to recover JCS output
- `diag_hash` helps debug: "my result starts with `x`, the answer starts with `y`"
- The answers file (withdrawn in v1.3.1) was for development diagnostics only
- Conformance runners MUST NOT read the answers file — they MUST implement their own JCS
- CI/CD compliance pipelines should make the answers file inaccessible to the verifier

### Why this change

v1.2's `canonical_hex` in the vector file was a structural vulnerability — a runner could SHA-256 the pre-computed canonical bytes without implementing JCS and falsely pass verification. v1.3 moved `canonical_hex` to a separate file; v1.3.1 removes it entirely from the vector file, replacing it with a one-way hash prefix that cannot be used for verification.

## 9. Language-Specific JCS Notes

The JCS constraints in [RFC 001 §3.1](OPENOBA-DOBJ-RFC-001-EN.md) apply across all languages. Below are known pitfalls and recommended practices for common implementation languages.

### Python

| Pitfall | Fix |
|---------|-----|
| `json.dumps(12)` → `"12"` but `json.dumps(12.0)` → `"12.0"` (trailing `.0`) | Use `int` only for integer fields; never let `float` near integer keys |
| Large ints beyond JS safe range silently output | Validate all integer fields are within ±2^53-1 before JCS |
| `None` serialized as `null` by default | Implement Omit-over-Null: remove keys with `None`/`[]` values before JCS (see §3.1(5)) |

**Recommended JCS library**: `rfc8785` (pip install algovoi-substrate, wraps Trail of Bits' implementation) or `json-canonicalize`

### JavaScript / TypeScript

| Pitfall | Fix |
|---------|-----|
| `JSON.stringify` does NOT guarantee key order (ES2015+ de facto insertion order, but not spec-guaranteed) | Use `json-canonicalize` (npm) — RFC 8785 compliant |
| `typeof 1.0 === typeof 1` → both `"number"`; no distinction | Use `Number.isInteger()` to validate; reject non-integer values for integer fields |
| `null` and `undefined` behave differently in `JSON.stringify` | Implement explicit Omit-over-Null pre-processing |

**Recommended JCS library**: `canonicalize` (npm install canonicalize@^3.0.0) — byte-identical with Python rfc8785, validated across 8 implementations

### Go

| Pitfall | Fix |
|---------|-----|
| `json.Marshal` may output `12.0` for `float64(12)` | Use `int64` for integer fields; cast explicitly; never round-trip through `float64` |
| Map key ordering not guaranteed | Use `gowebpki/jcs` (v1.0.1) — RFC 8785 compliant |

**Recommended JCS library**: `gowebpki/jcs` v1.0.1

### Java

| Pitfall | Fix |
|---------|-----|
| `BigDecimal` canonical form varies (`"1.0"` vs `"1.00"`) | Use `int`/`long` for integer fields; for string-encoded decimals, strip trailing zeros per spec regex |
| `null` fields in Jackson/Gson | Implement Omit-over-Null: configure serializers to skip nulls |

**Recommended JCS library**: `io.github.erdtman:java-json-canonicalization` v1.1 (by RFC 8785 author Anders Rundgren)

### Rust

| Pitfall | Fix |
|---------|-----|
| `serde_json::to_string(&12.0)` → `"12.0"` | Use `i64`/`u64` for integer fields; avoid `f64` |
| `Option::None` serialized as `null` by default | Use `#[serde(skip_serializing_if = "Option::is_none")]` or manual pre-processing |

**Recommended JCS library**: `serde_jcs` 0.2.0

> **Cross-validation**: The libraries recommended above have been byte-for-byte cross-validated across 8 languages on 24 canonicalisation vectors (see AlgoVoi's [8-impl attestation](https://github.com/chopmob-cloud/algovoi-jcs-conformance-vectors/blob/main/_attestations/2026-05-24-8-impl-cross-validation.md)). Your implementation should produce identical bytes on the same input. If it doesn't, the bug is in your pre-processing, not in the JCS library.

## 10. Compatibility Levels

| Level | Vectors | Requirement |
|:-----:|:-------:|-------------|
| **L1** | 28 | Basic: JCS + SHA-256 correct, DO structure valid |
| **L2** | 45 | Verified: all v1.1 vectors pass, dynamic vectors supported |
| **L3** | 101 | Full: all v1.3 vectors, including AV-013 chain integrity canary |

Start with L1. Most runners pass L1 within a few hours. L2 and L3 add edge cases that flush out JCS number formatting and null-handling bugs.

## 11. Reference Implementations

| Language | File | Notes |
|----------|------|-------|
| **JavaScript (Node.js)** | `scripts/verify.js` | Zero-dependency, self-built JCS, v1.3 |
| **JavaScript (Node.js)** | `scripts/generate-vectors.cjs` | Generator with `json-canonicalize` JCS library |
| **TypeScript** | `test/verify-comprehensive.test.ts` | 88 tests covering JCS edge cases |

To add your language to this list, submit a PR with your Runner implementation and verification results.

---

> *"Neutrality is tested, not declared."*  
>  
> Pass the vectors. Then claim compatibility.
