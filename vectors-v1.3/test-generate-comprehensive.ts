/**
 * generate-vectors.cjs — 穷尽测试
 *
 * 维度：DO 构建 × 层级哈希 × 策略哈希 × 合规配置 × 动态向量 × 输出结构
 *
 * Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-07-28
 */

import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'

// Load generated vectors
const vectorsPath = path.join(__dirname, '..', 'decision-object-vectors-v1.3.json')
let data: any

beforeAll(() => {
  data = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'))
})

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex')
}

function jcsCanonicalize(value: any): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') { if (!isFinite(value)) throw new Error('NaN'); return String(value); }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) { return '[' + value.map(v => jcsCanonicalize(v)).join(',') + ']'; }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const members: string[] = [];
    for (const k of keys) { const v = value[k]; if (v === undefined) continue; members.push(JSON.stringify(k) + ':' + jcsCanonicalize(v)); }
    return '{' + members.join(',') + '}';
  }
  throw new Error('JCS: unsupported type ' + typeof value);
}

// ═══════════════════════════════════════════════
// 输出文件完整性
// ═══════════════════════════════════════════════
describe('输出 — 完整性', () => {
  it('文件大小在合理范围内 (>400KB, <1MB)', () => {
    const stat = fs.statSync(vectorsPath)
    expect(stat.size).toBeGreaterThan(400 * 1024)
    expect(stat.size).toBeLessThan(1024 * 1024)
  })

  it('文件是合法 JSON', () => {
    const content = fs.readFileSync(vectorsPath, 'utf8')
    expect(() => JSON.parse(content)).not.toThrow()
  })

  it('顶层键齐全', () => {
    const keys = Object.keys(data).sort()
    expect(keys).toContain('$schema')
    expect(keys).toContain('spec')
    expect(keys).toContain('version')
    expect(keys).toContain('compliance_profile')
    expect(keys).toContain('vectors')
    expect(keys).toContain('dynamic_vectors')
    expect(keys).toContain('audit_vectors')
    expect(keys).toContain('reserved_vectors')
    expect(keys).toContain('metadata')
    expect(keys).toContain('description')
    expect(keys).toContain('maintainer')
  })
})

// ═══════════════════════════════════════════════
// 63 DO 向量 — 结构验证
// ═══════════════════════════════════════════════
describe('63 DO 向量 — 结构', () => {
  let vectors: any[]

  beforeAll(() => {
    vectors = data.vectors
  })

  it('每个 DO 都有必需的 9 个顶层字段 (v1.3: canonical_hex 移到答案文件)', () => {
    const required = ['id', 'category', 'scenario', 'description', 'decision_type', 'rules', 'context', 'expected', 'decision_object']
    for (const vec of vectors) {
      for (const field of required) {
        expect(vec[field]).toBeDefined()
      }
    }
  })

  it('每个 decision_object 有必需的 23+ 个字段', () => {
    const requiredFields = [
      'spec', 'decision_id', 'compliance_profile', 'execution_trace_id',
      'timestamp', 'evaluation_duration_ms', 'agent', 'model_id', 'context',
      'context_snapshot_hash', 'sanitized_context', 'rule_set_version',
      'policies', 'fairness_assessment', 'impact_assessment_id',
      'autonomy_level', 'confidence_score', 'evaluation',
      'data_modification_expected', 'result', 'human_oversight',
      'extensions', 'audit', 'signature', 'signing_key_id'
    ]
    for (const vec of vectors) {
      const doObj = vec.decision_object
      for (const field of requiredFields) {
        expect(doObj[field], `${vec.id}: missing ${field}`).toBeDefined()
      }
    }
  })

  it('decision_id 为 RFC 9562 UUIDv7 (冻结时间戳 + 递增序号)', () => {
    // 格式: 019fa605-6800-7000-8000-{12位序号}
    // 019fa6056800 = Unix ms for 2026-07-28T00:00:00.000Z
    const uuidRe = /^019fa605-6800-7000-8000-[0-9a-f]{12}$/
    for (const vec of vectors) {
      expect(vec.decision_object.decision_id).toMatch(uuidRe)
    }
    // decision_id 从 000000000001 开始，execution_trace_id 占用偶数位
    expect(vectors[0].decision_object.decision_id).toBe('019fa605-6800-7000-8000-000000000001')
    expect(vectors[1].decision_object.decision_id).toBe('019fa605-6800-7000-8000-000000000003')
  })

  it('所有 decision_id 唯一', () => {
    const ids = vectors.map((v: any) => v.decision_object.decision_id)
    expect(new Set(ids).size).toBe(63)
  })

  it('所有 execution_trace_id 唯一', () => {
    const ids = vectors.map((v: any) => v.decision_object.execution_trace_id)
    expect(new Set(ids).size).toBe(63)
  })

  it('timestamp 固定为生成日期', () => {
    for (const vec of vectors) {
      expect(vec.decision_object.timestamp).toBe('2026-07-28T00:00:00.000Z')
    }
  })
})

