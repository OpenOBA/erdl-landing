import { describe, it, expect } from 'vitest'
import { exprTreeEvaluator, objectContext } from './evaluator.js'
import type { ExprNode, QuantifierKind, ArithOp } from './node-types.js'

describe('Expression layer - quantifier safe folding (E8)', () => {
  const q = (kind: QuantifierKind, arr: unknown[]) => {
    const node: ExprNode = {
      type: 'quantifier',
      kind,
      binding: 'x',
      over: { type: 'literal', value: arr },
      predicate: { type: 'literal', value: true },
    }
    return exprTreeEvaluator.evaluate(node, objectContext({})).value
  }
  it('all/any/none on empty array all fold to false (anti-vacuous-truth)', () => {
    expect(q('all', [])).toBe(false)
    expect(q('any', [])).toBe(false)
    expect(q('none', [])).toBe(false)
  })
  it('any on non-empty array is true; all on non-empty with true predicate is true', () => {
    expect(q('any', [1])).toBe(true)
    expect(q('all', [1])).toBe(true)
  })
})

describe('Expression layer - arithmetic (E2 fixed-point rational)', () => {
  const arith = (op: ArithOp, args: unknown[]) => {
    const node: ExprNode = {
      type: 'arith',
      op,
      args: args.map((v) => ({ type: 'literal', value: v }) as ExprNode),
    }
    return exprTreeEvaluator.evaluate(node, objectContext({})).value as { num: bigint; den: bigint }
  }
  it('add / sub / mul / div produce exact rationals (no float precision loss)', () => {
    expect(arith('add', [1, 2])).toEqual({ num: 3n, den: 1n })
    expect(arith('sub', [5, 2])).toEqual({ num: 3n, den: 1n })
    expect(arith('mul', [2, 3])).toEqual({ num: 6n, den: 1n })
    expect(arith('div', [6, 2])).toEqual({ num: 3n, den: 1n })
  })
  it('div 1/3 stays an exact rational 1/3 (not binary-float 0.333...)', () => {
    expect(arith('div', [1, 3])).toEqual({ num: 1n, den: 3n })
  })
})

describe('Expression layer - time UTC semantics (E9)', () => {
  const daysBetween = (from: string, to: string) => {
    const node: ExprNode = {
      type: 'days_between',
      from: { type: 'literal', value: from },
      to: { type: 'literal', value: to },
    }
    return exprTreeEvaluator.evaluate(node, objectContext({})).value
  }
  it('days_between uses UTC floor of the millisecond difference', () => {
    expect(daysBetween('2026-01-01', '2026-01-04')).toBe(3)
    expect(daysBetween('2026-01-04', '2026-01-01')).toBe(-3)
  })
})

describe('Expression layer - strict ISO date parsing (E9 / §7.3(f) no-tz = UTC)', () => {
  const epochMs = (v: unknown) => {
    const node: ExprNode = { type: 'epoch_ms', arg: { type: 'literal', value: v } }
    return exprTreeEvaluator.evaluate(node, objectContext({})).value
  }
  const daysBetween = (from: unknown, to: unknown) => {
    const node: ExprNode = {
      type: 'days_between',
      from: { type: 'literal', value: from },
      to: { type: 'literal', value: to },
    }
    return exprTreeEvaluator.evaluate(node, objectContext({})).value
  }

  it('epoch_ms no-timezone datetime == explicit Z (UTC, independent of host timezone)', () => {
    // This is the cross-timezone determinism guarantee: no-tz must mean UTC, not local.
    expect(epochMs('2026-01-01T12:30:45')).toBe(epochMs('2026-01-01T12:30:45Z'))
    expect(epochMs('2026-01-01T12:30:45')).toBe(1767270645000)
  })

  it('epoch_ms honors explicit offsets (UTC = local - offset)', () => {
    expect(epochMs('2026-01-01T12:30:45+08:00')).toBe(1767241845000)
    expect(epochMs('2026-01-01T12:30:45-05:00')).toBe(1767288645000)
  })

  it('epoch_ms rejects non-ISO and invalid calendar dates (strict, invalid_date)', () => {
    expect(epochMs('Jan 1 2026')).toBeNull()
    expect(epochMs('2026/01/01')).toBeNull()
    expect(epochMs('2026-02-30')).toBeNull()
    expect(epochMs('2026-13-01')).toBeNull()
    expect(epochMs('2026-01-01T25:00:00')).toBeNull()
    expect(epochMs('not-a-date')).toBeNull()
    // fractional seconds are outside the deterministic subset (whole-second precision)
    expect(epochMs('2026-01-01T12:30:45.123Z')).toBeNull()
    expect(epochMs('2026-01-01T12:30:45.5')).toBeNull()
  })

  it('days_between with no-timezone datetime uses UTC', () => {
    expect(daysBetween('2026-01-01T00:00:00', '2026-01-02T00:00:00')).toBe(1)
    expect(daysBetween('2026-01-01T23:59:59', '2026-01-02T00:00:01')).toBe(0)
  })
})
