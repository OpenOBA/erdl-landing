import { describe, it, expect } from 'vitest'
import { compileSimpleCondition, type SimpleOperator } from './simple-compiler.js'
import { exprTreeEvaluator, objectContext } from './evaluator.js'

/** Evaluate a Simple condition against a context object, returning the boolean result. */
function ev(operator: SimpleOperator, field: string, value: unknown, ctx: Record<string, unknown>): unknown {
  const node = compileSimpleCondition({ field, operator, value })
  return exprTreeEvaluator.evaluate(node, objectContext(ctx)).value
}

describe('Simple projection - comparison operators (6)', () => {
  it('eq: string equality', () => {
    expect(ev('eq', 'tool.name', 'read_file', { tool: { name: 'read_file' } })).toBe(true)
    expect(ev('eq', 'tool.name', 'read_file', { tool: { name: 'write_file' } })).toBe(false)
  })
  it('ne: inequality', () => {
    expect(ev('ne', 'tool.name', 'read_file', { tool: { name: 'write_file' } })).toBe(true)
    expect(ev('ne', 'tool.name', 'read_file', { tool: { name: 'read_file' } })).toBe(false)
  })
  it('gt/gte/lt/lte: numeric ordering', () => {
    const c = { amount: 500 }
    expect(ev('gt', 'amount', 300, c)).toBe(true)
    expect(ev('gt', 'amount', 500, c)).toBe(false)
    expect(ev('gte', 'amount', 500, c)).toBe(true)
    expect(ev('lt', 'amount', 600, c)).toBe(true)
    expect(ev('lte', 'amount', 500, c)).toBe(true)
  })
  it('strict typing: "500" is not > 300 (no implicit conversion)', () => {
    expect(ev('gt', 'amount', 300, { amount: '500' })).toBe(false)
    expect(ev('eq', 'amount', 500, { amount: '500' })).toBe(false)
  })
})

describe('Simple projection - list operators (2)', () => {
  it('in / not_in: array membership', () => {
    const c = { country: 'CN' }
    expect(ev('in', 'country', ['CN', 'US'], c)).toBe(true)
    expect(ev('in', 'country', ['US', 'JP'], c)).toBe(false)
    expect(ev('not_in', 'country', ['US', 'JP'], c)).toBe(true)
    expect(ev('not_in', 'country', ['CN', 'US'], c)).toBe(false)
  })
})

describe('Simple projection - string operators (5)', () => {
  const c = { path: '/etc/passwd' }
  it('contains / not_contains', () => {
    expect(ev('contains', 'path', 'passwd', c)).toBe(true)
    expect(ev('contains', 'path', 'shadow', c)).toBe(false)
    expect(ev('not_contains', 'path', 'shadow', c)).toBe(true)
  })
  it('starts_with / ends_with', () => {
    expect(ev('starts_with', 'path', '/etc', c)).toBe(true)
    expect(ev('ends_with', 'path', 'passwd', c)).toBe(true)
    expect(ev('starts_with', 'path', 'etc', c)).toBe(false)
  })
  it('match: regex, case-sensitive', () => {
    expect(ev('match', 'path', '^/etc/.*', c)).toBe(true)
    expect(ev('match', 'path', '^/ETC/.*', c)).toBe(false)
  })
})

describe('Simple projection - boundary negation (2)', () => {
  const c = { name: 'read_file' }
  it('not_starts_with / not_ends_with', () => {
    expect(ev('not_starts_with', 'name', 'write', c)).toBe(true)
    expect(ev('not_ends_with', 'name', 'folder', c)).toBe(true)
  })
})

describe('Simple projection - existence (2)', () => {
  it('exists / not_exists', () => {
    expect(ev('exists', 'tool.name', undefined, { tool: { name: 'x' } })).toBe(true)
    expect(ev('exists', 'tool.name', undefined, {})).toBe(false)
    expect(ev('not_exists', 'tool.name', undefined, {})).toBe(true)
    // empty string / 0 / false are all "existing" (exists != non-empty)
    expect(ev('exists', 'v', undefined, { v: '' })).toBe(true)
    expect(ev('exists', 'v', undefined, { v: 0 })).toBe(true)
  })
})

describe('Simple projection - length (5)', () => {
  it('length_eq / length_gt / length_gte / length_lt / length_lte', () => {
    const c = { tags: ['a', 'b', 'c'] }
    expect(ev('length_eq', 'tags', 3, c)).toBe(true)
    expect(ev('length_gt', 'tags', 2, c)).toBe(true)
    expect(ev('length_gte', 'tags', 3, c)).toBe(true)
    expect(ev('length_lt', 'tags', 4, c)).toBe(true)
    expect(ev('length_lte', 'tags', 3, c)).toBe(true)
  })
})

describe('Simple projection - range (2)', () => {
  const c = { amount: 800 }
  it('between / not_between (closed interval, numeric only)', () => {
    expect(ev('between', 'amount', [500, 1000], c)).toBe(true)
    expect(ev('between', 'amount', [1000, 2000], c)).toBe(false)
    expect(ev('not_between', 'amount', [1000, 2000], c)).toBe(true)
    expect(ev('between', 'amount', [500, 1000], { amount: '800' })).toBe(false)
  })
})

describe('Simple projection - count (4)', () => {
  const c = { items: [1, 2, 3, 4] }
  it('count_eq / count_gt / count_gte / count_lt / count_lte', () => {
    expect(ev('count_gt', 'items', 3, c)).toBe(true)
    expect(ev('count_gte', 'items', 4, c)).toBe(true)
    expect(ev('count_lt', 'items', 5, c)).toBe(true)
    expect(ev('count_lte', 'items', 4, c)).toBe(true)
  })
})

describe('Evaluation semantics - null propagation (E11)', () => {
  it('missing field -> false for every operator except exists/not_exists', () => {
    const empty = {}
    // comparison
    expect(ev('eq', 'x', 1, empty)).toBe(false)
    expect(ev('gt', 'x', 1, empty)).toBe(false)
    // derived operators fold false via exists guard (not fail-open)
    expect(ev('not_contains', 'x', 'a', empty)).toBe(false)
    expect(ev('length_gt', 'x', 0, empty)).toBe(false)
    expect(ev('count_gt', 'x', 0, empty)).toBe(false)
    expect(ev('not_between', 'x', [0, 1], empty)).toBe(false)
  })
})

describe('Evaluation semantics - strict typing (E1)', () => {
  it('cross-type comparison returns false', () => {
    expect(ev('gt', 'v', 5, { v: '10' })).toBe(false)
    expect(ev('eq', 'v', 10, { v: '10' })).toBe(false)
    expect(ev('lt', 'v', 10, { v: true })).toBe(false)
  })
  it('same-type string comparison uses Unicode code-point order', () => {
    // "2" > "10" lexicographically (code-point order)
    expect(ev('gt', 'v', '10', { v: '2' })).toBe(true)
  })
})