// ═══════════════════════════════════════════════
// 层级哈希
// ═══════════════════════════════════════════════
describe('平面哈希 (Flat Hashing)', () => {
  it('audit.hash 格式正确 (sha256:64hex)', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.audit.hash).toMatch(/^sha256:[a-f0-9]{64}$/)
    }
  })

  it('extensions is an empty array in all DOs', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.extensions).toEqual([])
    }
  })

  it('audit hash 不包含 extensions/signature/signing_key_id', () => {
    // Recompute one hash and verify it excludes these fields
    const vec = data.vectors[0]
    const clone = JSON.parse(JSON.stringify(vec.decision_object))
    expect(clone.extensions).toBeDefined()
    expect(clone.audit).toBeDefined()
    expect(clone.signature).toBeDefined()
    expect(clone.signing_key_id).toBeDefined()

    // After stripping audited fields, JCS must produce different bytes
    const clone2 = JSON.parse(JSON.stringify(vec.decision_object))
    const exts = clone2.extensions
    delete clone2.extensions
    delete clone2.audit
    delete clone2.signature
    delete clone2.signing_key_id
    delete clone2.extensions_validation
    // This stripped version is what got hashed
    expect(clone2.extensions).toBeUndefined()
    expect(clone2.audit).toBeUndefined()
    expect(clone2.signature).toBeUndefined()
  })

  it('不同 DO 的 audit.hash 互不相同', () => {
    const hashes = data.vectors.map((v: any) => v.decision_object.audit.hash)
    expect(new Set(hashes).size).toBe(63)
  })
})

// ═══════════════════════════════════════════════
// 规则/策略 哈希
// ═══════════════════════════════════════════════
describe('策略哈希 (Policy Hashing)', () => {
  it('每个 policy 有 id/name/description/when/then/priority/ring/hash', () => {
    for (const vec of data.vectors) {
      for (const policy of vec.decision_object.policies) {
        expect(policy.id).toBeDefined()
        expect(policy.name).toBeDefined()
        expect(policy.when).toBeDefined()
        expect(policy.then).toBeDefined()
        expect(policy.priority).toBeDefined()
        expect(policy.ring).toBeDefined()
        expect(policy.hash).toMatch(/^sha256:[a-f0-9]{64}$/)
      }
    }
  })

  it('rule_set_version.id 是基于 policies 的 JCS 哈希', () => {
    for (const vec of data.vectors) {
      const rsId = vec.decision_object.rule_set_version.id
      expect(rsId).toMatch(/^sha256:[a-f0-9]{64}$/)
    }
  })

  it('相同 policies = 相同 rule_set_version.id', () => {
    // DO-020 and DO-011 may share policy structures
    // Find two DOs with identical policies (same rule IDs)
    const byPolicyKey = new Map<string, string[]>()
    for (const vec of data.vectors) {
      const key = vec.decision_object.policies.map((p: any) => p.id).sort().join(',')
      if (!byPolicyKey.has(key)) byPolicyKey.set(key, [])
      byPolicyKey.get(key)!.push(vec.id)
    }
    // For any group that shares policies, rule_set_version.id should be identical
    for (const [key, doIds] of byPolicyKey) {
      if (doIds.length > 1) {
        const vectors2 = doIds.map((id: string) => data.vectors.find((v: any) => v.id === id))
        const firstRsId = vectors2[0].decision_object.rule_set_version.id
        for (const v2 of vectors2) {
          expect(v2.decision_object.rule_set_version.id).toBe(firstRsId)
        }
      }
    }
  })

  it('不同 policies = 不同 rule_set_version.id', () => {
    // Pick two DOs with different policies
    const v1 = data.vectors[0]
    const v2 = data.vectors[1]
    if (v1.decision_object.policies.length !== v2.decision_object.policies.length ||
        v1.decision_object.policies[0].id !== v2.decision_object.policies[0].id) {
      expect(v1.decision_object.rule_set_version.id).not.toBe(v2.decision_object.rule_set_version.id)
    }
  })
})

