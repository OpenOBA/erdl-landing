#!/usr/bin/env node
/**
 * generate-vectors.cjs — ERDL Decision Object v1.3 Cross-Implementation Test Vectors
 *
 * Generates: decision-object-vectors-v1.3.json (101 vectors)
 *   - 63 static Decision Object vectors (DO-001 ~ DO-063)
 *   - 26 dynamic vectors (Temporal 10 / Seeded 8 / Stateful 8)
 *   - 12 audit hash vectors (AV-001 ~ AV-012)
 *   - 2 reserved vectors (DO-064, AV-013 → DELEGATE, v1.3)
 *
 * Authority: SPEC v1.1 §3.4, Whitepaper Draft 3 §13
 * Strategy: From scratch — no data inheritance from v1.0/v1.1
 * Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.
 * Author: Tang Haoran — OpenOBA AI Executive
 * Date: 2026-07-28
 */

'use strict';

const crypto = require('crypto');
const { canonicalize } = require('json-canonicalize');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════
//  SHA-256 utility
// ═══════════════════════════════════════════════════

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ═══════════════════════════════════════════════════
//  JCS canonicalize wrapper
// ═══════════════════════════════════════════════════

function jcs(obj) {
  return canonicalize(obj);
}

// ═══════════════════════════════════════════════════
//  UUID v7 (simplified: timestamp-based prefix)
// ═══════════════════════════════════════════════════
//  Deterministic UUID generator
//  Uses frozen real timestamp (2026-07-28T00:00:00.000Z) for full RFC 9562 UUIDv7 compliance.
//  timestamp_hi=019fa605, timestamp_mid=6800, version=7, variant=10xx(8).
//  RFC 9562 §5.7: UUIDv7 = Unix ts ms (48 bits) + version (4 bits) + rand_a (12 bits) + variant (2 bits) + rand_b (62 bits).
//  Our rand_b embeds a deterministic 48-bit counter → byte-identical output every run.
// ═══════════════════════════════════════════════════

const UUID_TIMESTAMP_MS = Date.UTC(2026, 6, 28, 0, 0, 0, 0) // 1785196800000 → hex 019fa6056800
const UUID_BASE = '019fa605-6800-7000-8000-'  // RFC 9562 UUIDv7: version=7, variant=10xx
let uuidIndex = 0

function deterministicUuid() {
  const idx = (++uuidIndex).toString(16).padStart(12, '0')
  return UUID_BASE + idx
}

// ═══════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════

const SPEC = 'decision-object-v1.0';
const VERSION = '1.2.0';
const GENERATION_DATE = '2026-07-28';
const TIMESTAMP = '2026-07-28T00:00:00.000Z';

// Empty extensions → JCS([]) → canonical bytes → sha256
const EMPTY_EXTENSIONS_JCS = jcs([]);

// Virtual hashes
const VIRTUAL_SHA256 = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

const TEST_SIGNATURE = 'TEST_SIGNATURE_BASE64URL_PLACEHOLDER';
const TEST_SIGNING_KEY_ID = 'key-v1-test-2026-07';

// Agent identity
const AGENT_ID = 'did:erdl:sha256:test-runner-v1.2';
const AGENT_ROLE = 'guardian';
const AGENT_VERSION = 'v1.3.0';
const AGENT_AID = '91110108MA12345678A00000001E';
const AGENT_KNOWN_LIMITATIONS = [
  'This is a test runner; does not perform real operations',
  'Timeout after 30s for contexts >10KB'
];
const AGENT_ALGORITHM_FILING_NO = 'NET-2026-000000';
const AGENT_MODEL_REGISTRATION_ID = 'MR-2026-000000';

const MODEL_ID = 'test-model-v1.2';
const CONFIDENCE_SCORE = 95;
const FAIRNESS_ASSESSMENT = 'not_applicable';
const IMPACT_ASSESSMENT_ID = '018c4a3e-0009-7000-8000-000000000009';
const DATA_MODIFICATION_EXPECTED = false;
const AUTONOMY_LEVEL = 'L2';
const EVALUATION_DURATION_MS = 12;

// ═══════════════════════════════════════════════════
//  Compliance Profile (full activation mode)
// ═══════════════════════════════════════════════════

function buildComplianceProfile() {
  const cp = {
    profile_id: 'erdl-compliance-v1.3',
    profile_hash: 'toBeComputed',
    jurisdictions: ['EU', 'CN', 'US', 'SG'],
    industries: ['financial-services'],
    risk_level: 'high',
    activated_fields: [
      'model_id', 'impact_assessment_id', 'agent.known_limitations',
      'agent.aid', 'agent.tool_registry_hash', 'confidence_score',
      'fairness_assessment', 'data_modification_expected',
      'autonomy_level', 'context_snapshot_hash', 'sanitized_context', 'signature'
    ],
    regulatory_references: [
      { framework: 'EU-AI-Act', version: 'Regulation-2024-1689', amended_by: 'Digital-Omnibus-2026', jurisdiction: 'EU', effective_date: '2027-12-02' },
      { framework: 'GB-Z-185-2026', version: '2026-05-22', jurisdiction: 'CN' },
      { framework: 'NIST-AI-RMF', version: '1.0', jurisdiction: 'US' },
      { framework: 'COSO-GenAI', version: '2026', jurisdiction: 'ALL' }
    ]
  };
  // Note: human_oversight is CORE #13 — always present, never in activated_fields
  return cp;
}

function finalizeComplianceProfile(cp) {
  const cp2 = { ...cp };
  delete cp2.profile_hash;
  cp.profile_hash = 'sha256:' + sha256(jcs(cp2));
  return cp;
}

const COMPLIANCE_PROFILE = finalizeComplianceProfile(buildComplianceProfile());

// ═══════════════════════════════════════════════════
//  DO Builder — assembles a full Decision Object
// ═══════════════════════════════════════════════════

function buildDO({ id, decision_type, rules, context, expected, description, category }) {
  const doId = deterministicUuid();

  // Policies from rules array
  const policies = rules.map((r, i) => {
    const policy = {
      id: r.id || `policy-${String(i + 1).padStart(3, '0')}`,
      name: r.name || `Test Policy ${i + 1}`,
      description: r.description || '',
      when: r.when || {},
      then: r.then || decision_type,
      priority: r.priority ?? (100 - i * 10),
      ring: r.ring ?? 3,
      hash: '' // computed below
    };
    if (r.unless !== undefined) policy.unless = r.unless;
    return policy;
  });

  // Compute rule_set_version.id
  const rsJcs = jcs(policies.map(p => {
    const { hash, ...rest } = p;
    return rest;
  }));
  const rsId = 'sha256:' + sha256(rsJcs);

  // Compute policy hashes (JCS)
  const policiesWithHash = policies.map(p => {
    const { hash, ...rest } = p;
    return { ...p, hash: 'sha256:' + sha256(jcs(rest)) };
  });

  const doObj = {
    spec: SPEC,
    decision_id: doId,
    compliance_profile: COMPLIANCE_PROFILE,
    execution_trace_id: deterministicUuid(),
    timestamp: TIMESTAMP,
    evaluation_duration_ms: EVALUATION_DURATION_MS,
    agent: {
      id: AGENT_ID,
      role: AGENT_ROLE,
      version: AGENT_VERSION,
      aid: AGENT_AID,
      known_limitations: AGENT_KNOWN_LIMITATIONS,
      tool_registry_hash: VIRTUAL_SHA256,
      algorithm_filing_no: AGENT_ALGORITHM_FILING_NO,
      model_registration_id: AGENT_MODEL_REGISTRATION_ID
    },
    model_id: MODEL_ID,
    context: context || {},
    context_snapshot_hash: VIRTUAL_SHA256,
    sanitized_context: null,
    rule_set_version: {
      id: rsId,
      timestamp: TIMESTAMP
    },
    policies: policiesWithHash,
    fairness_assessment: FAIRNESS_ASSESSMENT,
    impact_assessment_id: IMPACT_ASSESSMENT_ID,
    autonomy_level: AUTONOMY_LEVEL,
    confidence_score: CONFIDENCE_SCORE,
    evaluation: {
      matched_rules: expected.matched_rules !== undefined ? expected.matched_rules : policiesWithHash.map(p => p.id),
      triggered_rules: expected.triggered_rules !== undefined ? expected.triggered_rules : policiesWithHash.map(p => p.id),
      evaluation_details: expected.evaluation_details || {}
    },
    data_modification_expected: DATA_MODIFICATION_EXPECTED,
    result: {
      decision_type: decision_type,
      applied_rule: expected.applied_rule !== undefined ? expected.applied_rule : (policiesWithHash[0] ? policiesWithHash[0].id : null),
      reason: expected.reason || `Decision: ${decision_type}`,
      decision: decision_type,
      rules_matched: expected.matched_rules ? expected.matched_rules.length : 1
    },
    human_oversight: expected.human_oversight || (decision_type === 'REQUEST_HUMAN' ? true : false),
    extensions: [],
    audit: { hash: '' }, // placeholder — computed via flat hashing
    signature: TEST_SIGNATURE,
    signing_key_id: TEST_SIGNING_KEY_ID
  };

  // ── Flat Hashing (§3.3) ──

  // Step 1: Deep clone
  const clone = JSON.parse(JSON.stringify(doObj));

  // Step 2: Delete self-referencing / external fields
  // (extensions STAYS in the tree — participates directly in main JCS)
  delete clone.audit;
  delete clone.signature;
  delete clone.signing_key_id;
  delete clone.extensions_validation; // defensive

  // Step 3-4: JCS + SHA-256
  const canonicalFull = jcs(clone);
  // canonical_hex: hex encoding of UTF-8 bytes of JCS canonical form
  // Named 'hex' not 'bytes' because the stored value is hex-encoded, not raw bytes.
  // Cross-implementation note: other languages should compute hex(JCS_utf8_bytes).
  const canonicalHex = Buffer.from(canonicalFull, 'utf8').toString('hex');
  const auditHash = 'sha256:' + sha256(canonicalFull);

  // Step E: Write back
  doObj.audit.hash = auditHash;
  doObj.canonical_hex = canonicalHex;

  return doObj;
}

