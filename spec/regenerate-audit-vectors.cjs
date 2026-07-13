/**
 * regenerate-audit-vectors.cjs
 * 
 * Re-run the entire generation and overwrite the audit_vectors section
 * in decision-object-vectors-v1.0.json to ensure byte-for-byte consistency.
 */

const { canonicalize } = require('json-canonicalize');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DETERMINISTIC_IDS = {
  'AV-001': '018c4a3e-0001-7000-8000-000000000001',
  'AV-002': '018c4a3e-0002-7000-8000-000000000002',
  'AV-003': '018c4a3e-0003-7000-8000-000000000003',
  'AV-004': '018c4a3e-0004-7000-8000-000000000004',
  'AV-005': '018c4a3e-0005-7000-8000-000000000005',
};

const FIXED_TIMESTAMP = '2026-07-13T03:30:00.000Z';
const AGENT_ID = 'did:erdl:sha256:test-runner-v1';

function severityForDecision(d) {
  const m = { PASS:'none', ALLOW:'none', CORRECT:'medium', REQUEST_HUMAN:'medium', ESCALATE:'medium', NOTIFY:'low', DENY:'high', ROLLBACK:'high', QUARANTINE:'critical', EMERGENCY_HALT:'critical' };
  return m[d] || 'none';
}

function actionForDecision(d) {
  const m = { PASS:'allowed', ALLOW:'allowed', CORRECT:'corrected', REQUEST_HUMAN:'paused', ESCALATE:'escalated', NOTIFY:'allowed', DENY:'blocked', ROLLBACK:'rolled_back', QUARANTINE:'quarantined', EMERGENCY_HALT:'halted' };
  return m[d] || 'blocked';
}

function policyHash(policy) {
  // Same as generator: JSON.stringify the entire rule object
  return 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(policy)).digest('hex');
}

function buildDecisionObject(vectorId, decisionId, policies, context, expected) {
  const toolName = context['tool.name'] || 'unknown';
  
  return {
    spec: 'decision-object-v1.0',
    decision_id: decisionId,
    timestamp: FIXED_TIMESTAMP,
    agent: {
      id: AGENT_ID,
      role: 'guardian',
      version: 'v1.0.0'
    },
    context: context,
    policies: policies.map(p => ({
      id: p.id,
      name: p.name,
      version: 1,
      hash: policyHash(p)
    })),
    evaluation: {
      proposal_id: null,
      matched_rules: expected.matchedRules.map(r => {
        const obj = { rule_id: r.ruleId, decision: r.decision };
        if (r.reason) obj.reason = r.reason;
        if (r.instruction) obj.instruction = r.instruction;
        if (r.correction) obj.correction = r.correction;
        if (r.ring !== undefined) obj.ring = r.ring;
        return obj;
      }),
      total_evaluated: expected.totalEvaluated,
      total_matched: expected.totalMatched
    },
    result: {
      decision: expected.decision,
      severity: severityForDecision(expected.decision),
      reason: expected.matchedRules.length > 0
        ? (expected.matchedRules[0].reason || expected.matchedRules[0].instruction || expected.matchedRules[0].correction || 'rule matched')
        : 'no rules matched',
      action_taken: actionForDecision(expected.decision)
    },
    audit: {
      hash: 'PLACEHOLDER',
      previous_hash: null,
      commitment: `${FIXED_TIMESTAMP}|${AGENT_ID}|${toolName}|${expected.decision}`
    }
  };
}

function computeHash(record) {
  const copy = JSON.parse(JSON.stringify(record));
  delete copy.audit.hash;
  const c = canonicalize(copy);
  const h = crypto.createHash('sha256').update(c).digest('hex');
  return {
    canonical_bytes_hex: Buffer.from(c, 'utf-8').toString('hex'),
    sha256: h
  };
}

// ── Load vectors ────────────────────────────────────────────────
const vectorsPath = path.join(__dirname, 'decision-object-vectors-v1.0.json');
const data = JSON.parse(fs.readFileSync(vectorsPath, 'utf-8'));

const vmap = {};
for (const v of data.vectors) vmap[v.id] = v;

const SELECTIONS = [
  { auditId: 'AV-001', vectorRef: 'DO-001', note: 'Security DENY: financial exec blocked by Ring 0 guardian. Tests canonical serialization of a DENY decision with one matched rule.' },
  { auditId: 'AV-002', vectorRef: 'DO-003', note: 'Compliance REQUEST_HUMAN: PHI access triggers mandatory human review. Tests Ring 1 compliance decision with PHI context.' },
  { auditId: 'AV-003', vectorRef: 'DO-010', note: 'Override ALLOW: Ring 0 DENY overridden by Ring 3 ALLOW with explicit override flag. Tests multi-rule matched_rules array + instruction field.' },
  { auditId: 'AV-004', vectorRef: 'DO-013', note: 'Ring 0 EMERGENCY_HALT: critical anomaly triggers immediate halt — short-circuits all remaining evaluation. Tests critical severity + halt action_taken.' },
  { auditId: 'AV-005', vectorRef: 'DO-022', note: 'Multi-agent trust ESCALATE: low-reputation agent operating in high-risk context. Tests ESCALATE decision with reputation context + escalated action_taken.' },
];

// ── Generate ────────────────────────────────────────────────────
const auditVectors = [];

for (const sel of SELECTIONS) {
  const src = vmap[sel.vectorRef];
  const record = buildDecisionObject(sel.auditId, DETERMINISTIC_IDS[sel.auditId], src.rules, src.context, src.expected);
  const { canonical_bytes_hex, sha256 } = computeHash(record);
  
  record.audit.hash = `sha256:${sha256}`;

  const av = {
    id: sel.auditId,
    vector_ref: sel.vectorRef,
    category: 'audit-hash',
    spec_version: 'decision-object-v1.0',
    note: sel.note,
    description: src.scenario,
    canonicalization: 'JCS (RFC 8785)',
    hash_algorithm: 'SHA-256',
    canonical_bytes: canonical_bytes_hex,
    expected_sha256: sha256,
    decision_object: record,
    source_vector: {
      id: src.id,
      category: src.category,
      decision: src.expected.decision
    }
  };

  auditVectors.push(av);
  console.log(`${sel.auditId} (← ${sel.vectorRef}): sha256:${sha256}  decision:${record.result.decision}`);
}

// ── Replace audit_vectors in the main file ──────────────────────
data.audit_vectors = auditVectors;
fs.writeFileSync(vectorsPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`\nWrote ${auditVectors.length} audit vectors to ${vectorsPath}`);

// ── Self-verify ─────────────────────────────────────────────────
console.log('\nSelf-verification:');
const reloaded = JSON.parse(fs.readFileSync(vectorsPath, 'utf-8'));
let allOk = true;
for (const av of reloaded.audit_vectors) {
  const rec = JSON.parse(JSON.stringify(av.decision_object));
  delete rec.audit.hash;
  const c = canonicalize(rec);
  const h = crypto.createHash('sha256').update(c).digest('hex');
  const hexOk = Buffer.from(c, 'utf-8').toString('hex') === av.canonical_bytes;
  const hashOk = h === av.expected_sha256;
  const auditOk = av.decision_object.audit.hash === `sha256:${h}`;
  const ok = hexOk && hashOk && auditOk;
  allOk = allOk && ok;
  console.log(`${av.id}: ${ok ? '✓' : '✗'} hex=${hexOk} hash=${hashOk} audit=${auditOk}`);
}

console.log(allOk ? '\nALL VERIFIED ✓' : '\nVERIFICATION FAILED ✗');
process.exit(allOk ? 0 : 1);
