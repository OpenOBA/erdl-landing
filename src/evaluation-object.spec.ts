import { describe, it, expect } from 'vitest'
import { Evaluator } from './evaluator.js'
import type { RuleDefinition } from './rule-definition.js'
import { evaluationObjectHash, evaluationObjectPreimage } from './evaluation-object.js'

function rule(overrides: Partial<RuleDefinition>): RuleDefinition {
  return {
    id: 'r',
    name: 'R-001',
    priority: 1,
    enabled: true,
    conditions: [],
    action: { decision: 'ALLOW' },
    ...overrides,
  } as RuleDefinition
}

describe('§8.2a.1 求值结果 DO（语言层）序列化与哈希', () => {
  const evaluator = new Evaluator()

  it('S4: eval_profile 原像不含 engine_id，含 spec_version', () => {
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } })]
    const result = evaluator.evaluate(rules, { a: 1 })
    const preimage = evaluationObjectPreimage({ a: 1 }, result) as Record<string, any>
    const ep = preimage.eval_profile as Record<string, unknown>
    expect(ep).toBeDefined()
    expect('engine_id' in ep).toBe(false)
    expect(ep.spec_version).toBe('v2.3')
    expect(ep.strict).toBe(false)
    expect(ep.context).toBe('guard')
  })

  it('S1: matched_rules 子结构规范化（snake_case + 缺席 null + 固定键序）', () => {
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW', instruction: 'go' } })]
    const result = evaluator.evaluate(rules, { a: 1 })
    const preimage = evaluationObjectPreimage({ a: 1 }, result) as Record<string, any>
    const m = preimage.matched_rules[0] as Record<string, unknown>
    // 固定键序：rule_id → rule_name → decision → priority → ring → instruction → reason → correction → explanation → alternative → corrected_args
    expect(Object.keys(m)).toEqual([
      'rule_id', 'rule_name', 'decision', 'priority', 'ring',
      'instruction', 'reason', 'correction', 'explanation', 'alternative', 'corrected_args',
    ])
    expect(m.rule_id).toBe('r')
    expect(m.decision).toBe('ALLOW')
    expect(m.instruction).toBe('go')
    expect(m.reason).toBeNull()
    expect(m.correction).toBeNull()
    expect(m.corrected_args).toBeNull()
  })

  it('S1: canonical_trees 子结构用 snake_case rule_id，且 tree 为规范化对象（数字 typed）', () => {
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 15 }], action: { decision: 'ALLOW' } })]
    const result = evaluator.evaluate(rules, { a: 15 })
    const preimage = evaluationObjectPreimage({ a: 15 }, result) as Record<string, any>
    const ct = preimage.canonical_trees[0] as Record<string, unknown>
    expect(Object.keys(ct)).toEqual(['rule_id', 'tree', 'hash'])
    expect(ct.rule_id).toBe('r')
    expect((ct.hash as string).startsWith('sha256:')).toBe(true)
    // tree 是规范化对象，数字字面量应是 typed { n: "15" }
    const treeStr = JSON.stringify(ct.tree)
    expect(treeStr).toContain('"n":"15"')
  })

  it('S1: eval_warnings 子结构用封闭枚举 code，排除自由文本 message', () => {
    // 用一个会触发 warning 的场景：严格模式下类型不匹配
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } })]
    const result = evaluator.evaluate(rules, { a: 'not-a-number' }, { strict: true, fieldContracts: { a: { type: 'number' } } })
    const preimage = evaluationObjectPreimage({ a: 'not-a-number' }, result) as Record<string, any>
    const warnings = preimage.eval_warnings as Array<Record<string, unknown>>
    expect(warnings.length).toBeGreaterThan(0)
    for (const w of warnings) {
      expect(Object.keys(w).sort()).toEqual(['code', 'node_type'])
      expect('message' in w).toBe(false)
    }
  })

  it('字段序固定（19 个字段，按 §8.2a.1）', () => {
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } })]
    const result = evaluator.evaluate(rules, { a: 1 })
    const preimage = evaluationObjectPreimage({ a: 1 }, result) as Record<string, any>
    expect(Object.keys(preimage)).toEqual([
      'context', 'decision', 'matched_rules', 'unless_exemptions', 'primary_instruction',
      'primary_reason', 'primary_explanation', 'primary_correction', 'total_evaluated',
      'total_matched', 'temporal_state', 'state_snapshot', 'canonical_trees',
      'rule_set_hash', 'eval_profile', 'eval_warnings', 'indeterminate_rules', 'errored', 'as_of',
    ])
  })

  it('确定性：同一输入 + 同一 asOf 产生同一哈希；不同输入产生不同哈希', () => {
    // asOf 由调用方注入（E9 禁读墙钟）；确定性断言必须在固定 asOf 下进行，
    // 因为复算（recompute）本身就是用同一个 asOf 重放同一决策。
    const asOf = '2026-08-22T00:00:00.000Z'
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } })]
    const r1 = evaluator.evaluate(rules, { a: 1 }, { asOf })
    const r2 = evaluator.evaluate(rules, { a: 1 }, { asOf })
    expect(evaluationObjectHash({ a: 1 }, r1)).toBe(evaluationObjectHash({ a: 1 }, r2))

    const r3 = evaluator.evaluate(rules, { a: 2 }, { asOf })
    expect(evaluationObjectHash({ a: 1 }, r1)).not.toBe(evaluationObjectHash({ a: 2 }, r3))
  })

  it('errored 恒为布尔（缺省 false，不进缺席编码）', () => {
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } })]
    const result = evaluator.evaluate(rules, { a: 1 })
    const preimage = evaluationObjectPreimage({ a: 1 }, result) as Record<string, any>
    expect(preimage.errored).toBe(false)
  })

  it('哈希带 sha256: 前缀', () => {
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } })]
    const result = evaluator.evaluate(rules, { a: 1 }, { asOf: '2026-08-22T00:00:00.000Z' })
    expect(evaluationObjectHash({ a: 1 }, result)).toMatch(/^sha256:[0-9a-f]{64}$/)
  })
})