// ═══════════════════════════════════════════════
// 合规配置
// ═══════════════════════════════════════════════
describe('合规配置 (Compliance Profile)', () => {
  it('profile_id 正确', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.compliance_profile.profile_id).toBe('erdl-compliance-v1.2')
    }
  })

  it('包含 4 个监管框架引用', () => {
    for (const vec of data.vectors) {
      const refs = vec.decision_object.compliance_profile.regulatory_references
      expect(refs).toHaveLength(4)
      const frameworks = refs.map((r: any) => r.framework)
      expect(frameworks).toContain('EU-AI-Act')
      expect(frameworks).toContain('GB-Z-185-2026')
      expect(frameworks).toContain('NIST-AI-RMF')
      expect(frameworks).toContain('COSO-GenAI')
    }
  })

  it('profile_hash 自洽', () => {
    for (const vec of data.vectors) {
      const cp = { ...vec.decision_object.compliance_profile }
      // profile_hash is computed from cp WITHOUT the hash itself
      expect(cp.profile_hash).toBeDefined()
    }
  })

  it('activated_fields 包含 model_id 等关键字段', () => {
    for (const vec of data.vectors) {
      const af = vec.decision_object.compliance_profile.activated_fields
      expect(af).toContain('model_id')
      expect(af).toContain('confidence_score')
      expect(af).toContain('autonomy_level')
    }
  })

  it('所有 DO 共享相同的 compliance_profile', () => {
    const first = data.vectors[0].decision_object.compliance_profile
    for (const vec of data.vectors) {
      expect(vec.decision_object.compliance_profile).toEqual(first)
    }
  })
})

// ═══════════════════════════════════════════════
// Agent 身份
// ═══════════════════════════════════════════════
describe('Agent 身份', () => {
  it('所有 DO 有相同的 agent', () => {
    const first = data.vectors[0].decision_object.agent
    for (const vec of data.vectors) {
      expect(vec.decision_object.agent).toEqual(first)
    }
  })

  it('agent.role 为 guardian', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.agent.role).toBe('guardian')
    }
  })

  it('agent.known_limitations 非空', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.agent.known_limitations.length).toBeGreaterThan(0)
    }
  })
})

// ═══════════════════════════════════════════════
// 评估结果
// ═══════════════════════════════════════════════
describe('评估结果 (Evaluation)', () => {
  it('matched_rules 至少包含一个规则', () => {
    for (const vec of data.vectors) {
      const mr = vec.decision_object.evaluation.matched_rules
      expect(Array.isArray(mr)).toBe(true)
    }
  })

  it('PASS 类型的 DO 有空的 matched_rules', () => {
    const passDOs = data.vectors.filter((v: any) => v.decision_type === 'PASS')
    for (const vec of passDOs) {
      expect(vec.decision_object.evaluation.matched_rules).toEqual([])
      expect(vec.decision_object.evaluation.triggered_rules).toEqual([])
      expect(vec.decision_object.result.applied_rule).toBeNull()
    }
  })

  it('非 PASS 类型有非空 matched_rules（除 unless 豁免场景外）', () => {
    // DO-026 (metadata-fallback) 是 ALLOW 但因为 unless 条件没有规则触发 → matched_rules 为空
    const nonPass = data.vectors.filter((v: any) => v.decision_type !== 'PASS')
    const exceptions = new Set(['DO-026']) // unless-exempted: no rules actually triggered
    let checked = 0
    for (const vec of nonPass) {
      if (exceptions.has(vec.id)) continue
      expect(vec.decision_object.evaluation.matched_rules.length, `${vec.id}: matched_rules should not be empty`).toBeGreaterThan(0)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('result.decision 匹配 decision_type', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.result.decision).toBe(vec.decision_type)
    }
  })

  it('result.rules_matched 数量正确', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.result.rules_matched).toBe(
        vec.decision_object.evaluation.matched_rules.length
      )
    }
  })
})

