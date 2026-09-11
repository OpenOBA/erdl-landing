/**
 * audit-regression.spec.ts - regression tests for audit fixes that previously
 * had no test coverage (empty checks / missing assertions).
 *
 * Covers: B4 load-time validation (when string / expr+conditions mutual
 * exclusion / metadata.name), S6 top-level format, N5 duplicate-id rejection,
 * S2 quantifier type_mismatch warning, S5 over-limit `in` not-flip under `not`.
 */
import { describe, it, expect } from 'vitest';
import { parseErdlDocument } from './erdl-loader.js';
import { exprTreeEvaluator, objectContext } from './expr-tree/evaluator.js';
import type { ExprNode } from './expr-tree/node-types.js';
import { canonicalTree, hashTreeWithPrefix } from './expr-tree/canonical.js';
import { enforceLimits, ExprLimitError } from './expr-tree/limits.js';
import { normalizeOperator } from './expr-tree/rule-to-expr.js';
import { Evaluator } from './evaluator.js';

describe('B4 load-time validation', () => {
  it('rejects when: "false" (only "true" is a legal catch-all string)', () => {
    expect(() =>
      parseErdlDocument(`
protocol: "erdl/v2"
version: "2.0.0"
metadata: { name: "x", decision: ALLOW }
rules:
  - name: "SEC-100-false"
    when: "false"
    then: ALLOW
`),
    ).toThrow(/only "true" is allowed/);
  });

  it('rejects a typo when: "ture" (E5)', () => {
    expect(() =>
      parseErdlDocument(`
protocol: "erdl/v2"
version: "2.0.0"
metadata: { name: "x", decision: ALLOW }
rules:
  - name: "SEC-100-ture"
    when: "ture"
    then: ALLOW
`),
    ).toThrow(/only "true" is allowed/);
  });

  it('rejects when with both expr and conditions (E5 mutual exclusion)', () => {
    expect(() =>
      parseErdlDocument(`
protocol: "erdl/v2"
version: "2.0.0"
metadata: { name: "x", decision: ALLOW }
rules:
  - name: "SEC-101-both"
    when:
      expr: { eq: [{ field: "a" }, 1] }
      conditions:
        - field: "a"
          operator: eq
          value: 1
    then: ALLOW
`),
    ).toThrow(/both "expr" and "conditions"/);
  });

  it('rejects an empty metadata.name (MUST field)', () => {
    expect(() =>
      parseErdlDocument(`
protocol: "erdl/v2"
version: "2.0.0"
metadata: { name: "" }
rules: []
`),
    ).toThrow(/Missing or empty metadata.name/);
  });
});

describe('S6 top-level format validation', () => {
  it('rejects an unknown top-level field', () => {
    expect(() =>
      parseErdlDocument(`
protocol: "erdl/v2"
version: "2.0.0"
metadata: { name: "x" }
extra_field: 1
rules: []
`),
    ).toThrow(/Unknown top-level field "extra_field"/);
  });
});

describe('N5 duplicate-id rejection', () => {
  it('rejects two names that deriveId-collide (SEC-001-a_b vs SEC-001-a-b)', () => {
    expect(() =>
      parseErdlDocument(`
protocol: "erdl/v2"
version: "2.0.0"
metadata: { name: "x", decision: ALLOW }
rules:
  - name: "SEC-001-a_b"
    when: "true"
    then: ALLOW
  - name: "SEC-001-a-b"
    when: "true"
    then: ALLOW
`),
    ).toThrow(/Duplicate rule id/);
  });
});

describe('S2 quantifier over non-array', () => {
  it('records a type_mismatch warning and folds false (not an error)', () => {
    const node: ExprNode = {
      type: 'quantifier',
      kind: 'any',
      over: { type: 'literal', value: 42 }, // scalar, not an array
      predicate: { type: 'literal', value: true },
    };
    const r = exprTreeEvaluator.evaluate(node, objectContext({}));
    expect(r.errored).toBe(false);
    expect(r.value).toBe(false);
    expect(r.warnings.some((w) => w.kind === 'type_mismatch')).toBe(true);
  });
});

describe('S5 over-limit in is not flipped by not', () => {
  const bigList = Array.from({ length: 257 }, (_, i) => i);
  const inNode: ExprNode = { type: 'in', left: { type: 'literal', value: 1 }, right: { type: 'literal', value: bigList } };

  it('in over 256 items folds false with array_over_limit', () => {
    const r = exprTreeEvaluator.evaluate(inNode, objectContext({}));
    expect(r.value).toBe(false);
    expect(r.errored).toBe(false);
    expect(r.warnings.some((w) => w.kind === 'array_over_limit')).toBe(true);
  });

  it('not(in over 256) stays false (no fail-open flip)', () => {
    const notNode: ExprNode = { type: 'not', arg: inNode };
    const r = exprTreeEvaluator.evaluate(notNode, objectContext({}));
    expect(r.value).toBe(false);
    expect(r.errored).toBe(false);
  });
});