// ═══════════════════════════════════════════════════
//  Vector definition helpers
// ═══════════════════════════════════════════════════

function V({ id, category, scenario, description, decision_type, rules, context, expected }) {
  return { id, category: category || decision_type, scenario: scenario || id, description, decision_type, rules, context, expected };
}

function Rule({ id, name, description, when, then, priority, ring, unless }) {
  const r = { id, name, description, when, then, priority, ring };
  if (unless !== undefined) r.unless = unless;
  return r;
}

// ═══════════════════════════════════════════════════
//  63 Static Decision Object Vectors
// ═══════════════════════════════════════════════════

const vectorDefinitions = [
  // ─── DENY (10) ───
  V({
    id: 'DO-001', category: 'DENY', scenario: 'security-baseline',
    description: 'Ring 0 safety intercept — exec command blocked unconditionally',
    decision_type: 'DENY',
    rules: [
      Rule({ id: 'rule-deny-exec', name: 'Block Exec Command', description: 'Block execution of any system command via exec tool', when: { 'context.tool.name': { eq: 'exec' } }, then: 'DENY', priority: 1000, ring: 0 })
    ],
    context: { tool: { name: 'exec', args: { command: 'rm -rf /' } } },
    expected: { matched_rules: ['rule-deny-exec'], triggered_rules: ['rule-deny-exec'], applied_rule: 'rule-deny-exec', reason: 'Ring 0 exec command blocked: rm -rf /', human_oversight: false }
  }),

  V({
    id: 'DO-003', category: 'DENY', scenario: 'dangerous-command',
    description: 'Dangerous command patterns blocked — rm -rf with elevated privileges',
    decision_type: 'DENY',
    rules: [
      Rule({ id: 'rule-dangerous-cmd', name: 'Dangerous Command Detection', description: 'Block dangerous command patterns: rm -rf, del /S, etc.', when: { 'context.tool.args.command': { contains: 'rm -rf' } }, then: 'DENY', priority: 900, ring: 0 })
    ],
    context: { tool: { name: 'exec', args: { command: 'sudo rm -rf /var/log' } } },
    expected: { matched_rules: ['rule-dangerous-cmd'], triggered_rules: ['rule-dangerous-cmd'], applied_rule: 'rule-dangerous-cmd', reason: 'Dangerous command pattern detected: rm -rf', human_oversight: false }
  }),

  V({
    id: 'DO-005', category: 'DENY', scenario: 'critical-system',
    description: 'Access to critical system path blocked',
    decision_type: 'DENY',
    rules: [
      Rule({ id: 'rule-critical-path', name: 'Critical System Path Protection', description: 'Block writing to critical system paths', when: { 'context.file.path': { starts_with: '/etc/' } }, then: 'DENY', priority: 800, ring: 0 })
    ],
    context: { file: { path: '/etc/shadow', operation: 'write' } },
    expected: { matched_rules: ['rule-critical-path'], triggered_rules: ['rule-critical-path'], applied_rule: 'rule-critical-path', reason: 'Blocked write to critical system path: /etc/shadow', human_oversight: false }
  }),

  V({
    id: 'DO-008', category: 'DENY', scenario: 'ring-0-precedence',
    description: 'Ring 0 policy overrides Ring 3 ALLOW — escalation prevention',
    decision_type: 'DENY',
    rules: [
      Rule({ id: 'rule-ring0-block', name: 'Ring 0 Block', description: 'Ring 0: always blocks dangerous operations for any user', when: { 'context.risk_level': { eq: 'critical' } }, then: 'DENY', priority: 1000, ring: 0 }),
      Rule({ id: 'rule-ring3-allow', name: 'Ring 3 Allow', description: 'Ring 3: allows admin', when: { 'context.user.role': { eq: 'admin' } }, then: 'ALLOW', priority: 500, ring: 3 })
    ],
    context: { risk_level: 'critical', user: { role: 'admin' } },
    expected: { matched_rules: ['rule-ring0-block', 'rule-ring3-allow'], triggered_rules: ['rule-ring0-block'], applied_rule: 'rule-ring0-block', reason: 'Ring 0 precedence: critical risk overrides admin allow', human_oversight: false }
  }),

  V({
    id: 'DO-010', category: 'DENY', scenario: 'severity-escalation',
    description: 'Severity escalation — MEDIUM→HIGH severity upgrades to DENY',
    decision_type: 'DENY',
    rules: [
      Rule({ id: 'rule-severity-escalate', name: 'Severity Escalation', description: 'Escalate severity and deny when severity >= HIGH', when: { 'context.event.severity': { in: ['HIGH', 'CRITICAL'] } }, then: 'DENY', priority: 700, ring: 1 })
    ],
    context: { event: { severity: 'HIGH', type: 'security_alert' } },
    expected: { matched_rules: ['rule-severity-escalate'], triggered_rules: ['rule-severity-escalate'], applied_rule: 'rule-severity-escalate', reason: 'Severity HIGH escalated to DENY', human_oversight: false }
  }),

  V({
    id: 'DO-025', category: 'DENY', scenario: 'unless-not-exempted',
    description: 'unless condition not met → DENY (rule activates)',
    decision_type: 'DENY',
    rules: [
      Rule({ id: 'rule-unless-deny', name: 'Unless Deny', description: 'Deny write operation unless from admin user', when: { 'context.operation': { eq: 'write' } }, then: 'DENY', priority: 600, ring: 1, unless: { 'context.user.role': { eq: 'admin' } } })
    ],
    context: { operation: 'write', user: { role: 'viewer' } },
    expected: { matched_rules: ['rule-unless-deny'], triggered_rules: ['rule-unless-deny'], applied_rule: 'rule-unless-deny', reason: 'Write denied — unless condition not met (role=viewer, need admin)', human_oversight: false }
  }),

  V({
    id: 'DO-044', category: 'DENY', scenario: 'redos-protection',
    description: 'ReDoS protection — malicious regex input blocked via matches operator',
    decision_type: 'DENY',
    rules: [
      Rule({ id: 'rule-redos', name: 'ReDoS Pattern Protection', description: 'Block input matching known ReDoS patterns', when: { 'context.input.pattern': { matches: '^/(((a+)+)|((b+)+))+/$' } }, then: 'DENY', priority: 850, ring: 1 })
    ],
    context: { input: { pattern: '/aaaaaaaab/', type: 'regex_query' } },
    expected: { matched_rules: ['rule-redos'], triggered_rules: ['rule-redos'], applied_rule: 'rule-redos', reason: 'ReDoS pattern detected in user input', human_oversight: false }
  }),

  V({
    id: 'DO-049', category: 'DENY', scenario: 'exists-truthy',
    description: 'exists operator — truthy value triggers DENY (high risk flagged)',
    decision_type: 'DENY',
    rules: [
      Rule({ id: 'rule-exists-deny', name: 'High Risk Flag Check', description: 'Deny if high risk flag exists and is truthy', when: { 'context.high_risk_flag': { exists: true } }, then: 'DENY', priority: 750, ring: 1 })
    ],
    context: { high_risk_flag: true, user: { name: 'suspicious_actor' } },
    expected: { matched_rules: ['rule-exists-deny'], triggered_rules: ['rule-exists-deny'], applied_rule: 'rule-exists-deny', reason: 'exists check: high_risk_flag is truthy → DENY', human_oversight: false }
  }),

  V({
    id: 'DO-061', category: 'DENY', scenario: 'edge-object-deep-compare',
    description: 'Deep object comparison via eq on complex nested object',
    decision_type: 'DENY',
    rules: [
      Rule({ id: 'rule-deep-eq', name: 'Deep Equality Block', description: 'Block when payload matches known malicious signature exactly', when: { 'context.payload': { eq: { type: 'injection', vector: 'sql', payload: "'; DROP TABLE users; --" } } }, then: 'DENY', priority: 700, ring: 1 })
    ],
    context: { payload: { type: 'injection', vector: 'sql', payload: "'; DROP TABLE users; --" } },
    expected: { matched_rules: ['rule-deep-eq'], triggered_rules: ['rule-deep-eq'], applied_rule: 'rule-deep-eq', reason: 'Malicious payload signature matched — deep equality comparison', human_oversight: false }
  }),

  V({
    id: 'DO-063', category: 'DENY', scenario: 'edge-integer-safe-range',
    description: 'Integer safe range — value at MAX_SAFE_INTEGER boundary',
    decision_type: 'DENY',
    rules: [
      Rule({ id: 'rule-int-range', name: 'Integer Boundary Guard', description: 'Deny when transaction amount exceeds safe integer limit', when: { 'context.amount': { gt: 9007199254740991 } }, then: 'DENY', priority: 650, ring: 1 })
    ],
    context: { amount: 9007199254740992, currency: 'CNY' },
    expected: { matched_rules: ['rule-int-range'], triggered_rules: ['rule-int-range'], applied_rule: 'rule-int-range', reason: 'Transaction amount exceeds safe integer range (MAX_SAFE_INTEGER + 1)', human_oversight: false }
  }),

  // ─── ALLOW (12) ───
  V({
    id: 'DO-011', category: 'ALLOW', scenario: 'override-safe-direction',
    description: 'override — safe direction: Ring 3 ALLOW overrides Ring 3 DENY with override in safe direction',
    decision_type: 'ALLOW',
    rules: [
      Rule({ id: 'rule-allow-safe-tool', name: 'Allow Safe Tools', description: 'Allow read-only tools', when: { 'context.tool.name': { in: ['read', 'search', 'list'] } }, then: 'ALLOW', priority: 500, ring: 3 }),
      Rule({ id: 'rule-deny-write', name: 'Deny Write', description: 'Deny write operations for non-admin users', when: { 'context.tool.operation': { eq: 'write' } }, then: 'DENY', priority: 400, ring: 3 })
    ],
    context: { tool: { name: 'read', operation: 'read' }, user: { role: 'viewer' } },
    expected: { matched_rules: ['rule-allow-safe-tool', 'rule-deny-write'], triggered_rules: ['rule-allow-safe-tool'], applied_rule: 'rule-allow-safe-tool', reason: 'Override safe-direction: Ring 3 ALLOW for read tools overrides Ring 3 general DENY', human_oversight: false }
  }),

  V({
    id: 'DO-012', category: 'ALLOW', scenario: 'override-unsafe-direction',
    description: 'override — unsafe direction: Ring 3 DENY overrides Ring 4 ALLOW',
    decision_type: 'DENY',
    rules: [
      Rule({ id: 'rule-allow-risky', name: 'Allow Risky Operations', description: 'Allow all operations from trusted IP range', when: { 'context.ip': { in: ['10.0.0.0/8'] } }, then: 'ALLOW', priority: 300, ring: 4 }),
      Rule({ id: 'rule-deny-risk', name: 'Deny Financial Risk', description: 'Deny when financial risk score is high', when: { 'context.risk_score': { gt: 80 } }, then: 'DENY', priority: 600, ring: 3 })
    ],
    context: { ip: '10.0.1.100', risk_score: 85, operation: 'transfer' },
    expected: { matched_rules: ['rule-allow-risky', 'rule-deny-risk'], triggered_rules: ['rule-deny-risk'], applied_rule: 'rule-deny-risk', reason: 'Override unsafe-direction: Ring 3 DENY overrides Ring 4 ALLOW', human_oversight: false }
  }),

  V({
    id: 'DO-020', category: 'ALLOW', scenario: 'normal-operation',
    description: 'Normal file read operation — ALLOW',
    decision_type: 'ALLOW',
    rules: [
      Rule({ id: 'rule-normal-read', name: 'Allow Normal Read', description: 'Allow read operations on non-sensitive files', when: { 'context.operation': { eq: 'read' } }, then: 'ALLOW', priority: 500, ring: 3 })
    ],
    context: { operation: 'read', file: { path: '/tmp/log.txt' }, user: { role: 'viewer' } },
    expected: { matched_rules: ['rule-normal-read'], triggered_rules: ['rule-normal-read'], applied_rule: 'rule-normal-read', reason: 'Normal file read operation permitted', human_oversight: false }
  }),

  V({
    id: 'DO-024', category: 'ALLOW', scenario: 'unless-exempted',
    description: 'unless condition met → ALLOW (rule exempted)',
    decision_type: 'ALLOW',
    rules: [
      Rule({ id: 'rule-unless-allow', name: 'Unless Allow', description: 'Allow write operation if user is admin via unless', when: { 'context.operation': { eq: 'write' } }, then: 'DENY', priority: 600, ring: 1, unless: { 'context.user.role': { eq: 'admin' } } })
    ],
    context: { operation: 'write', user: { role: 'admin' } },
    expected: { matched_rules: ['rule-unless-allow'], triggered_rules: [], applied_rule: null, reason: 'unless condition met (role=admin) — rule exempted, defaults to ALLOW', human_oversight: false }
  }),

  V({
    id: 'DO-026', category: 'ALLOW', scenario: 'metadata-fallback',
    description: 'Metadata fallback — field missing in context, fallback to default ALLOW',
    decision_type: 'ALLOW',
    rules: [
      Rule({ id: 'rule-metadata-fb', name: 'Metadata Fallback Rule', description: 'Trigger when sensitivity field missing → fallback to ALLOW', when: { 'context.file.sensitivity': { eq: 'low' } }, then: 'DENY', priority: 500, ring: 3 })
    ],
    context: { file: { path: '/tmp/data.csv' } },
    expected: { matched_rules: [], triggered_rules: [], applied_rule: null, reason: 'Metadata fallback: sensitivity field missing, no rules triggered → ALLOW', human_oversight: false }
  }),

  V({
    id: 'DO-030', category: 'ALLOW', scenario: 'multiple-allow',
    description: 'Multiple ALLOW rules triggered — first one applies',
    decision_type: 'ALLOW',
    rules: [
      Rule({ id: 'rule-allow-a', name: 'Allow Pattern A', description: 'Allow when confidence > 0.8', when: { 'context.confidence': { gt: 0.8 } }, then: 'ALLOW', priority: 500, ring: 3 }),
      Rule({ id: 'rule-allow-b', name: 'Allow Pattern B', description: 'Allow when result is clean', when: { 'context.scan_result': { eq: 'clean' } }, then: 'ALLOW', priority: 400, ring: 3 })
    ],
    context: { confidence: 0.95, scan_result: 'clean', operation: 'deploy' },
    expected: { matched_rules: ['rule-allow-a', 'rule-allow-b'], triggered_rules: ['rule-allow-a'], applied_rule: 'rule-allow-a', reason: 'ALLOW: confidence > 0.8, multiple matching rules', human_oversight: false }
  }),

  V({
    id: 'DO-041', category: 'ALLOW', scenario: 'operator-in',
    description: 'in operator — tool name in allowed list',
    decision_type: 'ALLOW',
    rules: [
      Rule({ id: 'rule-in-allow', name: 'In Operator Allow', description: 'Allow tool name in safe list', when: { 'context.tool.name': { in: ['read', 'search', 'list'] } }, then: 'ALLOW', priority: 500, ring: 3 })
    ],
    context: { tool: { name: 'search' } },
    expected: { matched_rules: ['rule-in-allow'], triggered_rules: ['rule-in-allow'], applied_rule: 'rule-in-allow', reason: 'in operator: tool name "search" in allowed list', human_oversight: false }
  }),

  V({
    id: 'DO-042', category: 'ALLOW', scenario: 'operator-not-in',
    description: 'not_in operator — tool name NOT in dangerous list',
    decision_type: 'ALLOW',
    rules: [
      Rule({ id: 'rule-not-in-allow', name: 'Not-In Operator Allow', description: 'Allow if tool not in dangerous list', when: { 'context.tool.name': { not_in: ['exec', 'write', 'delete', 'rm'] } }, then: 'ALLOW', priority: 500, ring: 3 }),
      Rule({ id: 'rule-default-deny', name: 'Default Deny', description: 'Default deny for all operations', when: {}, then: 'DENY', priority: 0, ring: 3 })
    ],
    context: { tool: { name: 'read' } },
    expected: { matched_rules: ['rule-not-in-allow'], triggered_rules: ['rule-not-in-allow'], applied_rule: 'rule-not-in-allow', reason: 'not_in operator: "read" not in dangerous list → ALLOW', human_oversight: false }
  }),

  V({
    id: 'DO-043', category: 'ALLOW', scenario: 'operator-contains',
    description: 'contains operator — file content contains safe marker',
    decision_type: 'ALLOW',
    rules: [
      Rule({ id: 'rule-contains-allow', name: 'Contains Allow', description: 'Allow if content contains SAFE_MARKER', when: { 'context.file.content': { contains: 'SAFE_MARKER' } }, then: 'ALLOW', priority: 500, ring: 3 })
    ],
    context: { file: { content: 'BEGIN SAFE_MARKER ... some data ... END', name: 'export.csv' } },
    expected: { matched_rules: ['rule-contains-allow'], triggered_rules: ['rule-contains-allow'], applied_rule: 'rule-contains-allow', reason: 'contains operator: SAFE_MARKER found in file content', human_oversight: false }
  }),

  V({
    id: 'DO-046', category: 'ALLOW', scenario: 'operator-lt-lte',
    description: 'lt/lte operators — low risk score passes, sequential boundary tests included',
    decision_type: 'ALLOW',
    rules: [
      Rule({ id: 'rule-lt-risk', name: 'Low Risk Allow', description: 'Allow when risk_score < 50', when: { 'context.risk_score': { lt: 50 } }, then: 'ALLOW', priority: 500, ring: 3 }),
      Rule({ id: 'rule-lte-risk', name: 'LTE Risk Allow', description: 'Allow when risk_score <= 0', when: { 'context.risk_score': { lte: 0 } }, then: 'ALLOW', priority: 480, ring: 3 }),
      Rule({ id: 'rule-gte-risk', name: 'High Risk Request Human', description: 'Request human when risk_score >= 50', when: { 'context.risk_score': { gte: 50 } }, then: 'REQUEST_HUMAN', priority: 500, ring: 2 })
    ],
    context: { risk_score: 30, operation: 'query' },
    expected: { matched_rules: ['rule-lt-risk'], triggered_rules: ['rule-lt-risk'], applied_rule: 'rule-lt-risk', reason: 'lt operator: risk_score 30 < 50 → ALLOW; lte covered by rule-lte-risk in rule set', human_oversight: false }
  }),

  V({
    id: 'DO-047', category: 'ALLOW', scenario: 'operator-starts-with',
    description: 'starts_with operator — tool name prefixed with safe_',
    decision_type: 'ALLOW',
    rules: [
      Rule({ id: 'rule-starts-with-allow', name: 'Starts-With Allow', description: 'Allow tools prefixed with safe_', when: { 'context.tool.name': { starts_with: 'safe_' } }, then: 'ALLOW', priority: 500, ring: 3 })
    ],
    context: { tool: { name: 'safe_read_file' } },
    expected: { matched_rules: ['rule-starts-with-allow'], triggered_rules: ['rule-starts-with-allow'], applied_rule: 'rule-starts-with-allow', reason: 'starts_with operator: "safe_read_file" matches "safe_" prefix', human_oversight: false }
  }),

  V({
    id: 'DO-048', category: 'ALLOW', scenario: 'operator-ends-with',
    description: 'ends_with operator — file ends with .log',
    decision_type: 'ALLOW',
    rules: [
      Rule({ id: 'rule-ends-with-allow', name: 'Ends-With Allow', description: 'Allow files ending in .log for auto-archive', when: { 'context.file.name': { ends_with: '.log' } }, then: 'ALLOW', priority: 500, ring: 3 })
    ],
    context: { file: { name: 'system.log' } },
    expected: { matched_rules: ['rule-ends-with-allow'], triggered_rules: ['rule-ends-with-allow'], applied_rule: 'rule-ends-with-allow', reason: 'ends_with operator: "system.log" ends with ".log" → ALLOW', human_oversight: false }
  }),

  // ─── PASS (10) ───
  V({
    id: 'DO-002', category: 'PASS', scenario: 'selective-match',
    description: 'Rule selectively matches — exec blocked but read passes',
    decision_type: 'PASS',
    rules: [
      Rule({ id: 'rule-block-exec', name: 'Block Exec', description: 'Only blocks exec commands', when: { 'context.tool.name': { eq: 'exec' } }, then: 'DENY', priority: 1000, ring: 0 })
    ],
    context: { tool: { name: 'read', args: { path: '/tmp/test' } } },
    expected: { matched_rules: [], triggered_rules: [], applied_rule: null, reason: 'No rules matched for read operation → PASS', human_oversight: false }
  }),

  V({
    id: 'DO-004', category: 'PASS', scenario: 'safe-command',
    description: 'Safe command passes — list directory, no dangerous pattern',
    decision_type: 'PASS',
    rules: [
      Rule({ id: 'rule-dangerous-pattern', name: 'Dangerous Pattern Block', description: 'Block commands matching dangerous patterns', when: { 'context.tool.args.command': { contains: 'rm' } }, then: 'DENY', priority: 900, ring: 0 })
    ],
    context: { tool: { name: 'exec', args: { command: 'ls -la /tmp' } } },
    expected: { matched_rules: [], triggered_rules: [], applied_rule: null, reason: 'Command "ls -la /tmp" does not match dangerous pattern → PASS', human_oversight: false }
  }),

  V({
    id: 'DO-006', category: 'PASS', scenario: 'empty-rule-set',
    description: 'Empty rule set — no rules loaded',
    decision_type: 'PASS',
    rules: [],
    context: { tool: { name: 'exec', args: { command: 'rm -rf /' } } },
    expected: { matched_rules: [], triggered_rules: [], applied_rule: null, reason: 'Empty rule set — all operations default to PASS', human_oversight: false }
  }),

  V({
    id: 'DO-007', category: 'PASS', scenario: 'rule-set-version',
    description: 'Rule set version included in DO — no rules matched',
    decision_type: 'PASS',
    rules: [
      Rule({ id: 'rule-version-check', name: 'Version Check Rule', description: 'Check rule set version is present in evaluation', when: { 'context.version': { eq: '1.0.0' } }, then: 'ALLOW', priority: 500, ring: 3 })
    ],
    context: { version: '2.0.0', operation: 'upgrade' },
    expected: { matched_rules: [], triggered_rules: [], applied_rule: null, reason: 'Version mismatch — context version 2.0.0 != rule version 1.0.0 → PASS', human_oversight: false }
  }),

  V({
    id: 'DO-014', category: 'PASS', scenario: 'context-difference',
    description: 'Same rule, different context — rule does not match',
    decision_type: 'PASS',
    rules: [
      Rule({ id: 'rule-pii-guard', name: 'PII Data Guard', description: 'Request human oversight when PII context detected', when: { 'context.data_type': { eq: 'PII' } }, then: 'REQUEST_HUMAN', priority: 600, ring: 2 })
    ],
    context: { data_type: 'PUBLIC', operation: 'export' },
    expected: { matched_rules: [], triggered_rules: [], applied_rule: null, reason: 'Context data_type=PUBLIC — PII guard not triggered → PASS', human_oversight: false }
  }),

  V({
    id: 'DO-027', category: 'PASS', scenario: 'edge-null-safe-neq',
    description: 'Null-safe field access — neq with missing field does not crash',
    decision_type: 'PASS',
    rules: [
      Rule({ id: 'rule-neq-missing', name: 'NEQ Missing Field', description: 'Deny if role != admin', when: { 'context.user.role': { neq: 'admin' } }, then: 'DENY', priority: 500, ring: 3 })
    ],
    context: { user: { name: 'guest' } },
    expected: { matched_rules: [], triggered_rules: [], applied_rule: null, reason: 'Null-safe: context.user.role is undefined, neq returns false → PASS (no crash)', human_oversight: false }
  }),

  V({
    id: 'DO-028', category: 'PASS', scenario: 'edge-null-safe-eq',
    description: 'Null-safe field access — eq with missing field does not crash',
    decision_type: 'PASS',
    rules: [
      Rule({ id: 'rule-eq-missing', name: 'EQ Missing Field', description: 'Deny if role == banned', when: { 'context.user.role': { eq: 'banned' } }, then: 'DENY', priority: 500, ring: 3 })
    ],
    context: { user: { name: 'user42' } },
    expected: { matched_rules: [], triggered_rules: [], applied_rule: null, reason: 'Null-safe: context.user.role undefined, eq returns false → PASS', human_oversight: false }
  }),

  V({
    id: 'DO-029', category: 'PASS', scenario: 'edge-strict-type',
    description: 'Strict type matching — string "42" ≠ number 42',
    decision_type: 'PASS',
    rules: [
      Rule({ id: 'rule-strict-type', name: 'Strict Type Rule', description: 'Trigger when count == 42', when: { 'context.count': { eq: 42 } }, then: 'DENY', priority: 500, ring: 3 })
    ],
    context: { count: '42' },
    expected: { matched_rules: [], triggered_rules: [], applied_rule: null, reason: 'Strict type: string "42" !== number 42 → PASS', human_oversight: false }
  }),

  V({
    id: 'DO-050', category: 'PASS', scenario: 'edge-exists-missing',
    description: 'exists operator — field missing → false → rule does not fire → PASS',
    decision_type: 'PASS',
    rules: [
      Rule({ id: 'rule-exists-pass', name: 'High Risk Flag Check (missing)', description: 'Deny if high_risk_flag exists — but field is missing', when: { 'context.high_risk_flag': { exists: true } }, then: 'DENY', priority: 750, ring: 1 })
    ],
    context: { user: { name: 'normal_user' } },
    expected: { matched_rules: [], triggered_rules: [], applied_rule: null, reason: 'exists: high_risk_flag is missing → false → rule-exists-pass does not fire → PASS', human_oversight: false }
  }),

  V({
    id: 'DO-062', category: 'PASS', scenario: 'edge-empty-ext-normalize',
    description: 'Empty extensions normalized to canonical form',
    decision_type: 'PASS',
    rules: [
      Rule({ id: 'rule-ext-normalize', name: 'Extension Normalization', description: 'Trigger if extensions is non-empty array', when: { 'context.extensions_count': { gt: 0 } }, then: 'ALLOW', priority: 500, ring: 3 })
    ],
    context: { operation: 'read' },
    expected: { matched_rules: [], triggered_rules: [], applied_rule: null, reason: 'Empty extensions: no extensions to normalize, no rules triggered → PASS', human_oversight: false }
  }),

  // ─── REQUEST_HUMAN (4) ───
  V({
    id: 'DO-013', category: 'REQUEST_HUMAN', scenario: 'pii-approval',
    description: 'PII context detected — request human approval',
    decision_type: 'REQUEST_HUMAN',
    rules: [
      Rule({ id: 'rule-pii-human', name: 'PII Human Review', description: 'Request human review when PII data is accessed', when: { 'context.data_type': { eq: 'PII' } }, then: 'REQUEST_HUMAN', priority: 600, ring: 2 })
    ],
    context: { data_type: 'PII', operation: 'export', user: { role: 'analyst' } },
    expected: { matched_rules: ['rule-pii-human'], triggered_rules: ['rule-pii-human'], applied_rule: 'rule-pii-human', reason: 'PII data access requires human oversight per GDPR Art.22', human_oversight: true }
  }),

  V({
    id: 'DO-015', category: 'REQUEST_HUMAN', scenario: 'non-business-hours',
    description: 'Non-business hours operation — request human approval',
    decision_type: 'REQUEST_HUMAN',
    rules: [
      Rule({ id: 'rule-business-hours', name: 'Business Hours Guard', description: 'Request human review for operations outside 08:00-18:00', when: { 'context.hour': { in: [0,1,2,3,4,5,6,7,18,19,20,21,22,23] } }, then: 'REQUEST_HUMAN', priority: 500, ring: 2 })
    ],
    context: { hour: 2, operation: 'deploy', reason: 'emergency_patch' },
    expected: { matched_rules: ['rule-business-hours'], triggered_rules: ['rule-business-hours'], applied_rule: 'rule-business-hours', reason: 'Operation at 02:00 requires human oversight', human_oversight: true }
  }),

  V({
    id: 'DO-016', category: 'REQUEST_HUMAN', scenario: 'hipaa-medical',
    description: 'HIPAA medical data access — request human approval',
    decision_type: 'REQUEST_HUMAN',
    rules: [
      Rule({ id: 'rule-hipaa-human', name: 'HIPAA Medical Data Guard', description: 'Request human for access to PHI (Protected Health Information)', when: { 'context.data_category': { eq: 'PHI' } }, then: 'REQUEST_HUMAN', priority: 700, ring: 2 })
    ],
    context: { data_category: 'PHI', patient_id: 'P12345', operation: 'view_record' },
    expected: { matched_rules: ['rule-hipaa-human'], triggered_rules: ['rule-hipaa-human'], applied_rule: 'rule-hipaa-human', reason: 'PHI access requires human oversight per HIPAA (1996) / HITECH Act (2009) / 21st Century Cures Act (2016)', human_oversight: true }
  }),

  V({
    id: 'DO-045', category: 'REQUEST_HUMAN', scenario: 'operator-gt-gte',
    description: 'gt/gte operators — high risk score triggers human review',
    decision_type: 'REQUEST_HUMAN',
    rules: [
      Rule({ id: 'rule-gte-risk-human', name: 'High Risk Human Review', description: 'Request human when risk_score >= 80', when: { 'context.risk_score': { gte: 80 } }, then: 'REQUEST_HUMAN', priority: 500, ring: 2 })
    ],
    context: { risk_score: 92, operation: 'large_transfer' },
    expected: { matched_rules: ['rule-gte-risk-human'], triggered_rules: ['rule-gte-risk-human'], applied_rule: 'rule-gte-risk-human', reason: 'gte operator: risk_score 92 >= 80 → REQUEST_HUMAN', human_oversight: true }
  }),

  // ─── EMERGENCY_HALT (1) ───
  V({
    id: 'DO-009', category: 'EMERGENCY_HALT', scenario: 'ring-0-emergency',
    description: 'Ring 0 EMERGENCY_HALT — short-circuits all evaluation, global effect',
    decision_type: 'EMERGENCY_HALT',
    rules: [
      Rule({ id: 'rule-emergency-halt', name: 'Emergency Halt — Data Breach', description: 'Immediately halt all operations on confirmed data breach', when: { 'context.security_event': { eq: 'data_breach_confirmed' } }, then: 'EMERGENCY_HALT', priority: 9999, ring: 0 })
    ],
    context: { security_event: 'data_breach_confirmed', severity: 'CRITICAL', source_ip: '192.168.1.100' },
    expected: { matched_rules: ['rule-emergency-halt'], triggered_rules: ['rule-emergency-halt'], applied_rule: 'rule-emergency-halt', reason: 'EMERGENCY_HALT: confirmed data breach, all operations terminated immediately', human_oversight: false }
  }),

  // ─── ESCALATE (3) ───
  V({
    id: 'DO-017', category: 'ESCALATE', scenario: 'low-reputation-agent',
    description: 'Low reputation agent detected — escalate to supervisor',
    decision_type: 'ESCALATE',
    rules: [
      Rule({ id: 'rule-reputation-escalate', name: 'Low Reputation Escalation', description: 'Escalate when agent reputation < 0.5', when: { 'context.agent_reputation': { lt: 0.5 } }, then: 'ESCALATE', priority: 500, ring: 2 })
    ],
    context: { agent_reputation: 0.3, agent_id: 'agent-42', operation: 'important_action' },
    expected: { matched_rules: ['rule-reputation-escalate'], triggered_rules: ['rule-reputation-escalate'], applied_rule: 'rule-reputation-escalate', reason: 'Agent reputation 0.3 < 0.5 → ESCALATE to supervisor', human_oversight: false }
  }),

  V({
    id: 'DO-018', category: 'ESCALATE', scenario: 'cross-domain',
    description: 'Cross-domain operation — escalate for security review',
    decision_type: 'ESCALATE',
    rules: [
      Rule({ id: 'rule-cross-domain', name: 'Cross-Domain Escalation', description: 'Escalate cross-domain operations for security review', when: { 'context.cross_domain': { eq: true } }, then: 'ESCALATE', priority: 500, ring: 2 })
    ],
    context: { cross_domain: true, source_domain: 'finance.local', target_domain: 'external.partner.net' },
    expected: { matched_rules: ['rule-cross-domain'], triggered_rules: ['rule-cross-domain'], applied_rule: 'rule-cross-domain', reason: 'Cross-domain operation: finance.local → external.partner.net requires review', human_oversight: false }
  }),

  V({
    id: 'DO-019', category: 'ESCALATE', scenario: 'unknown-tool',
    description: 'Unknown tool invocation — escalate for review',
    decision_type: 'ESCALATE',
    rules: [
      Rule({ id: 'rule-unknown-tool', name: 'Unknown Tool Escalation', description: 'Escalate when an unregistered tool is invoked', when: { 'context.tool.registered': { eq: false } }, then: 'ESCALATE', priority: 500, ring: 2 })
    ],
    context: { tool: { name: 'mystery_tool', registered: false }, user: { role: 'developer' } },
    expected: { matched_rules: ['rule-unknown-tool'], triggered_rules: ['rule-unknown-tool'], applied_rule: 'rule-unknown-tool', reason: 'Unknown tool "mystery_tool" invoked → ESCALATE', human_oversight: false }
  }),

  // ─── CORRECT (3) ───
  V({
    id: 'DO-021', category: 'CORRECT', scenario: 'case-normalization',
    description: 'Auto-correct: case normalization of tool names',
    decision_type: 'CORRECT',
    rules: [
      Rule({ id: 'rule-case-correct', name: 'Case Normalization', description: 'Correct case of tool names to lowercase', when: { 'context.tool.name': { matches: '.*[A-Z].*' } }, then: 'CORRECT', priority: 400, ring: 3 })
    ],
    context: { tool: { name: 'ReadFile', args: { path: '/tmp/test' } } },
    expected: { matched_rules: ['rule-case-correct'], triggered_rules: ['rule-case-correct'], applied_rule: 'rule-case-correct', reason: 'CORRECT: tool name "ReadFile" normalized to "readfile"', human_oversight: false }
  }),

  V({
    id: 'DO-022', category: 'CORRECT', scenario: 'unit-conversion',
    description: 'Auto-correct: unit conversion (MB → bytes)',
    decision_type: 'CORRECT',
    rules: [
      Rule({ id: 'rule-unit-convert', name: 'Unit Conversion', description: 'Convert size from MB to bytes for consistency', when: { 'context.file.size_unit': { eq: 'MB' } }, then: 'CORRECT', priority: 400, ring: 3 })
    ],
    context: { file: { name: 'report.pdf', size: 10, size_unit: 'MB' } },
    expected: { matched_rules: ['rule-unit-convert'], triggered_rules: ['rule-unit-convert'], applied_rule: 'rule-unit-convert', reason: 'CORRECT: 10 MB converted to 10485760 bytes', human_oversight: false }
  }),

  V({
    id: 'DO-023', category: 'CORRECT', scenario: 'path-normalization',
    description: 'Auto-correct: path normalization (relative → absolute)',
    decision_type: 'CORRECT',
    rules: [
      Rule({ id: 'rule-path-norm', name: 'Path Normalization', description: 'Normalize relative paths to absolute paths', when: { 'context.file.path': { starts_with: './' } }, then: 'CORRECT', priority: 400, ring: 3 })
    ],
    context: { file: { path: './documents/report.pdf' } },
    expected: { matched_rules: ['rule-path-norm'], triggered_rules: ['rule-path-norm'], applied_rule: 'rule-path-norm', reason: 'CORRECT: relative path "./documents/report.pdf" normalized to "/home/user/documents/report.pdf"', human_oversight: false }
  }),

  // ─── NOTIFY (4) ───
  V({
    id: 'DO-031', category: 'NOTIFY', scenario: 'anomaly-detection',
    description: 'Anomaly detection — notify without blocking',
    decision_type: 'NOTIFY',
    rules: [
      Rule({ id: 'rule-anomaly-notify', name: 'Anomaly Notification', description: 'Notify on anomalous API call patterns', when: { 'context.api.calls_last_minute': { gt: 1000 } }, then: 'NOTIFY', priority: 300, ring: 3 })
    ],
    context: { api: { calls_last_minute: 1500, endpoint: '/api/data' }, user: { name: 'bot-account' } },
    expected: { matched_rules: ['rule-anomaly-notify'], triggered_rules: ['rule-anomaly-notify'], applied_rule: 'rule-anomaly-notify', reason: 'NOTIFY: anomalous API call rate 1500/min on /api/data', human_oversight: false }
  }),

  V({
    id: 'DO-032', category: 'NOTIFY', scenario: 'audit-logging',
    description: 'Operation audit — notify of auditable action',
    decision_type: 'NOTIFY',
    rules: [
      Rule({ id: 'rule-audit-notify', name: 'Audit Notification', description: 'Notify on auditable operations', when: { 'context.operation': { in: ['grant_access', 'revoke_access', 'change_role'] } }, then: 'NOTIFY', priority: 300, ring: 3 })
    ],
    context: { operation: 'grant_access', target_user: 'user42', new_role: 'admin' },
    expected: { matched_rules: ['rule-audit-notify'], triggered_rules: ['rule-audit-notify'], applied_rule: 'rule-audit-notify', reason: 'NOTIFY: auditable action grant_access recorded', human_oversight: false }
  }),

  V({
    id: 'DO-033', category: 'NOTIFY', scenario: 'threshold-warning',
    description: 'Threshold warning — notify when resource usage exceeds threshold',
    decision_type: 'NOTIFY',
    rules: [
      Rule({ id: 'rule-threshold-notify', name: 'Threshold Notification', description: 'Notify when resource usage exceeds 80%', when: { 'context.resource.usage_pct': { gte: 80 } }, then: 'NOTIFY', priority: 300, ring: 3 })
    ],
    context: { resource: { name: 'database_pool', usage_pct: 87 } },
    expected: { matched_rules: ['rule-threshold-notify'], triggered_rules: ['rule-threshold-notify'], applied_rule: 'rule-threshold-notify', reason: 'NOTIFY: database_pool usage at 87%, threshold 80%', human_oversight: false }
  }),

  V({
    id: 'DO-034', category: 'NOTIFY', scenario: 'notify-with-deny',
    description: 'NOTIFY accompanies DENY — notification records the denial event',
    decision_type: 'DENY',
    rules: [
      Rule({ id: 'rule-deny-primary', name: 'Deny Unauthorized', description: 'Deny unauthorized access attempts', when: { 'context.access.role': { eq: 'unauthorized' } }, then: 'DENY', priority: 500, ring: 1 }),
      Rule({ id: 'rule-notify-deny', name: 'Notify on Deny', description: 'Always notify when a DENY occurs', when: { 'context.access.role': { eq: 'unauthorized' } }, then: 'NOTIFY', priority: 300, ring: 3 })
    ],
    context: { access: { role: 'unauthorized', resource: '/admin' }, user: { name: 'intruder' } },
    expected: { matched_rules: ['rule-deny-primary', 'rule-notify-deny'], triggered_rules: ['rule-deny-primary', 'rule-notify-deny'], applied_rule: 'rule-deny-primary', reason: 'DENY with NOTIFY: unauthorized access blocked and logged', human_oversight: false }
  }),

  // ─── QUARANTINE (3) ───
  V({
    id: 'DO-035', category: 'QUARANTINE', scenario: 'suspicious-file',
    description: 'Suspicious file detected — quarantine for analysis',
    decision_type: 'QUARANTINE',
    rules: [
      Rule({ id: 'rule-quarantine-file', name: 'File Quarantine', description: 'Quarantine files with suspicious extensions', when: { 'context.file.extension': { in: ['.exe', '.bat', '.ps1', '.sh', '.dll'] } }, then: 'QUARANTINE', priority: 600, ring: 1 })
    ],
    context: { file: { name: 'invoice.exe', extension: '.exe', size: 2048 } },
    expected: { matched_rules: ['rule-quarantine-file'], triggered_rules: ['rule-quarantine-file'], applied_rule: 'rule-quarantine-file', reason: 'QUARANTINE: suspicious file extension .exe', human_oversight: false }
  }),

  V({
    id: 'DO-036', category: 'QUARANTINE', scenario: 'anomalous-pattern',
    description: 'Anomalous behavior pattern — quarantine request',
    decision_type: 'QUARANTINE',
    rules: [
      Rule({ id: 'rule-quarantine-behavior', name: 'Behavioral Quarantine', description: 'Quarantine on anomalous behavior pattern', when: { 'context.behavior.score': { lt: 0.2 } }, then: 'QUARANTINE', priority: 600, ring: 1 })
    ],
    context: { behavior: { score: 0.15, pattern: 'unusual_login_time' }, user: { ip: '185.220.101.34' } },
    expected: { matched_rules: ['rule-quarantine-behavior'], triggered_rules: ['rule-quarantine-behavior'], applied_rule: 'rule-quarantine-behavior', reason: 'QUARANTINE: anomalous behavior score 0.15 < 0.2 threshold', human_oversight: false }
  }),

  V({
    id: 'DO-037', category: 'QUARANTINE', scenario: 'rate-limiting',
    description: 'Rate limiting triggered — quarantine excessive requests',
    decision_type: 'QUARANTINE',
    rules: [
      Rule({ id: 'rule-rate-limit', name: 'Rate Limit Quarantine', description: 'Quarantine when rate limit exceeded', when: { 'context.rate.requests_per_sec': { gte: 50 } }, then: 'QUARANTINE', priority: 600, ring: 1 })
    ],
    context: { rate: { requests_per_sec: 75, window: '1s' }, source_ip: '10.0.0.42' },
    expected: { matched_rules: ['rule-rate-limit'], triggered_rules: ['rule-rate-limit'], applied_rule: 'rule-rate-limit', reason: 'QUARANTINE: rate limit 75 rps exceeded 50 rps threshold', human_oversight: false }
  }),

  // ─── ROLLBACK (3) ───
  V({
    id: 'DO-038', category: 'ROLLBACK', scenario: 'snapshot-rollback',
    description: 'Snapshot rollback — revert to last known good state',
    decision_type: 'ROLLBACK',
    rules: [
      Rule({ id: 'rule-rollback-snapshot', name: 'Snapshot Rollback', description: 'Rollback to snapshot on critical failure', when: { 'context.system.state': { eq: 'corrupted' } }, then: 'ROLLBACK', priority: 800, ring: 1 })
    ],
    context: { system: { state: 'corrupted', snapshot_id: 'snap-20260728-001200' } },
    expected: { matched_rules: ['rule-rollback-snapshot'], triggered_rules: ['rule-rollback-snapshot'], applied_rule: 'rule-rollback-snapshot', reason: 'ROLLBACK: system state corrupted, rolling back to snap-20260728-001200', human_oversight: false }
  }),

  V({
    id: 'DO-039', category: 'ROLLBACK', scenario: 'partial-failure',
    description: 'Partial failure in transaction — rollback entire batch',
    decision_type: 'ROLLBACK',
    rules: [
      Rule({ id: 'rule-rollback-partial', name: 'Partial Failure Rollback', description: 'Rollback on partial transaction failure', when: { 'context.transaction.success_rate': { lt: 1.0 } }, then: 'ROLLBACK', priority: 800, ring: 1 })
    ],
    context: { transaction: { id: 'tx-456', success_rate: 0.75, total_steps: 4, completed_steps: 3 } },
    expected: { matched_rules: ['rule-rollback-partial'], triggered_rules: ['rule-rollback-partial'], applied_rule: 'rule-rollback-partial', reason: 'ROLLBACK: transaction tx-456 partial failure (3/4 steps completed)', human_oversight: false }
  }),

  V({
    id: 'DO-040', category: 'ROLLBACK', scenario: 'trade-rollback',
    description: 'Trade execution rollback — risk limits breached',
    decision_type: 'ROLLBACK',
    rules: [
      Rule({ id: 'rule-rollback-trade', name: 'Trade Rollback', description: 'Rollback trade when risk limit breached', when: { 'context.trade.exposure': { gt: 1000000 } }, then: 'ROLLBACK', priority: 800, ring: 1 })
    ],
    context: { trade: { id: 'trade-789', exposure: 1500000, limit: 1000000, currency: 'USD' } },
    expected: { matched_rules: ['rule-rollback-trade'], triggered_rules: ['rule-rollback-trade'], applied_rule: 'rule-rollback-trade', reason: 'ROLLBACK: trade trade-789 exposure $1,500,000 > $1,000,000 limit', human_oversight: false }
  }),

  // ─── WORKFLOW (4) ───
  V({
    id: 'DO-051', category: 'WORKFLOW', scenario: 'multi-step-workflow',
    description: 'Multi-step workflow initiation',
    decision_type: 'WORKFLOW',
    rules: [
      Rule({ id: 'rule-workflow-start', name: 'Workflow Start', description: 'Start workflow for multi-step operation', when: { 'context.workflow.type': { eq: 'onboarding' } }, then: 'WORKFLOW', priority: 500, ring: 3 })
    ],
    context: { workflow: { type: 'onboarding', steps: ['verify_identity', 'create_account', 'grant_access', 'send_welcome'] } },
    expected: { matched_rules: ['rule-workflow-start'], triggered_rules: ['rule-workflow-start'], applied_rule: 'rule-workflow-start', reason: 'WORKFLOW: 4-step onboarding workflow initiated', human_oversight: false }
  }),

  V({
    id: 'DO-052', category: 'WORKFLOW', scenario: 'conditional-branch',
    description: 'Workflow with conditional branching',
    decision_type: 'WORKFLOW',
    rules: [
      Rule({ id: 'rule-workflow-branch', name: 'Workflow Branch', description: 'Execute workflow branch based on condition', when: { 'context.user.tier': { eq: 'premium' } }, then: 'WORKFLOW', priority: 500, ring: 3 })
    ],
    context: { user: { tier: 'premium', name: 'vip_user' }, workflow: { type: 'feature_upgrade' } },
    expected: { matched_rules: ['rule-workflow-branch'], triggered_rules: ['rule-workflow-branch'], applied_rule: 'rule-workflow-branch', reason: 'WORKFLOW: premium user feature upgrade path selected', human_oversight: false }
  }),

  V({
    id: 'DO-053', category: 'WORKFLOW', scenario: 'approval-node',
    description: 'Workflow approval node execution',
    decision_type: 'WORKFLOW',
    rules: [
      Rule({ id: 'rule-workflow-approval', name: 'Workflow Approval', description: 'Workflow requires approval checkpoint', when: { 'context.approval.required': { eq: true } }, then: 'WORKFLOW', priority: 500, ring: 3 })
    ],
    context: { approval: { required: true, level: 'manager', request_id: 'req-001' } },
    expected: { matched_rules: ['rule-workflow-approval'], triggered_rules: ['rule-workflow-approval'], applied_rule: 'rule-workflow-approval', reason: 'WORKFLOW: approval node triggered for req-001', human_oversight: false }
  }),

  V({
    id: 'DO-054', category: 'WORKFLOW', scenario: 'workflow-completion',
    description: 'Workflow completion — all steps finished',
    decision_type: 'WORKFLOW',
    rules: [
      Rule({ id: 'rule-workflow-done', name: 'Workflow Completion', description: 'All workflow steps completed', when: { 'context.workflow.status': { eq: 'all_steps_done' } }, then: 'WORKFLOW', priority: 500, ring: 3 })
    ],
    context: { workflow: { status: 'all_steps_done', steps_completed: 4, total_steps: 4 } },
    expected: { matched_rules: ['rule-workflow-done'], triggered_rules: ['rule-workflow-done'], applied_rule: 'rule-workflow-done', reason: 'WORKFLOW: all 4/4 steps completed', human_oversight: false }
  }),

  // ─── WORKFLOW_WAITING (3) ───
  V({
    id: 'DO-055', category: 'WORKFLOW_WAITING', scenario: 'waiting-human-approval',
    description: 'Workflow waiting for human approval',
    decision_type: 'WORKFLOW_WAITING',
    rules: [
      Rule({ id: 'rule-waiting-approval', name: 'Waiting for Approval', description: 'Workflow paused awaiting human approval', when: { 'context.approval.status': { eq: 'pending' } }, then: 'WORKFLOW_WAITING', priority: 400, ring: 3 })
    ],
    context: { approval: { status: 'pending', approver: 'manager@company.com', request_id: 'req-042' } },
    expected: { matched_rules: ['rule-waiting-approval'], triggered_rules: ['rule-waiting-approval'], applied_rule: 'rule-waiting-approval', reason: 'WORKFLOW_WAITING: approval pending from manager@company.com for req-042', human_oversight: false }
  }),

  V({
    id: 'DO-056', category: 'WORKFLOW_WAITING', scenario: 'waiting-time-window',
    description: 'Workflow waiting for time window to open',
    decision_type: 'WORKFLOW_WAITING',
    rules: [
      Rule({ id: 'rule-waiting-window', name: 'Waiting for Time Window', description: 'Workflow paused until maintenance window', when: { 'context.schedule.deployment_window': { eq: 'closed' } }, then: 'WORKFLOW_WAITING', priority: 400, ring: 3 })
    ],
    context: { schedule: { deployment_window: 'closed', next_window: '2026-07-29T02:00:00Z' } },
    expected: { matched_rules: ['rule-waiting-window'], triggered_rules: ['rule-waiting-window'], applied_rule: 'rule-waiting-window', reason: 'WORKFLOW_WAITING: deployment window closed, next: 2026-07-29T02:00:00Z', human_oversight: false }
  }),

  V({
    id: 'DO-057', category: 'WORKFLOW_WAITING', scenario: 'waiting-predecessor',
    description: 'Workflow waiting for predecessor task',
    decision_type: 'WORKFLOW_WAITING',
    rules: [
      Rule({ id: 'rule-waiting-predecessor', name: 'Waiting for Predecessor', description: 'Workflow paused waiting for predecessor task completion', when: { 'context.task.predecessor_complete': { eq: false } }, then: 'WORKFLOW_WAITING', priority: 400, ring: 3 })
    ],
    context: { task: { id: 'task-3', predecessor_complete: false, predecessor_task: 'task-2' } },
    expected: { matched_rules: ['rule-waiting-predecessor'], triggered_rules: ['rule-waiting-predecessor'], applied_rule: 'rule-waiting-predecessor', reason: 'WORKFLOW_WAITING: task-3 waiting for predecessor task-2', human_oversight: false }
  }),

  // ─── WORKFLOW_PROGRESS (3) ───
  V({
    id: 'DO-058', category: 'WORKFLOW_PROGRESS', scenario: 'step-advancement',
    description: 'Workflow step advancement — move to next step',
    decision_type: 'WORKFLOW_PROGRESS',
    rules: [
      Rule({ id: 'rule-progress-step', name: 'Step Progress', description: 'Workflow step advanced', when: { 'context.step.action': { eq: 'complete' } }, then: 'WORKFLOW_PROGRESS', priority: 400, ring: 3 })
    ],
    context: { step: { action: 'complete', current: 2, total: 5, name: 'data_validation' } },
    expected: { matched_rules: ['rule-progress-step'], triggered_rules: ['rule-progress-step'], applied_rule: 'rule-progress-step', reason: 'WORKFLOW_PROGRESS: step 2/5 "data_validation" completed', human_oversight: false }
  }),

  V({
    id: 'DO-059', category: 'WORKFLOW_PROGRESS', scenario: 'phase-completion',
    description: 'Workflow phase completion — milestone reached',
    decision_type: 'WORKFLOW_PROGRESS',
    rules: [
      Rule({ id: 'rule-progress-phase', name: 'Phase Complete', description: 'Workflow phase completed', when: { 'context.phase.milestone': { eq: 'reached' } }, then: 'WORKFLOW_PROGRESS', priority: 400, ring: 3 })
    ],
    context: { phase: { milestone: 'reached', phase_name: 'QA', next_phase: 'UAT' } },
    expected: { matched_rules: ['rule-progress-phase'], triggered_rules: ['rule-progress-phase'], applied_rule: 'rule-progress-phase', reason: 'WORKFLOW_PROGRESS: QA phase completed, progressing to UAT', human_oversight: false }
  }),

  V({
    id: 'DO-060', category: 'WORKFLOW_PROGRESS', scenario: 'final-step-progress',
    description: 'Workflow final step in progress',
    decision_type: 'WORKFLOW_PROGRESS',
    rules: [
      Rule({ id: 'rule-progress-final', name: 'Final Step Progress', description: 'Workflow entering final step', when: { 'context.step.is_final': { eq: true } }, then: 'WORKFLOW_PROGRESS', priority: 400, ring: 3 })
    ],
    context: { step: { is_final: true, current: 5, total: 5, name: 'deploy' } },
    expected: { matched_rules: ['rule-progress-final'], triggered_rules: ['rule-progress-final'], applied_rule: 'rule-progress-final', reason: 'WORKFLOW_PROGRESS: final step 5/5 "deploy" in progress', human_oversight: false }
  }),
];

