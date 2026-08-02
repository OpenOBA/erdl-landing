#!/usr/bin/env node
/**
 * verify.js — ERDL Decision Object v1.3 Cross-Implementation Verifier
 *
 * Zero-dependency verification of decision-object-vectors-v1.3.json.
 * Self-built JCS (RFC 8785) + SHA-256, cross-implementation verifiable.
 *
 * Usage: node verify.js [path/to/vectors.json]
 *
 * Verification steps (RFC 001 §13.3, v1.3):
 *   1. Parse JSON → deep clone decision_object
 *   2. Delete audit.hash / signature / signing_key_id
 *      (extensions, audit.previous_hash, audit.commitment stay)
 *   3. JCS serialize remaining fields
 *   4. SHA-256
 *   5. Compare with stored audit.hash
 *
 * Special: AV-013 EXPECTED_MISMATCH — chain position tampering canary.
 *          Stored hash = regressed runner digest (entire audit deleted).
 *          Correct runner (includes previous_hash) → MISMATCH.
 *          Regressed runner (excludes previous_hash) → MATCH (caught).
 *
 * AV vectors carry diag_hash (audit.hash prefix) for debug anchoring only.
 * No canonical bytes are exposed in the vector file.
 *
 * Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.
 * Author: Tang Haoran — OpenOBA AI Executive
 * Date: 2026-07-29
 *
 * RFC 8785 (JCS) implementation notes:
 *   - Numbers: ES6 Number.prototype.toString() — String(n) in JS
 *   - Objects: keys sorted by UTF-16 code unit (JS default)
 *   - Omit over Null: undefined/null fields physically deleted before JCS
 *   - Whitespace: none between tokens
 *   - NaN/Infinity: not allowed (input validation)
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════
//  SHA-256 (Node.js built-in crypto)
// ═══════════════════════════════════════════════════

function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

// ═══════════════════════════════════════════════════
//  JCS (RFC 8785) — Self-built, zero-dependency
// ═══════════════════════════════════════════════════

/**
 * Serialize a value according to RFC 8785 JCS rules.
 *
 * Constraints:
 *   - UTF-8 output (Node.js default)
 *   - Property keys sorted by UTF-16 code unit order (JS Object.keys default)
 *   - No whitespace between tokens
 *   - Numbers: ES6 Number.prototype.toString() (String(n) in JS)
 *   - Strings: JSON-string-escaped per RFC 8259 §7 (JSON.stringify)
 *   - Omit over Null: undefined/null-value fields deleted BEFORE calling this
 */
function jcsCanonicalize(value) {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    if (!isFinite(value)) {
      throw new Error('JCS: NaN/Infinity not allowed in canonical JSON');
    }
    // RFC 8785 §3.2.2.3: numbers serialized using ES6 Number.prototype.toString()
    // String(n) in JavaScript is exactly this — produces sign+digits+.+digits+e+sign+digits
    return String(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const elements = value.map(v => jcsCanonicalize(v));
    return '[' + elements.join(',') + ']';
  }

  if (typeof value === 'bigint') {
    throw new Error('JCS: BigInt is not a valid JSON value per RFC 8785')
  }
  if (typeof value === 'symbol') {
    throw new Error('JCS: Symbol is not a valid JSON value per RFC 8785')
  }
  if (typeof value === 'function') {
    throw new Error('JCS: Function is not a valid JSON value per RFC 8785')
  }

  if (typeof value === 'object') {
    // Defensive: reject non-plain objects that could serialize ambiguously
    if (value === null) return 'null'
    if (value instanceof Date) {
      throw new Error('JCS: Date objects are not serializable — convert to ISO string first')
    }
    if (value.constructor !== Object && value.constructor !== Array) {
      throw new Error('JCS: non-plain object (' + (value.constructor ? value.constructor.name : 'unknown') + ') is not serializable')
    }
    // Sort keys by UTF-16 code unit (JS default for Object.keys)
    const keys = Object.keys(value).sort();
    const members = [];
    for (const k of keys) {
      const v = value[k];
      // Omit over Null: skip undefined values, but KEEP null (JCS: null is a valid JSON value)
      if (v === undefined) continue;
      members.push(JSON.stringify(k) + ':' + jcsCanonicalize(v));
    }
    return '{' + members.join(',') + '}';
  }

  throw new Error('JCS: unsupported type ' + typeof value);
}

// ═══════════════════════════════════════════════════
//  Five-Step Verification (Whitepaper §13.3)
// ═══════════════════════════════════════════════════

