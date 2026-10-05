import { describe, it, expect } from 'vitest'
import { Evaluator } from './evaluator.js'
import type { RuleDefinition } from './rule-definition.js'

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

describe('§8.2a.1a rule_set_hash（规则语义全集哈希）', () => {
  const evaluator = new Evaluator()

  it('求值结果含 rule_set_hash（sha256: 前缀）', () => {
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } })]
    const result = evaluator.evaluate(rules, { a: 1 })
    expect(result.ruleSetHash).toBeDefined()
    expect(result.ruleSetHash).toMatch(/^sha256:/)
  })

  it('then 变化改变 rule_set_hash', () => {
    const allow = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } })]
    const deny = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'DENY' } })]
    expect(evaluator.evaluate(allow, { a: 1 }).ruleSetHash).not.toBe(evaluator.evaluate(deny, { a: 1 }).ruleSetHash)
  })

  it('priority 变化改变 rule_set_hash', () => {
    const p1 = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' }, priority: 1 })]
    const p2 = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' }, priority: 2 })]
    expect(evaluator.evaluate(p1, { a: 1 }).ruleSetHash).not.toBe(evaluator.evaluate(p2, { a: 1 }).ruleSetHash)
  })

  it('未命中规则也进 rule_set_hash（改未命中规则改变 hash）', () => {
    const ctx = { a: 1 }
    const base = [
      rule({ id: 'r1', name: 'R-001', conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } }),
      rule({ id: 'r2', name: 'R-002', conditions: [{ field: 'b', operator: 'eq', value: 1 }], action: { decision: 'DENY' } }),
    ]
    const changed = [
      rule({ id: 'r1', name: 'R-001', conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } }),
      rule({ id: 'r2', name: 'R-002', conditions: [{ field: 'b', operator: 'eq', value: 2 }], action: { decision: 'DENY' } }),
    ]
    // 只命中 r1（a=1），r2 未命中；但 r2 的 when 变化仍应改变 rule_set_hash
    expect(evaluator.evaluate(base, ctx).ruleSetHash).not.toBe(evaluator.evaluate(changed, ctx).ruleSetHash)
  })

  it('override 变化改变 rule_set_hash', () => {
    const o1 = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } })]
    const o2 = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' }, override: 'high' })]
    expect(evaluator.evaluate(o1, { a: 1 }).ruleSetHash).not.toBe(evaluator.evaluate(o2, { a: 1 }).ruleSetHash)
  })
})

describe('§8.2a.1b eval_profile（求值选项入原像）', () => {
  const evaluator = new Evaluator()

  it('求值结果含 eval_profile（strict/context/spec_version/engine_id）', () => {
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } })]
    const result = evaluator.evaluate(rules, { a: 1 })
    expect(result.evalProfile).toBeDefined()
    expect(result.evalProfile?.strict).toBe(false)
    expect(result.evalProfile?.context).toBe('guard')
    expect(result.evalProfile?.spec_version).toBe('v2.3')
    expect(result.evalProfile?.engine_id).toBe('erdl-engine')
    expect(result.evalProfile?.contract_hash).toBeNull()
  })

  it('strict 选项反映到 eval_profile', () => {
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } })]
    const result = evaluator.evaluate(rules, { a: 1 }, { strict: true })
    expect(result.evalProfile?.strict).toBe(true)
  })

  it('字段契约哈希化引用（contract_hash）', () => {
    const rules = [rule({ conditions: [{ field: 'amount', operator: 'gt', value: 100 }], action: { decision: 'ALLOW' } })]
    const contracts = { amount: { type: 'number' } }
    const result = evaluator.evaluate(rules, { amount: 200 }, { fieldContracts: contracts })
    expect(result.evalProfile?.contract_hash).toMatch(/^sha256:/)
  })
})