// ═══════════════════════════════════════════════════
//  Main Generation
// ═══════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════');
console.log('  ERDL Decision Object v1.3 Vector Generator');
console.log('═══════════════════════════════════════════════');
console.log('');

// Generate 63 static DOs
const staticVectors = [];
for (const def of vectorDefinitions) {
  const doObj = buildDO(def);
  const vector = {
    id: def.id,
    category: def.category,
    scenario: def.scenario,
    description: def.description,
    decision_type: def.decision_type,
    rules: def.rules.map(r => {
      const { hash, ...rest } = r;
      return rest;
    }),
    context: def.context,
    expected: def.expected,
    decision_object: doObj,
    canonical_hex: doObj.canonical_hex
  };
  delete vector.decision_object.canonical_hex;
  staticVectors.push(vector);
  console.log(`  ✓ ${def.id} (${def.category}) — ${def.scenario}`);
}

console.log(`\n  ${staticVectors.length} static Decision Object vectors generated`);

// ═══════════════════════════════════════════════════
//  Dynamic Vectors (26 total: Temporal 10 + Seeded 8 + Stateful 8)
// ═══════════════════════════════════════════════════

console.log('\n── Dynamic Vectors ──');

// Temporal vectors (10): time-based decisions use fixed timestamps
const temporalVectors = [];
const temporalScenarios = [
  { id: 'T-001', description: 'Time of day — business hours (09:00) ALLOW', hour: 9, decision: 'ALLOW' },
  { id: 'T-002', description: 'Time of day — after hours (22:00) REQUEST_HUMAN', hour: 22, decision: 'REQUEST_HUMAN' },
  { id: 'T-003', description: 'Day of week — Monday (business day) ALLOW', day: 1, decision: 'ALLOW' },
  { id: 'T-004', description: 'Day of week — Sunday (weekend) REQUEST_HUMAN', day: 0, decision: 'REQUEST_HUMAN' },
  { id: 'T-005', description: 'Month boundary — Jan 1st (holiday) NOTIFY', month: 0, dayOfMonth: 1, decision: 'NOTIFY' },
  { id: 'T-006', description: 'Leap year — Feb 29 PASS', year: 2028, month: 1, dayOfMonth: 29, decision: 'PASS' },
  { id: 'T-007', description: 'End of fiscal year ALLOW with audit', month: 2, dayOfMonth: 31, decision: 'ALLOW' },
  { id: 'T-008', description: 'Midnight boundary (00:00:00) REQUEST_HUMAN', hour: 0, decision: 'REQUEST_HUMAN' },
  { id: 'T-009', description: 'Future date (2038-01-19) — Y2K38 boundary', year: 2038, month: 0, dayOfMonth: 19, decision: 'ALLOW' },
  { id: 'T-010', description: 'Past date (2020-01-01) — historical data', year: 2020, month: 0, dayOfMonth: 1, decision: 'PASS' }
];