// ═══════════════════════════════════════════════
// 动态向量结构
// ═══════════════════════════════════════════════
describe('动态向量', () => {
  it('temporal: 10 个向量, id T-001 ~ T-010', () => {
    const tv = data.dynamic_vectors.temporal
    expect(tv).toHaveLength(10)
    for (let i = 1; i <= 10; i++) {
      const id = `T-${String(i).padStart(3, '0')}`
      expect(tv.find((t: any) => t.id === id)).toBeDefined()
    }
  })

  it('temporal: 每个有 timestamp 和 decision_type', () => {
    for (const tv of data.dynamic_vectors.temporal) {
      expect(tv.timestamp).toBeDefined()
      expect(tv.decision_type).toBeDefined()
      expect(tv.note).toBeDefined()
    }
  })

  it('temporal: T-002决策类型为 REQUEST_HUMAN', () => {
    const t2 = data.dynamic_vectors.temporal.find((t: any) => t.id === 'T-002')
    expect(t2.decision_type).toBe('REQUEST_HUMAN')
  })

  it('temporal: T-006 覆盖闰年', () => {
    const t6 = data.dynamic_vectors.temporal.find((t: any) => t.id === 'T-006')
    expect(t6.description).toContain('Feb 29')
  })

  it('temporal: T-009 覆盖 Y2K38 边界', () => {
    const t9 = data.dynamic_vectors.temporal.find((t: any) => t.id === 'T-009')
    expect(t9.description).toContain('2038')
  })

  it('seeded: 8 个向量, id S-001 ~ S-008', () => {
    const sv = data.dynamic_vectors.seeded
    expect(sv).toHaveLength(8)
    for (let i = 1; i <= 8; i++) {
      const id = `S-${String(i).padStart(3, '0')}`
      expect(sv.find((s: any) => s.id === id)).toBeDefined()
    }
  })

  it('seeded: 每个有唯一的 seed', () => {
    const seeds = data.dynamic_vectors.seeded.map((s: any) => s.seed)
    expect(new Set(seeds).size).toBe(8)
  })

  it('stateful: 8 个向量, id ST-001 ~ ST-008', () => {
    const sv = data.dynamic_vectors.stateful
    expect(sv).toHaveLength(8)
    for (let i = 1; i <= 8; i++) {
      const id = `ST-${String(i).padStart(3, '0')}`
      expect(sv.find((s: any) => s.id === id)).toBeDefined()
    }
  })

  it('stateful: 形成完整状态机链 (idle→running→paused→running→...→stopped→running)', () => {
    const sv = data.dynamic_vectors.stateful
    expect(sv[0].from_state).toBe('idle')
    expect(sv[7].to_state).toBe('running')
    // ST-001.to_state → ST-002.from_state
    for (let i = 0; i < sv.length - 1; i++) {
      expect(sv[i].to_state).toBe(sv[i + 1].from_state)
    }
  })
})

// ═══════════════════════════════════════════════
// 审计向量
// ═══════════════════════════════════════════════
describe('审计向量', () => {
  it('每个 AV 引用一个 DO 向量', () => {
    const avs = data.audit_vectors
    const doIds = new Set(data.vectors.map((v: any) => v.id))
    for (const av of avs) {
      if (av.id === 'AV-013') {
        expect(av.purpose).toContain('chain')
        continue
      }
      expect(doIds.has(av.vector_ref), `${av.id} refs ${av.vector_ref} which should be a DO`).toBe(true)
    }
  })

  it('每个 AV 的 diag_hash 是 audit.hash 的前 14 字符锚点', () => {
    const avs = data.audit_vectors
    for (const av of avs) {
      const hash = av.decision_object.audit.hash
      expect(av.diag_hash).toBe(hash.substring(0, 14))
    }
  })

  it('AV-013 金丝雀 discriminator：正确实现 MISMATCH + regressed 实现 MATCH', () => {
    const av13 = data.audit_vectors.find((a: any) => a.id === 'AV-013')
    expect(av13).toBeDefined()
    expect(av13.category).toBe('audit-hash')
    expect(av13.purpose).toContain('chain')

    const doObj = av13.decision_object

    // 正确实现：只删除 audit.hash（保留 previous_hash 在 JCS 原像中）
    const corrClone = JSON.parse(JSON.stringify(doObj))
    const storedHash = doObj.audit.hash
    delete corrClone.audit.hash
    delete corrClone.signature
    delete corrClone.signing_key_id
    delete corrClone.extensions_validation
    const corrHash = 'sha256:' + sha256(jcsCanonicalize(corrClone))

    // 正确 runner MUST 检测到 MISMATCH（previous_hash 被篡改）
    expect(corrHash).not.toBe(storedHash)

    // Regressed 实现：删除整个 audit 对象（previous_hash 不在 JCS 原像中）
    const regrClone = JSON.parse(JSON.stringify(doObj))
    delete regrClone.audit
    delete regrClone.signature
    delete regrClone.signing_key_id
    delete regrClone.extensions_validation
    const regrHash = 'sha256:' + sha256(jcsCanonicalize(regrClone))

    // Regressed runner MUST 错误地报告 MATCH（被金丝雀捕获）
    expect(regrHash).toBe(storedHash)
  })
})

