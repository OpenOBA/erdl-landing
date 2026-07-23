/**
 * Copyright (c) 2026 唐启鑫 (Tang Qixin)
 * Licensed under MIT. See LICENSE file.
 */

/**
 * regenerate-audit-vectors-v1.1.cjs
 * Computes JCS+SHA-256 for AV-006 (DO-024) and AV-007 (DO-027).
 * Uses the same algorithm as the v1.0 regenerator for cross-implementation compatibility.
 */
const { canonicalize } = require('json-canonicalize');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DETERMINISTIC_IDS = {
  'AV-006': '018c4a3e-0006-7000-8000-000000000006',
  'AV-007': '018c4a3e-0007-7000-8000-000000000007',
};
const FIXED_TIMESTAMP = '2026-07-22T00:00:00.000Z';
const AGENT_ID = 'did:erdl:sha256:test-runner-v1.1';

function severityFor(d) { return {PASS:'none',ALLOW:'none',CORRECT:'medium',REQUEST_HUMAN:'medium',ESCALATE:'medium',NOTIFY:'low',DENY:'high',ROLLBACK:'high',QUARANTINE:'critical',EMERGENCY_HALT:'critical'}[d]||'none'; }
function actionFor(d) { return {PASS:'allowed',ALLOW:'allowed',CORRECT:'corrected',REQUEST_HUMAN:'paused',ESCALATE:'escalated',NOTIFY:'allowed',DENY:'blocked',ROLLBACK:'rolled_back',QUARANTINE:'quarantined',EMERGENCY_HALT:'halted'}[d]||'blocked'; }

function buildDO(vectorId, decisionId, policies, context, expected) {
  const toolName = context['tool.name'] || 'unknown';
  const record = {
    spec: 'decision-object-v1.0',
    decision_id: decisionId,
    timestamp: FIXED_TIMESTAMP,
    agent: { id: AGENT_ID, role: 'guardian', version: 'v1.1.0' },
    context: context,
    policies: policies.map(p => ({ id: p.id, name: p.name, version: 1, hash: 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex') })),
    evaluation: { proposal_id: null, matched_rules: (expected.matchedRules||[]).map(r => ({rule_id:r.ruleId,decision:r.decision,...(r.reason?{reason:r.reason}:{}),...(r.ring!==undefined?{ring:r.ring}:{}) })), total_evaluated: expected.totalEvaluated, total_matched: expected.totalMatched },
    result: { decision: expected.decision, severity: severityFor(expected.decision), reason: (expected.matchedRules||[]).length>0 ? (expected.matchedRules[0].reason||'rule matched') : 'no rules matched', action_taken: actionFor(expected.decision) },
    audit: { hash: 'PLACEHOLDER', previous_hash: null, commitment: `${FIXED_TIMESTAMP}|${AGENT_ID}|${toolName}|${expected.decision}` }
  };
  const copy = JSON.parse(JSON.stringify(record));
  delete copy.audit.hash;
  const canonical = canonicalize(copy);
  const sha256 = crypto.createHash('sha256').update(canonical).digest('hex');
  record.audit.hash = `sha256:${sha256}`;
  return { record, canonical_hex: Buffer.from(canonical,'utf-8').toString('hex'), sha256 };
}

// Load v1.1 vectors
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'decision-object-vectors-v1.1.json'), 'utf-8'));
const vmap = {};
for (const v of data.vectors) vmap[v.id] = v;

// AV-006: DO-024 (unless exemption → ALLOW)
const src24 = vmap['DO-024'];
const av6 = buildDO('AV-006', DETERMINISTIC_IDS['AV-006'], src24.rules, src24.context, src24.expected);

// AV-007: DO-027 (null propagation → PASS)  
const src27 = vmap['DO-027'];
const av7 = buildDO('AV-007', DETERMINISTIC_IDS['AV-007'], src27.rules, src27.context, src27.expected);

// Update placeholder audit vectors
for (const av of data.audit_vectors) {
  if (av.id === 'AV-006') {
    av.canonical_bytes = av6.canonical_hex;
    av.expected_sha256 = av6.sha256;
    av.decision_object = av6.record;
    av.__placeholder = false;
    console.log(`AV-006: sha256:${av6.sha256} decision:${av6.record.result.decision}`);
  }
  if (av.id === 'AV-007') {
    av.canonical_bytes = av7.canonical_hex;
    av.expected_sha256 = av7.sha256;
    av.decision_object = av7.record;
    av.__placeholder = false;
    console.log(`AV-007: sha256:${av7.sha256} decision:${av7.record.result.decision}`);
  }
}

fs.writeFileSync(path.join(__dirname, 'decision-object-vectors-v1.1.json'), JSON.stringify(data, null, 2), 'utf-8');
console.log('Updated v1.1 vectors file.');

// Self-verify
const reloaded = JSON.parse(fs.readFileSync(path.join(__dirname, 'decision-object-vectors-v1.1.json'), 'utf-8'));
for (const av of reloaded.audit_vectors) {
  if (av.id === 'AV-001' || av.id === 'AV-002' || av.id === 'AV-003' || av.id === 'AV-004' || av.id === 'AV-005') continue; // already verified
  const rec = JSON.parse(JSON.stringify(av.decision_object));
  delete rec.audit.hash;
  const c = canonicalize(rec);
  const h = crypto.createHash('sha256').update(c).digest('hex');
  const ok = h === av.expected_sha256;
  console.log(`${av.id}: ${ok ? '✓' : '✗'}`);
}
console.log('Done.');