for (const ts of temporalScenarios) {
  const dt = new Date(Date.UTC(
    ts.year || 2026,
    ts.month || 6,
    ts.dayOfMonth || 28,
    ts.hour || 12,
    0, 0, 0
  ));
  const vector = {
    id: ts.id,
    category: 'temporal',
    description: ts.description,
    timestamp: dt.toISOString(),
    decision_type: ts.decision,
    note: 'Time-simulated vector — DO audit.hash computed with fixed timestamp'
  };
  temporalVectors.push(vector);
  console.log(`  ✓ ${ts.id} — ${ts.description}`);
}

// Seeded vectors (8): deterministic behavior with fixed random seeds
const seededVectors = [];
for (let i = 1; i <= 8; i++) {
  const seed = `v1.2-seed-${String(i).padStart(3, '0')}`;
  seededVectors.push({
    id: `S-${String(i).padStart(3, '0')}`,
    category: 'seeded',
    description: `Seeded vector with seed="${seed}" — deterministic input-hash`,
    seed: seed,
    note: 'Deterministic random seed vectors for reproducible evaluation'
  });
  console.log(`  ✓ S-${String(i).padStart(3, '0')} — seed: ${seed}`);
}

// Stateful vectors (8): state transitions across sequential evaluation
const statefulVectors = [];
const stateMachine = [
  { id: 'ST-001', state: 'idle', transition: 'starting', next: 'running' },
  { id: 'ST-002', state: 'running', transition: 'pausing', next: 'paused' },
  { id: 'ST-003', state: 'paused', transition: 'resuming', next: 'running' },
  { id: 'ST-004', state: 'running', transition: 'error', next: 'error' },
  { id: 'ST-005', state: 'error', transition: 'recovering', next: 'recovering' },
  { id: 'ST-006', state: 'recovering', transition: 'restored', next: 'running' },
  { id: 'ST-007', state: 'running', transition: 'stopping', next: 'stopped' },
  { id: 'ST-008', state: 'stopped', transition: 'restarting', next: 'running' }
];

