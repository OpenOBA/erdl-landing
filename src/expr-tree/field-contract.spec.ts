import { describe, it, expect } from 'vitest'
import { ExprTreeEvaluator, objectContext } from './evaluator.js'
import type { ExprNode } from './node-types.js'

describe('Field contract — default_value + type check (§7.0.1a)', () => {
  it('default_value: a missing field with a contracted default evaluates to the default', () => {
    const ev = new ExprTreeEvaluator()
    const ctx = objectContext({}, undefined, { amount: { default_value: 0 } })
    const node: ExprNode = { type: 'compare', op: 'gt', left: { type: 'field', field: 'amount' }, right: { type: 'literal', value: 8000 } }
    const r = ev.evaluate(node, ctx)
    expect(r.value).toBe(false) // 0 gt 8000 = false (default applied, not null propagation)
  })

  it('default_value: a present field is not overridden by the default', () => {
    const ev = new ExprTreeEvaluator()
    const ctx = objectContext({ amount: 9000 }, undefined, { amount: { default_value: 0 } })
    const node: ExprNode = { type: 'compare', op: 'gt', left: { type: 'field', field: 'amount' }, right: { type: 'literal', value: 8000 } }
    const r = ev.evaluate(node, ctx)
    expect(r.value).toBe(true) // 9000 gt 8000 = true (present value, not default)
  })

  it('strict + contract type: a field value type mismatch records type_mismatch warning', () => {
    const ev = new ExprTreeEvaluator()
    ev.strict = true
    const ctx = objectContext({ amount: '100' }, undefined, { amount: { type: 'number' } })
    const node: ExprNode = { type: 'field', field: 'amount' }
    const r = ev.evaluate(node, ctx)
    expect(r.value).toBe('100')
    expect(r.warnings.some((w) => w.kind === 'type_mismatch')).toBe(true)
  })

  it('lenient + contract type: no warning (backward compatible)', () => {
    const ev = new ExprTreeEvaluator()
    const ctx = objectContext({ amount: '100' }, undefined, { amount: { type: 'number' } })
    const node: ExprNode = { type: 'field', field: 'amount' }
    const r = ev.evaluate(node, ctx)
    expect(r.warnings).toHaveLength(0)
  })

  it('strict + contract type: a matching type records no warning', () => {
    const ev = new ExprTreeEvaluator()
    ev.strict = true
    const ctx = objectContext({ amount: 100 }, undefined, { amount: { type: 'number' } })
    const node: ExprNode = { type: 'field', field: 'amount' }
    const r = ev.evaluate(node, ctx)
    expect(r.warnings).toHaveLength(0)
  })
})