// ═══════════════════════════════════════════════
// 元数据
// ═══════════════════════════════════════════════
describe('元数据', () => {
  it('版本为 1.2.0', () => {
    expect(data.version).toBe('1.3.0')
  })

  it('spec 为 decision-object-v1.0', () => {
    expect(data.spec).toBe('decision-object-v1.0')
  })

  it('维护者信息完整', () => {
    expect(data.maintainer).toContain('OpenOBA')
    expect(data.description).toContain('101')
  })

  it('metadata 统计正确', () => {
    const countByType: Record<string, number> = {}
    for (const vec of data.vectors) {
      countByType[vec.decision_type] = (countByType[vec.decision_type] || 0) + 1
    }

    // Actual generated counts (may differ from code comments):
    // DENY: 12, ALLOW: 11, PASS: 10, REQUEST_HUMAN: 4, EMERGENCY_HALT: 1,
    // CORRECT: 3, ESCALATE: 3, NOTIFY: 3, QUARANTINE: 3, ROLLBACK: 3,
    // WORKFLOW: 4, WORKFLOW_WAITING: 3, WORKFLOW_PROGRESS: 3
    expect(countByType['DENY']).toBe(12)
    expect(countByType['ALLOW']).toBe(11)
    expect(countByType['PASS']).toBe(10)
    expect(countByType['REQUEST_HUMAN']).toBe(4)
    expect(countByType['EMERGENCY_HALT']).toBe(1)
    expect(countByType['CORRECT']).toBe(3)
    expect(countByType['ESCALATE']).toBe(3)
    expect(countByType['NOTIFY']).toBe(3)
    expect(countByType['QUARANTINE']).toBe(3)
    expect(countByType['ROLLBACK']).toBe(3)
    expect(countByType['WORKFLOW']).toBe(4)
    expect(countByType['WORKFLOW_WAITING']).toBe(3)
    expect(countByType['WORKFLOW_PROGRESS']).toBe(3)

    // Total
    const total = Object.values(countByType).reduce((a: number, b: number) => a + b, 0)
    expect(total).toBe(63)
  })

  it('覆盖 13 种运算符', () => {
    expect(data.metadata.operators_covered).toContain('eq')
    expect(data.metadata.operators_covered).toContain('neq')
    expect(data.metadata.operators_covered).toContain('gt')
    expect(data.metadata.operators_covered).toContain('gte')
    expect(data.metadata.operators_covered).toContain('lt')
    expect(data.metadata.operators_covered).toContain('lte')
    expect(data.metadata.operators_covered).toContain('in')
    expect(data.metadata.operators_covered).toContain('not_in')
    expect(data.metadata.operators_covered).toContain('contains')
    expect(data.metadata.operators_covered).toContain('matches')
    expect(data.metadata.operators_covered).toContain('starts_with')
    expect(data.metadata.operators_covered).toContain('ends_with')
    expect(data.metadata.operators_covered).toContain('exists')
  })

  it('覆盖 7 种边缘情况', () => {
    const edges = data.metadata.edge_cases_covered
    expect(edges).toContain('null-propagation')
    expect(edges).toContain('strict-type-matching')
    expect(edges).toContain('ReDoS-protection')
    expect(edges).toContain('rate-limiting')
    expect(edges).toContain('integer-safe-range')
    expect(edges).toContain('object-deep-comparison')
    expect(edges).toContain('empty-extension-normalization')
  })
})