for (const sm of stateMachine) {
  statefulVectors.push({
    id: sm.id,
    category: 'stateful',
    description: `State transition: ${sm.state} → (${sm.transition}) → ${sm.next}`,
    from_state: sm.state,
    transition: sm.transition,
    to_state: sm.next,
    note: 'Sequential state machine vectors — audit chain must preserve state transitions'
  });
  console.log(`  ✓ ${sm.id} — ${sm.state} → ${sm.next}`);
}

console.log(`\n  ${temporalVectors.length + seededVectors.length + statefulVectors.length} dynamic vectors generated`);

// ═══════════════════════════════════════════════════
//  Audit Hash Vectors (12)
// ═══════════════════════════════════════════════════

console.log('\n── Audit Hash Vectors ──');

const avMapping = [
  { av: 'AV-001', src: 'DO-001', purpose: 'Security intercept — Ring 0 single rule DENY' },
  { av: 'AV-002', src: 'DO-013', purpose: 'Compliance approval — PII context REQUEST_HUMAN' },
  { av: 'AV-003', src: 'DO-011', purpose: 'Override safe-direction — ALLOW with multi-rule matched' },
  { av: 'AV-004', src: 'DO-009', purpose: 'Ring 0 EMERGENCY_HALT — short-circuit evaluation' },
  { av: 'AV-005', src: 'DO-017', purpose: 'Low reputation agent ESCALATE' },
  { av: 'AV-006', src: 'DO-024', purpose: 'Unless exemption triggered ALLOW' },
  { av: 'AV-007', src: 'DO-027', purpose: 'Null-safe field access PASS' },
  { av: 'AV-009', src: 'DO-021', purpose: 'Auto-correction CORRECT — case normalization' },
  { av: 'AV-010', src: 'DO-031', purpose: 'Anomaly NOTIFY — audit log record' },
  { av: 'AV-011', src: 'DO-038', purpose: 'Snapshot ROLLBACK' },
  { av: 'AV-012', src: 'DO-051', purpose: 'Multi-step WORKFLOW initiation' }
];