describe('B6 canonical number encoding (JCS IEEE 754)', () => {
  it('a number literal canonicalizes as a bare JCS number (not a fixed-point string)', () => {
    expect(canonicalTree({ type: 'literal', value: 1 })).toBe('1');
    expect(canonicalTree({ type: 'literal', value: 0.15 })).toBe('0.15');
  });

  it('numbers and strings are strictly distinguished in the hash', () => {
    const numHash = hashTreeWithPrefix({ type: 'literal', value: 1 });
    const strHash = hashTreeWithPrefix({ type: 'literal', value: '1' });
    expect(numHash).not.toBe(strHash);
    expect(numHash.startsWith('sha256:')).toBe(true);
    expect(numHash.length).toBe(71);
  });
});

describe('S1 grade-parameterized resource limits', () => {
  const nest = (n: number): ExprNode => {
    let t: ExprNode = { type: 'field', field: 'x' };
    for (let i = 0; i < n; i++) t = { type: 'not', arg: t };
    return t;
  };

  it('grade A rejects a tree deeper than 6 (auto-derived: simple-only)', () => {
    expect(() => enforceLimits(nest(7))).toThrow(ExprLimitError);
  });

  it('explicit grade B accepts depth 8 (limit 10)', () => {
    expect(() => enforceLimits(nest(8), 'B')).not.toThrow();
  });

  it('explicit grade A still rejects depth 8', () => {
    expect(() => enforceLimits(nest(8), 'A')).toThrow(ExprLimitError);
  });
});

describe('N1 operator-alias normalization for counter keys', () => {
  it('matches -> match, neq -> ne', () => {
    expect(normalizeOperator('matches')).toBe('match');
    expect(normalizeOperator('neq')).toBe('ne');
    expect(normalizeOperator('eq')).toBe('eq');
    expect(normalizeOperator(undefined)).toBeNull();
  });
});

describe('S4 unless exemption is a skip, not a decision', () => {
  it('an unless-exempted rule does not override the metadata fallback', () => {
    const rule = {
      id: 'T', name: 't',
      conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec' }],
      conditionLogic: 'AND' as const,
      action: { decision: 'DENY' as const, reason: 't' },
      priority: 1, enabled: true,
      unless: {
        logic: 'AND' as const,
        conditions: [{ field: 'context.role', operator: 'eq', value: 'admin' }],
      },
    };
    const evaluator = new Evaluator();
    const result = evaluator.evaluate(
      [rule],
      { tool: { name: 'exec' }, context: { role: 'admin' } },
      { fallbackDecision: 'DENY' },
    );
    // the rule is exempted (skip), so the fallback chain (metadata.decision=DENY) applies
    expect(result.decision).toBe('DENY');
    expect(result.unlessExemptions).toHaveLength(1);
    expect(result.matchedRules).toHaveLength(0);
  });
});

describe('S3 ordered string comparison: NFC + code-point order', () => {
  const cmp = (op: 'gt' | 'lt' | 'eq', a: string, b: string): unknown => {
    const node: ExprNode = { type: 'compare', op, left: { type: 'literal', value: a }, right: { type: 'literal', value: b } };
    return exprTreeEvaluator.evaluate(node, objectContext({})).value;
  };

  it('NFC: a decomposed string compares equal to its precomposed form', () => {
    // 'e\u0301' (decomposed) vs '\u00E9' (precomposed) — NFC normalizes both to U+00E9
    expect(cmp('eq', 'e\u0301', '\u00E9')).toBe(true);
    expect(cmp('lt', 'e\u0301', '\u00E9')).toBe(false);
    expect(cmp('gt', 'e\u0301', '\u00E9')).toBe(false);
  });

  it('surrogate pairs compare by code point, not UTF-16 code unit', () => {
    // '\uE000' (U+E000, BMP) vs '😀' (U+1F600, surrogate pair):
    // code-point order: U+E000 (57344) < U+1F600 (128512)  => '\uE000' < '😀'
    // UTF-16 code unit order: 0xE000 > 0xD83D (high surrogate) => would say '\uE000' > '😀' (wrong)
    expect(cmp('lt', '\uE000', '😀')).toBe(true);
    expect(cmp('gt', '\uE000', '😀')).toBe(false);
  });
});

describe('B2 tiered fail-close (E12)', () => {
  const errRule = (tier?: number) => ({
    id: 'T', name: 't', description: '', category: 'security' as const,
    conditions: [{ expr: { gt: [{ epoch_ms: { field: 't' } }, 1767229200000 - 1000] } }],
    conditionLogic: 'AND' as const,
    action: { decision: 'DENY' as const, reason: 't' },
    priority: 1, enabled: true,
    ...(tier !== undefined ? { tier } : {}),
  });

  it('tier unspecified (default <=2) folds to DENY (fail-close)', () => {
    const r = new Evaluator().evaluate([errRule()], { t: '2026-02-30' });
    expect(r.decision).toBe('DENY');
    expect(r.errored).toBe(true);
  });

  it('tier 3 folds to false (no fail-close), falling through to fallback', () => {
    const r = new Evaluator().evaluate([errRule(3)], { t: '2026-02-30' }, { fallbackDecision: 'ALLOW' });
    expect(r.decision).toBe('ALLOW');
    expect(r.errored).toBeUndefined();
    expect(r.matchedRules).toHaveLength(0);
  });
});
