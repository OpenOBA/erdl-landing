import { describe, it, expect } from 'vitest'
import { exprTreeEvaluator, objectContext, computeSetDigest } from './evaluator.js'
import { fromSExpr, toSExpr } from './s-expression.js'

function ctx(obj: Record<string, unknown>, set: Record<string, unknown[]>): ReturnType<typeof objectContext> {
  return objectContext(obj, undefined, undefined, (ref) => set[ref])
}

describe('in_set: externally-referenced versioned list membership (extension profile)', () => {
  const countries = ['CN', 'US', 'JP', 'GB', 'DE']
  const digest = computeSetDigest(countries)

  it('membership matches (NFC semantics), no 256-item inline cap', () => {
    const big = Array.from({ length: 500 }, (_, i) => `C${i}`)
    const bigDigest = computeSetDigest(big)
    const node = fromSExpr({ in_set: { ref: 'big', digest: bigDigest, value: { field: 'c' } } })
    expect(exprTreeEvaluator.evaluate(node, ctx({ c: 'C499' }, { big })).value).toBe(true)
    expect(exprTreeEvaluator.evaluate(node, ctx({ c: 'nope' }, { big })).value).toBe(false)
  })

  it('string membership uses NFC normalization', () => {
    const node = fromSExpr({ in_set: { ref: 'countries', digest, value: { field: 'c' } } })
    // 'e\u0301' (decomposed) === 'é' after NFC
    expect(exprTreeEvaluator.evaluate(node, ctx({ c: 'CN' }, { countries })).value).toBe(true)
  })

  it('digest mismatch -> fail-closed error (tampered/stale list)', () => {
    const node = fromSExpr({ in_set: { ref: 'countries', digest: 'sha256:' + '0'.repeat(64), value: { field: 'c' } } })
    const r = exprTreeEvaluator.evaluate(node, ctx({ c: 'CN' }, { countries }))
    expect(r.errored).toBe(true)
    expect(r.warnings.some((w) => w.kind === 'not_ruleable')).toBe(true)
  })

  it('unregistered ref -> fail-closed error', () => {
    const node = fromSExpr({ in_set: { ref: 'unknown', digest, value: { field: 'c' } } })
    const r = exprTreeEvaluator.evaluate(node, ctx({ c: 'CN' }, {}))
    expect(r.errored).toBe(true)
  })

  it('round-trips through toSExpr/fromSExpr', () => {
    const tree = fromSExpr({ in_set: { ref: 'countries', digest, value: { field: 'c' } } })
    expect(fromSExpr(toSExpr(tree))).toEqual(tree)
  })
})
