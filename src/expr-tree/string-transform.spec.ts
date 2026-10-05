import { describe, it, expect } from 'vitest'
import { exprTreeEvaluator, objectContext } from './evaluator.js'
import { fromSExpr, toSExpr } from './s-expression.js'
import { UNKNOWN } from './eval-warning.js'

/** Evaluate an S-expression tree against a context object, returning the value. */
function ev(sexpr: unknown, ctx: Record<string, unknown>): unknown {
  return exprTreeEvaluator.evaluate(fromSExpr(sexpr), objectContext(ctx)).value
}

describe('String normalization - string_transform (casefold/trim/path_normalize)', () => {
  it('casefold: Unicode simple case folding enables case-insensitive match', () => {
    // casefold("John Doe") eq "john doe"
    expect(ev({ eq: [{ casefold: { field: 'name' } }, 'john doe'] }, { name: 'John Doe' })).toBe(true)
    expect(ev({ eq: [{ casefold: { field: 'name' } }, 'john doe'] }, { name: 'JANE DOE' })).toBe(false)
    // match on a casefolded field is case-insensitive
    expect(ev({ match: [{ casefold: { field: 'path' } }, '^/etc/.*'] }, { path: '/Etc/Passwd' })).toBe(true)
  })

  it('trim: strips leading/trailing whitespace', () => {
    expect(ev({ eq: [{ trim: { field: 'code' } }, 'CN'] }, { code: '  CN  ' })).toBe(true)
    expect(ev({ eq: [{ trim: { field: 'code' } }, 'CN'] }, { code: 'CN\n' })).toBe(true)
  })

  it('path_normalize: POSIX lexical normalization (unify separators, resolve ./..)', () => {
    // \ -> /, collapse repeats, resolve . and ..
    expect(ev({ eq: [{ path_normalize: { field: 'p' } }, '/a/b'] }, { p: '/a/./b' })).toBe(true)
    expect(ev({ eq: [{ path_normalize: { field: 'p' } }, '/b'] }, { p: '/a/../b' })).toBe(true)
    expect(ev({ eq: [{ path_normalize: { field: 'p' } }, '/a/b'] }, { p: '\\a\\b' })).toBe(true)
    // relative path with unresolvable .. is preserved
    expect(ev({ eq: [{ path_normalize: { field: 'p' } }, '../b'] }, { p: 'a/../../b' })).toBe(true)
  })

  it('non-string operand -> null (type_mismatch warning, safe fold)', () => {
    // casefold on a non-string returns null (type_mismatch warning)
    const r = exprTreeEvaluator.evaluate(fromSExpr({ casefold: { field: 'n' } }), objectContext({ n: 42 }))
    expect(r.value).toBe(null)
    expect(r.warnings.some((w) => w.kind === 'type_mismatch')).toBe(true)
    // eq null == 'x' is three-valued UNKNOWN (null propagation, never flips via not)
    expect(ev({ eq: [{ casefold: { field: 'n' } }, 'x'] }, { n: 42 })).toBe(UNKNOWN)
  })

  it('round-trips through toSExpr/fromSExpr', () => {
    const tree = fromSExpr({ eq: [{ casefold: { field: 'name' } }, 'x'] })
    const back = fromSExpr(toSExpr(tree))
    expect(back).toEqual(tree)
  })
})