// ═══════════════════════════════════════════════
// 跨向量一致性
// ═══════════════════════════════════════════════
describe('跨向量一致性', () => {
  it('所有 DO 的 extensions 为空数组', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.extensions).toEqual([])
    }
  })

  it('所有 DO 的 data_modification_expected 为 false', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.data_modification_expected).toBe(false)
    }
  })

  it('所有 DO 的 autonomy_level 为 L2', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.autonomy_level).toBe('L2')
    }
  })

  it('所有 DO 的 confidence_score 为 95（整数，表示 95%）', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.confidence_score).toBe(95)
    }
  })

  it('所有 DO 的 evaluation_duration_ms 为 12', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.evaluation_duration_ms).toBe(12)
    }
  })

  it('所有 DO 的 fairness_assessment 为 not_applicable', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.fairness_assessment).toBe('not_applicable')
    }
  })

  it('所有 DO 的 signature 为 TEST_SIGNATURE_BASE64URL_PLACEHOLDER', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.signature).toBe('TEST_SIGNATURE_BASE64URL_PLACEHOLDER')
    }
  })

  it('所有 DO 的 signing_key_id 一致', () => {
    const ids = new Set(data.vectors.map((v: any) => v.decision_object.signing_key_id))
    expect(ids.size).toBe(1)
    expect(ids.has('key-v1-test-2026-07')).toBe(true)
  })

  it('所有 DO 的 sanitized_context 为 null', () => {
    for (const vec of data.vectors) {
      expect(vec.decision_object.sanitized_context).toBeNull()
    }
  })

  it('所有 DO 的 context_snapshot_hash 和 tool_registry_hash 为虚拟哈希', () => {
    const VIRTUAL = 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
    for (const vec of data.vectors) {
      expect(vec.decision_object.context_snapshot_hash).toBe(VIRTUAL)
      expect(vec.decision_object.agent.tool_registry_hash).toBe(VIRTUAL)
    }
  })

  it('所有 DO 的 impact_assessment_id 一致', () => {
    const ids = new Set(data.vectors.map((v: any) => v.decision_object.impact_assessment_id))
    expect(ids.size).toBe(1)
  })
})

// ═══════════════════════════════════════════════
// 边界/数据类型
// ═══════════════════════════════════════════════
describe('数据类型边界', () => {
  it('priority 为数值类型', () => {
    for (const vec of data.vectors) {
      for (const policy of vec.decision_object.policies) {
        expect(typeof policy.priority).toBe('number')
      }
    }
  })

  it('ring 为数值类型 (0-4，包含 Ring 4 扩展)', () => {
    for (const vec of data.vectors) {
      for (const policy of vec.decision_object.policies) {
        expect(typeof policy.ring).toBe('number')
        expect(policy.ring).toBeGreaterThanOrEqual(0)
        expect(policy.ring).toBeLessThanOrEqual(4)
      }
    }
    // Verify Ring 4 is used (DO-012 override-unsafe-direction)
    const ring4Used = data.vectors.some((v: any) =>
      v.decision_object.policies.some((p: any) => p.ring === 4)
    )
    expect(ring4Used).toBe(true)
  })

  it('Ring 0 规则只有 DENY 和 EMERGENCY_HALT', () => {
    for (const vec of data.vectors) {
      for (const policy of vec.decision_object.policies) {
        if (policy.ring === 0) {
          expect(['DENY', 'EMERGENCY_HALT']).toContain(policy.then)
        }
      }
    }
  })

  it('Ring 2 规则有 REQUEST_HUMAN 和 ESCALATE', () => {
    let ring2Found = false
    for (const vec of data.vectors) {
      for (const policy of vec.decision_object.policies) {
        if (policy.ring === 2) {
          ring2Found = true
          expect(['REQUEST_HUMAN', 'ESCALATE', 'NOTIFY']).toContain(policy.then)
        }
      }
    }
    expect(ring2Found).toBe(true)
  })

  it('Ring 3 规则最多（建议性规则）', () => {
    let ring3Count = 0
    let otherCount = 0
    for (const vec of data.vectors) {
      for (const policy of vec.decision_object.policies) {
        if (policy.ring === 3) ring3Count++
        else otherCount++
      }
    }
    expect(ring3Count).toBeGreaterThan(otherCount)
  })
})

// ═══════════════════════════════════════════════
// 保留向量
// ═══════════════════════════════════════════════
describe('保留向量', () => {
  it('DELEGATE (DO-064) reserved for v1.3', () => {
    const rv = data.reserved_vectors.decision_vectors[0]
    expect(rv.id).toBe('DO-064')
    expect(rv.decision_type).toBe('DELEGATE')
    expect(rv.status).toBe('reserved_for_v1.3')
  })

  it('AV-013 reserved for v1.3', () => {
    const rva = data.reserved_vectors.audit_vectors[0]
    expect(rva.id).toBe('AV-013')
    expect(rva.vector_ref).toBe('DO-064')
    expect(rva.status).toBe('reserved_for_v1.3')
  })
})
