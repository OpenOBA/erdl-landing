/**
 * generate-audit-vectors.cjs
 * 
 * 从现有的 23 条决策向量中选取代表性向量，
 * 构造完整 Decision Object → JCS 规范化 → SHA-256，
 * 生成 audit hash 验证向量。
 * 
 * 用法: node generate-audit-vectors.cjs
 * 输出: audit-vectors-generated.json（供人工审核后合并到 vectors 文件）
 */

const { canonicalize } = require('json-canonicalize');
const crypto = require('crypto');

// ── UUID v7 生成器（兼容实现） ──────────────────────────────────
function uuidv7() {
  const bytes = crypto.randomBytes(16);
  const timestamp = BigInt(Date.now());
  
  // timestamp 48 bits (big-endian)
  bytes[0] = Number((timestamp >> 40n) & 0xFFn);
  bytes[1] = Number((timestamp >> 32n) & 0xFFn);
  bytes[2] = Number((timestamp >> 24n) & 0xFFn);
  bytes[3] = Number((timestamp >> 16n) & 0xFFn);
  bytes[4] = Number((timestamp >> 8n) & 0xFFn);
  bytes[5] = Number(timestamp & 0xFFn);
  
  // version 7
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // variant 10xx
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// ── 固定的 deterministic IDs（便于跨实现验证） ──────────────────
const DETERMINISTIC_IDS = {
  'AV-001': '018c4a3e-0001-7000-8000-000000000001',
  'AV-002': '018c4a3e-0002-7000-8000-000000000002',
  'AV-003': '018c4a3e-0003-7000-8000-000000000003',
  'AV-004': '018c4a3e-0004-7000-8000-000000000004',
  'AV-005': '018c4a3e-0005-7000-8000-000000000005',
};

const FIXED_TIMESTAMP = '2026-07-13T03:30:00.000Z';

// ── 从 vectors 构造完整 Decision Object ────────────────────────
function buildDecisionObject(vectorId, decisionId, policies, context, expected) {
  const now = FIXED_TIMESTAMP;
  
  const record = {
    spec: 'decision-object-v1.0',
    decision_id: decisionId,
    timestamp: now,
    agent: {
      id: 'did:erdl:sha256:test-runner-v1',
      role: 'guardian',
      version: 'v1.0.0'
    },
    context: context,
    policies: policies.map(p => ({
      id: p.id,
      name: p.name,
      version: 1,
      hash: `sha256:${crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex')}`
    })),
    evaluation: {
      proposal_id: null,
      matched_rules: expected.matchedRules.map(r => ({
        rule_id: r.ruleId,
        decision: r.decision,
        ...(r.reason ? { reason: r.reason } : {}),
        ...(r.instruction ? { instruction: r.instruction } : {}),
        ...(r.correction ? { correction: r.correction } : {}),
        ...(r.ring !== undefined ? { ring: r.ring } : {})
      })),
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
      // hash will be computed after JCS canonicalization
      hash: 'PLACEHOLDER',
      previous_hash: null,
      commitment: `${now}|did:erdl:sha256:test-runner-v1|${context['tool.name'] || 'unknown'}|${expected.decision}`
    }
  };

  return record;
}

function severityForDecision(decision) {
  const map = {
    'PASS': 'none',
    'ALLOW': 'none',
    'CORRECT': 'medium',
    'REQUEST_HUMAN': 'medium',
    'ESCALATE': 'medium',
    'NOTIFY': 'low',
    'DENY': 'high',
    'ROLLBACK': 'high',
    'QUARANTINE': 'critical',
    'EMERGENCY_HALT': 'critical'
  };
  return map[decision] || 'none';
}

function actionForDecision(decision) {
  const map = {
    'PASS': 'allowed',
    'ALLOW': 'allowed',
    'CORRECT': 'corrected',
    'REQUEST_HUMAN': 'paused',
    'ESCALATE': 'escalated',
    'NOTIFY': 'allowed',
    'DENY': 'blocked',
    'ROLLBACK': 'rolled_back',
    'QUARANTINE': 'quarantined',
    'EMERGENCY_HALT': 'halted'
  };
  return map[decision] || 'blocked';
}

// ── JCS canonicalize + SHA-256 ──────────────────────────────────
function computeAuditHash(record) {
  // 深拷贝，移除 audit.hash
  const forHash = JSON.parse(JSON.stringify(record));
  delete forHash.audit.hash;
  
  // JCS Canonicalization Scheme (RFC 8785)
  const canonical = canonicalize(forHash);
  
  // SHA-256
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  
  return {
    canonical_bytes_hex: Buffer.from(canonical, 'utf-8').toString('hex'),
    canonical_utf8: canonical,
    sha256: hash
  };
}

// ── 选取的代表性向量 ────────────────────────────────────────────
// 覆盖 5 种决策类型 + 不同的 Ring 级别

const SELECTED_VECTORS = [
  {
    vectorRef: 'DO-001',        // DENY — security baseline (Ring 0)
    auditId: 'AV-001',
    note: 'Security DENY: financial exec blocked by Ring 0 guardian. Tests canonical serialization of a DENY decision with one matched rule.'
  },
  {
    vectorRef: 'DO-003',        // REQUEST_HUMAN — compliance workflow (Ring 1)
    auditId: 'AV-002',
    note: 'Compliance REQUEST_HUMAN: PHI access triggers mandatory human review. Tests Ring 1 compliance decision with PHI context.'
  },
  {
    vectorRef: 'DO-010',        // ALLOW (override) — two rules, Ring 0 + Ring 3
    auditId: 'AV-003',
    note: 'Override ALLOW: Ring 0 DENY overridden by Ring 3 ALLOW with explicit override flag. Tests multi-rule matched_rules array + instruction field.'
  },
  {
    vectorRef: 'DO-013',        // EMERGENCY_HALT — Ring 0 short-circuit
    auditId: 'AV-004',
    note: 'Ring 0 EMERGENCY_HALT: critical anomaly triggers immediate halt — short-circuits all remaining evaluation. Tests critical severity + halt action_taken.'
  },
  {
    vectorRef: 'DO-022',        // ESCALATE — multi-agent trust (Ring 1)
    auditId: 'AV-005',
    note: 'Multi-agent trust ESCALATE: low-reputation agent operating in high-risk context. Tests ESCALATE decision with reputation context + escalated action_taken.'
  }
];

// ── 加载原始向量 ────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const vectorsPath = path.join(__dirname, 'decision-object-vectors-v1.0.json');
const vectorsData = JSON.parse(fs.readFileSync(vectorsPath, 'utf-8'));

const vectorMap = {};
for (const v of vectorsData.vectors) {
  vectorMap[v.id] = v;
}

// ── 生成 audit vectors ──────────────────────────────────────────
const auditVectors = [];

for (const sel of SELECTED_VECTORS) {
  const src = vectorMap[sel.vectorRef];
  if (!src) {
    console.error(`Vector ${sel.vectorRef} not found!`);
    process.exit(1);
  }

  const decisionId = DETERMINISTIC_IDS[sel.auditId];
  const record = buildDecisionObject(sel.auditId, decisionId, src.rules, src.context, src.expected);
  const { canonical_bytes_hex, canonical_utf8, sha256 } = computeAuditHash(record);
  
  // 填充真实 hash
  record.audit.hash = `sha256:${sha256}`;

  auditVectors.push({
    id: sel.auditId,
    vector_ref: sel.vectorRef,
    category: 'audit-hash',
    spec_version: 'decision-object-v1.0',
    note: sel.note,
    description: src.scenario,
    canonicalization: 'JCS (RFC 8785)',
    hash_algorithm: 'SHA-256',
    
    canonical_bytes: canonical_bytes_hex,
    canonical_utf8_preview: canonical_utf8.slice(0, 200) + (canonical_utf8.length > 200 ? '...' : ''),
    expected_sha256: sha256,
    
    // 完整 Decision Object（含正确的 audit.hash）
    decision_object: record,
    
    // 引用原始决策向量
    source_vector: {
      id: src.id,
      category: src.category,
      decision: src.expected.decision
    }
  });

  console.log(`${sel.auditId} (← ${sel.vectorRef}): sha256:${sha256}`);
  console.log(`  canonical bytes: ${canonical_bytes_hex.slice(0, 64)}...`);
  console.log(`  decision: ${record.result.decision}, severity: ${record.result.severity}`);
  console.log('');
}

// ── 写输出文件 ──────────────────────────────────────────────────
const output = {
  description: 'Audit hash verification vectors for ERDL Decision Object v1.0. These vectors test JCS (RFC 8785) canonicalization + SHA-256 hash consistency. Any compliant ERDL implementation MUST reproduce these hashes byte-for-byte when given the same decision_object input.',
  generated: new Date().toISOString(),
  generator: 'generate-audit-vectors.cjs',
  audit_vectors: auditVectors
};

const outputPath = path.join(__dirname, 'audit-vectors-generated.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
console.log(`Wrote ${auditVectors.length} audit vectors to ${outputPath}`);
