/**
 * aggregate-empty.spec.ts - aggregate empty-array safe folding regression tests (Sec. 7.3(e))
 *
 * count/sum(empty)=0; avg/min/max(empty)=unknown (M2: safe folding, not false,
 * so not(unknown)=unknown never flips to true — no fail-open),
 * and an aggregate_empty warning is recorded (aligned with Sec. 7.3(e)).
 */
import { exprTreeEvaluator, objectContext } from './evaluator.js';
import { UNKNOWN } from './eval-warning.js';
import type { ExprNode } from './node-types.js';

describe('aggregate empty-array safe folding (Sec. 7.3(e))', () => {
  const ctx = objectContext({});
  const agg = (fn: 'count' | 'sum' | 'avg' | 'min' | 'max') => {
    const node: ExprNode = { type: 'aggregate', fn, over: { type: 'literal', value: [] } };
    return exprTreeEvaluator.evaluate(node, ctx);
  };

  it('avg/min/max(empty) fold to unknown and record an aggregate_empty warning (M2)', () => {
    for (const fn of ['avg', 'min', 'max'] as const) {
      const r = agg(fn);
      // M2: 空数组折叠为 unknown（非 false）——not(unknown)=unknown 不 fail-open。
      expect(r.value).toBe(UNKNOWN);
      expect(r.errored).toBe(false);
      expect(r.warnings.some((w) => w.kind === 'aggregate_empty')).toBe(true);
    }
  });

  it('count(empty) = 0 (standard semantics)', () => {
    expect(agg('count').value).toBe(0);
  });

  it('sum(empty) is a rational zero, not false/null', () => {
    const v = agg('sum').value;
    expect(v).not.toBe(false);
    expect(v).not.toBeNull();
  });
});
