import { describe, it, expect } from 'vitest'
import { Evaluator } from './evaluator.js'
import type { RuleDefinition } from './rule-definition.js'

/** Minimal rule builder for fold decision-merge tests. */
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

describe('§7.1a fold 决策合并（decision-strength partial order）', () => {
  const evaluator = new Evaluator()

  it('同向非拦截取强度更强：REQUEST_HUMAN(2) 覆盖 ESCALATE(3)', () => {
    const rules = [
      rule({ id: 'r1', name: 'R-001', priority: 1, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ESCALATE' } }),
      rule({ id: 'r2', name: 'R-002', priority: 2, conditions: [{ field: 'b', operator: 'eq', value: 1 }], action: { decision: 'REQUEST_HUMAN' } }),
    ]
    expect(evaluator.evaluate(rules, { a: 1, b: 1 }).decision).toBe('REQUEST_HUMAN')
  })

  it('CORRECT(6) 弱于 ESCALATE(3)：后者胜出', () => {
    const rules = [
      rule({ id: 'r1', name: 'R-001', priority: 1, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'CORRECT' } }),
      rule({ id: 'r2', name: 'R-002', priority: 2, conditions: [{ field: 'b', operator: 'eq', value: 1 }], action: { decision: 'ESCALATE' } }),
    ]
    expect(evaluator.evaluate(rules, { a: 1, b: 1 }).decision).toBe('ESCALATE')
  })

  it('NOTIFY 是附带动作，不改变 decision', () => {
    const rules = [
      rule({ id: 'r1', name: 'R-001', priority: 1, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } }),
      rule({ id: 'r2', name: 'R-002', priority: 2, conditions: [{ field: 'b', operator: 'eq', value: 1 }], action: { decision: 'NOTIFY' } }),
    ]
    const result = evaluator.evaluate(rules, { a: 1, b: 1 })
    expect(result.decision).toBe('ALLOW')
    expect(result.matchedRules.map((m) => m.decision)).toContain('NOTIFY')
  })

  it('DENY 收紧 ALLOW（自由，无需 override）', () => {
    const rules = [
      rule({ id: 'r1', name: 'R-001', priority: 1, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } }),
      rule({ id: 'r2', name: 'R-002', priority: 2, conditions: [{ field: 'b', operator: 'eq', value: 1 }], action: { decision: 'DENY' } }),
    ]
    expect(evaluator.evaluate(rules, { a: 1, b: 1 }).decision).toBe('DENY')
  })

  it('override ALLOW 放松 DENY（需 override critical/high）', () => {
    const rules = [
      rule({ id: 'r1', name: 'R-001', priority: 1, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'DENY' } }),
      rule({ id: 'r2', name: 'R-002', priority: 2, override: 'high', conditions: [{ field: 'b', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } }),
    ]
    expect(evaluator.evaluate(rules, { a: 1, b: 1 }).decision).toBe('ALLOW')
  })

  it('非 override ALLOW 不能放松 DENY（保持 DENY）', () => {
    const rules = [
      rule({ id: 'r1', name: 'R-001', priority: 1, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'DENY' } }),
      rule({ id: 'r2', name: 'R-002', priority: 2, conditions: [{ field: 'b', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } }),
    ]
    expect(evaluator.evaluate(rules, { a: 1, b: 1 }).decision).toBe('DENY')
  })

  it('DENY 收紧 REQUEST_HUMAN（拦截类覆盖人机协同）', () => {
    const rules = [
      rule({ id: 'r1', name: 'R-001', priority: 1, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'REQUEST_HUMAN' } }),
      rule({ id: 'r2', name: 'R-002', priority: 2, conditions: [{ field: 'b', operator: 'eq', value: 1 }], action: { decision: 'DENY' } }),
    ]
    expect(evaluator.evaluate(rules, { a: 1, b: 1 }).decision).toBe('DENY')
  })
})
