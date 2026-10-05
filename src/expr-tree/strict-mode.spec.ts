import { describe, it, expect } from 'vitest'
import { ExprTreeEvaluator, objectContext } from './evaluator.js'
import { UNKNOWN } from './eval-warning.js'
import type { ExprNode, CompareOp } from './node-types.js'

describe('Strict mode — comparison type mismatch (§7.3(a))', () => {
  const cmpNode = (op: CompareOp, left: unknown, right: unknown): ExprNode => ({
    type: 'compare',
    op,
    left: { type: 'literal', value: left },
    right: { type: 'literal', value: right },
  })
  const betweenNode = (value: unknown, min: unknown, max: unknown): ExprNode => ({
    type: 'between',
    value: { type: 'literal', value },
    min: { type: 'literal', value: min },
    max: { type: 'literal', value: max },
  })

  it('lenient (default): "100" gt 50 folds to unknown silently (no warning)', () => {
    const ev = new ExprTreeEvaluator()
    const r = ev.evaluate(cmpNode('gt', '100', 50), objectContext({}))
    expect(r.value).toBe(UNKNOWN)
    expect(r.warnings).toHaveLength(0)
  })

  it('strict: "100" gt 50 folds to unknown but records type_mismatch warning', () => {
    const ev = new ExprTreeEvaluator()
    ev.strict = true
    const r = ev.evaluate(cmpNode('gt', '100', 50), objectContext({}))
    expect(r.value).toBe(UNKNOWN)
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0].kind).toBe('type_mismatch')
  })

  it('strict: eq with mismatched types records type_mismatch warning', () => {
    const ev = new ExprTreeEvaluator()
    ev.strict = true
    const r = ev.evaluate(cmpNode('eq', '100', 100), objectContext({}))
    expect(r.value).toBe(UNKNOWN)
    expect(r.warnings.some((w) => w.kind === 'type_mismatch')).toBe(true)
  })

  it('strict: between with a string operand records type_mismatch warning', () => {
    const ev = new ExprTreeEvaluator()
    ev.strict = true
    const r = ev.evaluate(betweenNode('50', 10, 100), objectContext({}))
    expect(r.value).toBe(false)
    expect(r.warnings.some((w) => w.kind === 'type_mismatch')).toBe(true)
  })

  it('strict: same-type comparison (number vs number) records no warning', () => {
    const ev = new ExprTreeEvaluator()
    ev.strict = true
    const r = ev.evaluate(cmpNode('gt', 100, 50), objectContext({}))
    expect(r.value).toBe(true)
    expect(r.warnings).toHaveLength(0)
  })

  it('strict: missing field (null propagation) folds to unknown (no warning)', () => {
    const ev = new ExprTreeEvaluator()
    ev.strict = true
    // a field that does not exist resolves to undefined → null propagation, not type mismatch
    const node: ExprNode = { type: 'compare', op: 'gt', left: { type: 'field', field: 'missing' }, right: { type: 'literal', value: 50 } }
    const r = ev.evaluate(node, objectContext({}))
    expect(r.value).toBe(UNKNOWN)
    expect(r.warnings).toHaveLength(0)
  })
})