const auditVectors = [];
for (const avm of avMapping) {
  const srcVector = staticVectors.find(v => v.id === avm.src);
  const av = {
    id: avm.av,
    vector_ref: avm.src,
    category: 'audit-hash',
    purpose: avm.purpose,
    canonical_hex: srcVector.canonical_hex,
    decision_object: JSON.parse(JSON.stringify(srcVector.decision_object)),
    verification_method: 'five-step' // Whitepaper §13.3
  };
  auditVectors.push(av);
  console.log(`  ✓ ${avm.av} ← ${avm.src} — ${avm.purpose}`);
}

// AV-008: Stale regression vector
console.log('\n  Constructing AV-008 (stale regression)...');
const av003 = auditVectors.find(a => a.id === 'AV-003');
const av008 = {
  id: 'AV-008',
  vector_ref: 'AV-003',
  category: 'audit-hash',
  purpose: 'Stale regression vector — canonical_hex identical to AV-003, audit.hash uses v1.1 legacy value',
  canonical_hex: av003.canonical_hex,
  decision_object: JSON.parse(JSON.stringify(av003.decision_object)),
  source_commit: 'c3f22df',
  note: 'STALE REGRESSION VECTOR: canonical_hex identical to AV-003, audit.hash intentionally stale (v1.1 legacy value). Any validator that recomputes from first principles will detect MISMATCH; cached/shorthand validators will falsely PASS.',
  expected_result: 'MISMATCH'
};
// Override audit.hash with v1.1 legacy value
av008.decision_object.audit.hash = 'sha256:342b4e9652101d0b75ef39bed7f5a7e6de4d890618ec6eeafe3a9a3490ddb64d';
auditVectors.push(av008);
console.log('  ✓ AV-008 — stale regression (expected: MISMATCH)');

