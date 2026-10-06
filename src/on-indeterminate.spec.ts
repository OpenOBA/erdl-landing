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

describe('S3 on_indeterminate（unknown 默认 REQUEST_HUMAN，非 fail-open）', () => {
  const evaluator = new Evaluator()

  it('expr 路径字段缺失 → UNKNOWN → indeterminateRules 记录 + REQUEST_HUMAN', () => {
    const rules = [rule({
      conditions: [{ expr: { eq: [{ field: 'missing' }, 'x'] } }],
      action: { decision: 'ALLOW' },
    })]
    const result = evaluator.evaluate(rules, { other: 1 })
    expect(result.indeterminateRules).toEqual(['R-001'])
    expect(result.decision).toBe('REQUEST_HUMAN')
  })

  it('字段存在且匹配 → 正常 ALLOW，无 indeterminate', () => {
    const rules = [rule({
      conditions: [{ expr: { eq: [{ field: 'a' }, 'x'] } }],
      action: { decision: 'ALLOW' },
    })]
    const result = evaluator.evaluate(rules, { a: 'x' })
    expect(result.indeterminateRules).toBeUndefined()
    expect(result.decision).toBe('ALLOW')
  })

  it('字段存在但不匹配 → 确定 false → 落到 fallback，无 indeterminate', () => {
    const rules = [rule({
      conditions: [{ expr: { eq: [{ field: 'a' }, 'x'] } }],
      action: { decision: 'ALLOW' },
    })]
    const result = evaluator.evaluate(rules, { a: 'y' })
    expect(result.indeterminateRules).toBeUndefined()
    expect(result.decision).toBe('ALLOW') // fallback 缺省 ALLOW
  })

  it('显式 onIndeterminate: DENY 可覆盖默认', () => {
    const rules = [rule({
      conditions: [{ expr: { eq: [{ field: 'missing' }, 'x'] } }],
      action: { decision: 'ALLOW' },
    })]
    const result = evaluator.evaluate(rules, { other: 1 }, { onIndeterminate: 'DENY' })
    expect(result.decision).toBe('DENY')
  })

  it('unknown 不放松已命中的 DENY（安全单调）', () => {
    const rules = [
      rule({ id: 'r1', name: 'R-DENY', conditions: [{ field: 'a', operator: 'eq', value: 1 }], action: { decision: 'DENY' } }),
      rule({ id: 'r2', name: 'R-UNKNOWN', conditions: [{ expr: { eq: [{ field: 'missing' }, 'x'] } }], action: { decision: 'ALLOW' } }),
    ]
    const result = evaluator.evaluate(rules, { a: 1 })
    // r1 DENY 命中，r2 unknown；on_indeterminate REQUEST_HUMAN 不应放松 DENY
    expect(result.decision).toBe('DENY')
    expect(result.indeterminateRules).toContain('R-UNKNOWN')
  })

  it('简单字段/值形态（Simple 路径）字段缺失 → 确定 false，不触发 indeterminate', () => {
    // Simple 路径 isAbsent 直接 false（SPEC §7.3(a) 比较节点缺失→false），非 UNKNOWN
    const rules = [rule({
      conditions: [{ field: 'a', operator: 'eq', value: 1 }],
      action: { decision: 'ALLOW' },
    })]
    const result = evaluator.evaluate(rules, { b: 2 })
    expect(result.indeterminateRules).toBeUndefined()
    expect(result.decision).toBe('ALLOW') // fallback
  })
})
