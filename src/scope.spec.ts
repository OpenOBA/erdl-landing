import { describe, it, expect } from 'vitest'
import { parseErdlDocument } from './erdl-loader.js'
import { Evaluator } from './evaluator.js'
import type { RuleDefinition } from './rule-definition.js'

function rule(overrides: Partial<RuleDefinition>): RuleDefinition {
  return {
    id: 'r',
    name: 'R-001',
    priority: 1,
    enabled: true,
    conditions: [],
    action: { decision: 'DENY' },
    ...overrides,
  } as RuleDefinition
}

describe('S6 scope 字段（计数主体作用域）', () => {
  it('loader 解析条件级 scope 字段', () => {
    const doc = parseErdlDocument(`
protocol: "erdl/v2"
version: "2.2.0"
metadata: { name: "x" }
rules:
  - name: "SEC-001-scope-field"
    when:
      conditions:
        - field: "tool.name"
          operator: "eq"
          value: "exec"
          scope: "user.id"
    then: DENY
`)
    expect(doc.rules[0]!.conditions[0]!.scope).toBe('user.id')
  })

  it('rate 1/1m + then DENY：第 1 次允许，第 2 次超限拦截', () => {
    const evaluator = new Evaluator()
    const rules = [
      rule({ conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec', rate: '1/1m' }], action: { decision: 'DENY' } }),
    ]
    const ctx = { 'tool.name': 'exec' }
    // 第 1 次：rate 未超限 → 规则不命中 → fallback ALLOW
    expect(evaluator.evaluate(rules, ctx).decision).toBe('ALLOW')
    // 第 2 次：rate 超限 → 规则命中 → DENY
    expect(evaluator.evaluate(rules, ctx).decision).toBe('DENY')
  })

  it('不同规则同 field 的 rate 计数互相隔离（键含规则名）', () => {
    const evaluator = new Evaluator()
    // 两条规则各 rate 1/1m + DENY。若键含规则名，第 2 次求值时两条都各自超限。
    // 若键不含规则名（共享计数），第 1 次求值两条累计 2 次，行为会不同。
    const rules = [
      rule({ id: 'r1', name: 'R-A', conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec', rate: '1/1m' }], action: { decision: 'DENY' } }),
      rule({ id: 'r2', name: 'R-B', conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec', rate: '1/1m' }], action: { decision: 'DENY' } }),
    ]
    const ctx = { 'tool.name': 'exec' }
    // 第 1 次：两条各自的 rate 都未超限 → 都允许 → ALLOW
    expect(evaluator.evaluate(rules, ctx).decision).toBe('ALLOW')
    // 第 2 次：两条各自的 rate 都超限 → 都命中 DENY
    expect(evaluator.evaluate(rules, ctx).decision).toBe('DENY')
  })

  it('scope 字段参与 rate 键（不同 scope 隔离）', () => {
    const evaluator = new Evaluator()
    const rules = [
      rule({
        conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec', rate: '1/1m', scope: 'user.id' }],
        action: { decision: 'DENY' },
      }),
    ]
    const ctxA = { 'tool.name': 'exec', 'user.id': 'u1' }
    const ctxB = { 'tool.name': 'exec', 'user.id': 'u2' }
    // u1 第 1 次：允许（u1 计数 0 < 1）
    expect(evaluator.evaluate(rules, ctxA).decision).toBe('ALLOW')
    // u2 第 1 次：独立计数，仍允许（scope 隔离）
    expect(evaluator.evaluate(rules, ctxB).decision).toBe('ALLOW')
    // u1 第 2 次：u1 计数到 1 → 超限 → DENY
    expect(evaluator.evaluate(rules, ctxA).decision).toBe('DENY')
    // u2 第 2 次：u2 也独立超限 → DENY
    expect(evaluator.evaluate(rules, ctxB).decision).toBe('DENY')
  })
})
