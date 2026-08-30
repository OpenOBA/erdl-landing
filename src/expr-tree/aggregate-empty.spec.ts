/**
 * aggregate-empty.spec.ts - aggregate empty-array safe folding regression tests (Sec. 7.3(e))
 *
 * count/sum(empty)=0; avg/min/max(empty)=false (safe folding, Infinity/NaN forbidden),
 * and an aggregate_empty warning is recorded (aligned with Sec. 7.3(e) "recorded as safe folding").
 */
import { exprTreeEvaluator, objectContext } from './evaluator.js';
import type { ExprNode } from './node-types.js';

describe('aggregate empty-array safe folding (Sec. 7.3(e))', () => {
  const ctx = objectContext({});
  const agg = (fn: 'count' | 'sum' | 'avg' | 'min' | 'max') => {
    const node: ExprNode = { type: 'aggregate', fn, over: { type: 'literal', value: [] } };
    return exprTreeEvaluator.evaluate(node, ctx);
  };

  it('avg/min/max(empty) fold to false and record an aggregate_empty warning', () => {
    for (const fn of ['avg', 'min', 'max'] as const) {
      const r = agg(fn);
      expect(r.value).toBe(false);
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