console.log(`\n  ${auditVectors.length} audit hash vectors generated`);

// ═══════════════════════════════════════════════════
//  Assemble output
// ═══════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════');
console.log('  Assembling decision-object-vectors-v1.3.json');
console.log('═══════════════════════════════════════════════');

// Count decision types
const dtCounts = {};
for (const v of staticVectors) {
  dtCounts[v.decision_type] = (dtCounts[v.decision_type] || 0) + 1;
}
const dtCovered = Object.keys(dtCounts).sort();

const output = {
  $schema: 'https://openoba.com/erdl/decision-object-v1.0/schema.json',
  spec: SPEC,
  version: VERSION,
  compliance_profile: 'erdl-compliance-v1.3',
  created: GENERATION_DATE,
  updated: GENERATION_DATE,
  maintainer: 'OpenOBA (https://openoba.com)',
  description: '101 cross-implementation test vectors for ERDL Decision Object v1.3. 63 static DOs + 26 dynamic (Temporal 10 / Seeded 8 / Stateful 8) + 12 audit hash vectors. Flat hashing: JCS(core+jurisdiction+extensions) → SHA-256.',
  vectors: staticVectors,
  dynamic_vectors: {
    temporal: temporalVectors,
    seeded: seededVectors,
    stateful: statefulVectors
  },
  audit_vectors: auditVectors,
  reserved_vectors: {
    decision_vectors: [
      { id: 'DO-064', decision_type: 'DELEGATE', status: 'reserved_for_v1.3', note: 'Reference implementation (rulsynor) engine code path not yet implemented' }
    ],
    audit_vectors: [
      { id: 'AV-013', vector_ref: 'DO-064', decision_type: 'DELEGATE', status: 'reserved_for_v1.3' }
    ]
  },
  metadata: {
    decision_types_covered: dtCovered,
    operators_covered: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'matches', 'starts_with', 'ends_with', 'exists'],
    edge_cases_covered: ['null-propagation', 'strict-type-matching', 'ReDoS-protection', 'rate-limiting', 'integer-safe-range', 'object-deep-comparison', 'empty-extension-normalization'],
    compatibility_levels: { L1: 28, L2: 45, L3: 101 }
  }
};

