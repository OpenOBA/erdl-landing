import { describe, it, expect } from 'vitest'
import { exprTreeEvaluator, objectContext } from './evaluator.js'
import { UNKNOWN } from './eval-warning.js'
import { fromSExpr } from './s-expression.js'

describe('M1/M2 缺失字段与空聚合 unknown 化（fail-open 防护）', () => {
  it('M1: 算术缺失字段 → unknown（非 EvaluationError）', () => {
    // add(missing, 1)：missing 字段缺失 → 传播 unknown，而非 errored
    const node = fromSExpr({ add: [{ field: 'missing' }, 1] })
    const r = exprTreeEvaluator.evaluate(node, objectContext({}))
    expect(r.value).toBe(UNKNOWN)
    expect(r.errored).toBe(false)
  })

  it('M1: 算术非法类型（字符串）仍是 EvaluationError', () => {
    const node = fromSExpr({ add: [{ field: 'a' }, 1] })
    const r = exprTreeEvaluator.evaluate(node, objectContext({ a: 'not-a-number' }))
    expect(r.errored).toBe(true)
  })

  it('M1: 除零仍是 EvaluationError', () => {
    const node = fromSExpr({ div: [1, 0] })
    const r = exprTreeEvaluator.evaluate(node, objectContext({}))
    expect(r.errored).toBe(true)
  })

  it('M2: not(all(empty)) 不翻转（unknown 而非 false）', () => {
    // all(empty) → unknown；not(unknown) = unknown，不翻转为 true（fail-open 防护）
    const node = fromSExpr({ not: { all: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } } })
    const r = exprTreeEvaluator.evaluate(node, objectContext({ items: [] }))
    expect(r.value).toBe(UNKNOWN)
    expect(r.errored).toBe(false)
  })

  it('M2: not(min(empty)) 不翻转', () => {
    const node = fromSExpr({ not: { min: { field: 'nums' } } })
    const r = exprTreeEvaluator.evaluate(node, objectContext({ nums: [] }))
    expect(r.value).toBe(UNKNOWN)
  })

  it('M1: exists 守卫 + 算术（字段存在时正常计算）', () => {
    const node = fromSExpr({ add: [{ field: 'amount' }, 10] })
    const r = exprTreeEvaluator.evaluate(node, objectContext({ amount: 5 }))
    expect(r.errored).toBe(false)
    expect(typeof r.value).toBe('object')
  })
})