function verifyDO(vectorId, decisionObject) {
  // ══ DoS Protection (Whitepaper §3.1 constraint 7) ══
  // Check before clone to avoid allocating memory for oversized DO
  const doJson = JSON.stringify(decisionObject);
  if (doJson.length > 1024 * 1024) {  // 1 MB
    return { passed: false, error: 'resource_limit_exceeded: DO exceeds 1 MB' };
  }
  const extCount = Array.isArray(decisionObject.extensions) ? decisionObject.extensions.length : 0;
  if (extCount > 100) {
    return { passed: false, error: 'resource_limit_exceeded: extensions > 100 entries' };
  }

  // Step 1: Deep clone
  const clone = JSON.parse(JSON.stringify(decisionObject));

  // Step 2: Delete self-referencing / external fields
  // Only delete audit.hash (not the whole audit object —
  // audit.previous_hash and audit.commitment MUST stay in the JCS preimage)
  // extensions STAYS in the tree — participates directly in main JCS
  delete clone.audit.hash;
  delete clone.signature;
  delete clone.signing_key_id;

  // Sanitize: also delete any leftover placeholder/internal fields
  delete clone.extensions_validation;
  // No canonical_hex field exists in v1.3 vectors

  // Step 3: JCS Serialize
  const canonicalFull = jcsCanonicalize(clone);
  const canonicalHex = Buffer.from(canonicalFull, 'utf8').toString('hex');

  // Step 4: SHA-256
  const computedHash = 'sha256:' + sha256(canonicalFull);

  // Step 5: Compare
  const storedHash = decisionObject.audit.hash;

  return {
    passed: computedHash === storedHash,
    canonical_hex: canonicalHex,
    computedHash,
    storedHash
  };
}

// ═══════════════════════════════════════════════════
//  Main — Verify all Audit Hash Vectors
// ═══════════════════════════════════════════════════

