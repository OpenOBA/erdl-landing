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

describe('NOTIFY 附带动作（§7.1a）：不产生主决策时落到 fallback', () => {
  const evaluator = new Evaluator()

  it('单条 NOTIFY 命中 → 主决策落到 fallback ALLOW（非 undefined）', () => {
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'NOTIFY' } })]
    const r = evaluator.evaluate(rules, { a: 1 })
    expect(r.decision).toBe('ALLOW')
    // NOTIFY 仍记入 matched_rules（附带动作）
    expect(r.matchedRules.map((m) => m.decision)).toContain('NOTIFY')
    expect(r.totalMatched).toBe(1)
  })

  it('单条 NOTIFY 命中 + metadata.decision=DENY → 落到 DENY', () => {
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'NOTIFY' } })]
    const r = evaluator.evaluate(rules, { a: 1 }, { fallbackDecision: 'DENY' })
    expect(r.decision).toBe('DENY')
  })

  it('NOTIFY + ALLOW → ALLOW 胜出（NOTIFY 不改变主决策）', () => {
    const rules = [
      rule({ id: 'r1', name: 'R-NOTIFY', conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'NOTIFY' } }),
      rule({ id: 'r2', name: 'R-ALLOW', conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } }),
    ]
    const r = evaluator.evaluate(rules, { a: 1 })
    expect(r.decision).toBe('ALLOW')
    expect(r.matchedRules.map((m) => m.decision)).toContain('NOTIFY')
  })

  it('NOTIFY + DENY → DENY 胜出', () => {
    const rules = [
      rule({ id: 'r1', name: 'R-NOTIFY', conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'NOTIFY' } }),
      rule({ id: 'r2', name: 'R-DENY', conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'DENY' } }),
    ]
    const r = evaluator.evaluate(rules, { a: 1 })
    expect(r.decision).toBe('DENY')
  })

  it('无命中 → fallback ALLOW（不受影响）', () => {
    const rules = [rule({ conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'NOTIFY' } })]
    const r = evaluator.evaluate(rules, { a: 999 })
    expect(r.decision).toBe('ALLOW')
    expect(r.totalMatched).toBe(0)
  })
})