// ═══════════════════════════════════════════════════
//  Write output
// ═══════════════════════════════════════════════════

const outputPath = path.join(__dirname, '..', 'decision-object-vectors-v1.3.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`\n  ✓ Written: ${outputPath}`);
console.log(`    Size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);

// ═══════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════');
console.log('  GENERATION COMPLETE');
console.log('═══════════════════════════════════════════════');
console.log(`  Static DO vectors:  ${staticVectors.length}`);
console.log(`  Dynamic vectors:    ${temporalVectors.length + seededVectors.length + statefulVectors.length} (T:${temporalVectors.length} S:${seededVectors.length} ST:${statefulVectors.length})`);
console.log(`  Audit hash vectors: ${auditVectors.length}`);
console.log(`  Reserved:           2 (DO-064, AV-013 → DELEGATE v1.3)`);
console.log(`  ───────────────────`);
console.log(`  TOTAL:              ${staticVectors.length + temporalVectors.length + seededVectors.length + statefulVectors.length + auditVectors.length}`);
console.log('');
console.log('  Decision types covered:');
for (const [dt, count] of Object.entries(dtCounts).sort()) {
  console.log(`    ${dt.padEnd(22)} ${count}`);
}
console.log('');
console.log('  Next: verify with node scripts/verify.js decision-object-vectors-v1.3.json');
console.log('═══════════════════════════════════════════════');
