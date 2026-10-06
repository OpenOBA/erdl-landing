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

/** 同一组规则任意排列，最终决策相同（置换不变性）。 */
function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const p of permute(rest)) out.push([arr[i], ...p])
  }
  return out
}

function decisionFor(rules: RuleDefinition[], ctx: Record<string, unknown>): string {
  return new Evaluator().evaluate(rules, ctx).decision
}

describe('S5 集合式 fold（置换不变性）', () => {
  it('override 覆盖判定与规则排列顺序无关', () => {
    const rules = [
      rule({ id: 'd', name: 'D', priority: 1, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'DENY', ring: 0 } }),
      rule({ id: 'o', name: 'O', priority: 2, override: 'critical', conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW', ring: 0 } }),
      rule({ id: 'a2', name: 'A2', priority: 3, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW' } }),
    ]
    const decisions = new Set(permute(rules).map((p) => decisionFor(p, { a: 1 })))
    // ring0 DENY + ring0 critical ALLOW：override 覆盖 DENY → ALLOW（同环覆盖成立）
    expect(decisions).toEqual(new Set(['ALLOW']))
  })

  it('外环 override ALLOW 不覆盖内环 DENY，且与排列顺序无关', () => {
    const rules = [
      rule({ id: 'd', name: 'D', priority: 1, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'DENY', ring: 0 } }),
      rule({ id: 'o', name: 'O', priority: 2, override: 'critical', conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW', ring: 3 } }),
    ]
    const decisions = new Set(permute(rules).map((p) => decisionFor(p, { a: 1 })))
    // ring3 override ALLOW 不覆盖 ring0 DENY → DENY（外环不得覆盖内环）
    expect(decisions).toEqual(new Set(['DENY']))
  })

  it('收紧方向与排列顺序无关', () => {
    const rules = [
      rule({ id: 'a', name: 'A', priority: 1, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ALLOW', ring: 3 } }),
      rule({ id: 'd', name: 'D', priority: 2, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'DENY', ring: 0 } }),
    ]
    const decisions = new Set(permute(rules).map((p) => decisionFor(p, { a: 1 })))
    expect(decisions).toEqual(new Set(['DENY']))
  })

  it('同向强度收敛与排列顺序无关', () => {
    const rules = [
      rule({ id: 'e', name: 'E', priority: 1, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'ESCALATE' } }),
      rule({ id: 'r', name: 'R', priority: 2, conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'REQUEST_HUMAN' } }),
    ]
    const decisions = new Set(permute(rules).map((p) => decisionFor(p, { a: 1 })))
    expect(decisions).toEqual(new Set(['REQUEST_HUMAN']))
  })
})