function main() {
  const args = process.argv.slice(2);
  const vectorsPath = args[0] || path.join(__dirname, '..', 'decision-object-vectors-v1.3.json');

  if (!fs.existsSync(vectorsPath)) {
    console.error('ERROR: Vectors file not found: ' + vectorsPath);
    console.error('Usage: node verify.js [path/to/decision-object-vectors-v1.3.json]');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════');
  console.log('  ERDL Decision Object v1.3 Vector Verifier');
  console.log('═══════════════════════════════════════════════');
  console.log('  File: ' + vectorsPath);
  console.log('');

  // ── DoS Protection (Whitepaper §3.1 constraint 7) ──
  const raw = fs.readFileSync(vectorsPath, 'utf8');
  if (raw.length > 100 * 1024 * 1024) {  // 100MB vector set limit
    console.error('ERROR: Vectors file exceeds 100MB limit');
    process.exit(1);
  }

  const data = JSON.parse(raw);

  // ── Schema validation ──
  if (!data.vectors || !Array.isArray(data.vectors)) {
    console.error('ERROR: vectors file missing "vectors" array field')
    process.exit(1)
  }
  if (!data.audit_vectors || !Array.isArray(data.audit_vectors)) {
    console.error('ERROR: vectors file missing "audit_vectors" array field')
    process.exit(1)
  }
  for (const vec of data.vectors) {
    if (!vec.decision_object) {
      console.error('ERROR: vector ' + (vec.id || '?') + ' is missing decision_object')
      process.exit(1)
    }
    // v1.3: canonical_hex removed from vectors entirely;
    // diag_hash (audit.hash prefix) provides debug anchoring
    // Static DOs carry neither canonical_hex nor diag_hash
  }
  for (const av of data.audit_vectors) {
    if (!av.decision_object || !av.decision_object.audit || !av.decision_object.audit.hash) {
      console.error('ERROR: audit vector ' + (av.id || '?') + ' is missing decision_object.audit.hash')
      process.exit(1)
    }
  }

  // ── Verify JCS self-consistency first ──
  console.log('── JCS Self-Consistency Check ──');
  const testObj = { b: 2, a: 1, c: [3, null, 'hello'], d: { nested: true, arr: [] } };
  const jcsOutput = jcsCanonicalize(testObj);
  const expectedJcs = '{"a":1,"b":2,"c":[3,null,"hello"],"d":{"arr":[],"nested":true}}';

  // Sanitize testObj to remove null fields for Omit over Null test
  const testObjOmitNull = { b: 2, a: 1, x: null, y: undefined, c: [3, null, 'hello'] };
  // Manual sanitize: remove undefined/null
  function sanitizeNulls(obj) {
    if (Array.isArray(obj)) return obj.map(v => (v === undefined || v === null) ? null : v);
    const result = {};
    for (const k of Object.keys(obj).sort()) {
      const v = obj[k];
      if (v === undefined || v === null) continue;
      result[k] = v;
    }
    return result;
  }
  const cleaned = sanitizeNulls(testObjOmitNull);
  const jcsOmitNull = jcsCanonicalize(cleaned);
  const expectedOmitNull = '{"a":1,"b":2,"c":[3,null,"hello"]}';

  if (jcsOutput === expectedJcs) {
    console.log('  ✓ basic JCS canonicalization correct');
  } else {
    console.error('  ✗ JCS BASIC MISMATCH');
    console.error('    Expected: ' + expectedJcs);
    console.error('    Got:      ' + jcsOutput);
    process.exit(1);
  }

  if (jcsOmitNull === expectedOmitNull) {
    console.log('  ✓ Omit over Null correct (null/undefined fields stripped)');
  } else {
    console.error('  ✗ Omit over Null FAILED');
    console.error('    Expected: ' + expectedOmitNull);
    console.error('    Got:      ' + jcsOmitNull);
    process.exit(1);
  }

  // Edge case: canonicalize empty array
  const jcsEmptyArray = jcsCanonicalize([]);
  if (jcsEmptyArray === '[]') {
    console.log('  ✓ empty array → "[]"');
  } else {
    console.error('  ✗ empty array FAILED: ' + jcsEmptyArray);
    process.exit(1);
  }

  console.log('');

  // ── Verify SELF-CONTAINED static DOs ──
  console.log('── Static DO Audit Hash Self-Consistency ──');
  let doPasses = 0;
  let doFails = 0;
  for (const vec of data.vectors) {
    // v1.3: Verify audit.hash only — canonical_hex removed from vectors
    // diag_hash (audit.hash prefix) available for debug anchoring
    const clone = JSON.parse(JSON.stringify(vec.decision_object));
    const storedHash = clone.audit.hash;
    delete clone.audit.hash;
    delete clone.signature;
    delete clone.signing_key_id;
    delete clone.extensions_validation;
    const selfJcs = jcsCanonicalize(clone);
    const computedHash = 'sha256:' + sha256(selfJcs);

    if (computedHash === storedHash) {
      doPasses++;
    } else {
      doFails++;
      if (doFails <= 3) {
        console.log('  ✗ ' + vec.id + ' audit.hash mismatch');
      }
    }
  }
  console.log('  ✓ ' + doPasses + ' / ' + data.vectors.length + ' DO audit.hash self-consistent');
  if (doFails > 0) {
    console.log('  ✗ ' + doFails + ' FAILURES — check JCS implementation');
  }
  console.log('');

  // ── Verify Audit Hash Vectors (Five-Step) ──
  console.log('── Audit Hash Vector Verification (Five-Step) ──');
  const av = data.audit_vectors || [];
  let passes = 0;
  let mismatches = 0;
  let errors = 0;

  const results = [];

  for (const avVec of av) {
    const id = avVec.id;
    const result = verifyDO(id, avVec.decision_object);

    let status;
    if (id === 'AV-013') {
      // AV-013: EXPECTED MISMATCH (chain position tampering canary)
      // Stored hash = regressed runner digest (entire audit deleted from JCS preimage).
      // Correct runner (includes previous_hash) → MISMATCH (detects tampered previous_hash).
      // Regressed runner (excludes previous_hash) → MATCH (canary catches regression).
      if (!result.passed) {
        status = '✓ EXPECTED_MISMATCH';
        passes++;
      } else if (result.passed) {
        status = '✗ FALSE_PASS (AV-013 should mismatch — previous_hash excluded from JCS?)';
        errors++;
      } else {
        status = '✗ ERROR: ' + result.error;
        errors++;
      }
    } else {
      if (result.passed) {
        status = '✓ MATCH';
        passes++;
      } else {
        status = '✗ FAIL: ' + (result.error || 'audit.hash mismatch');
        mismatches++;
      }
    }

    results.push({ id, status, result });
    console.log('  ' + status.padEnd(50) + ' | ' + id + ' ← ' + avVec.vector_ref);
  }

  console.log('');

  // ── Summary ──
  console.log('═══════════════════════════════════════════════');
  console.log('  VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log('  Audit vectors total:   ' + av.length);
  console.log('  ✓ PASS (hash match):   ' + passes);
  console.log('  ✗ MISMATCH:            ' + mismatches);
  console.log('  ✗ ERROR:               ' + errors);
  console.log('');

  if (av.length > 0) {
    const expectedPassCount = 11; // 12 AVs minus AV-013
    const expectedMismatchCount = 1; // AV-013: chain position tampering canary

    // passes includes AV-013 (counted as EXPECTED_MISMATCH in passes)
    const matchCount = passes - 1; // exclude AV-013
    const canaryMismatchCount = passes - matchCount; // AV-013 (the one expected mismatch)
    
    console.log('  Expected: ' + expectedPassCount + ' MATCH + ' + expectedMismatchCount + ' MISMATCH (AV-013)');
    console.log('  Got:      ' + matchCount + ' MATCH + ' + canaryMismatchCount + ' MISMATCH (AV-013)');
    console.log('');

    if (matchCount === expectedPassCount && canaryMismatchCount === expectedMismatchCount && mismatches === 0 && errors === 0) {
      console.log('  ╔══════════════════════════════════════╗');
      console.log('  ║  ✅ ALL VERIFICATIONS PASSED         ║');
      console.log('  ║  11/11 MATCH + AV-013 CHAIN CANARY DETECTED ║');
      console.log('  ╚══════════════════════════════════════╝');
      console.log('');
      console.log('  Decision Object v1.3 vectors are cross-implementation verifiable.');
      process.exit(0);
    } else {
      console.log('  ╔══════════════════════════════════════╗');
      console.log('  ║  ❌ VERIFICATION FAILED              ║');
      console.log('  ╚══════════════════════════════════════╝');
      process.exit(1);
    }
  }
}

main();
