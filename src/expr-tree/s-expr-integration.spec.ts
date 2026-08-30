/**
 * s-expr-integration.spec.ts - regression tests for three S-expression integration fixes
 *
 * Verifies the root-cause fixes:
 * 1. jsonWhenToExpr recognizes S-expressions (adds fromSExpr) -> gloss is no longer always-true
 * 2. isSExprWhen form detection: S-expression vs flat {logic, conditions}
 * 3. rule-yaml-serializer serialization of S-expression when (not collapsing to logic: AND)
 */

import { jsonWhenToExpr } from './rule-to-expr.js';
import { fromSExpr, isSExprWhen, extractWhenExpr, toSExpr } from './s-expression.js';
import { renderGloss } from './gloss.js';
import { deriveGradeFromTree } from './grade.js';
import { RuleYamlSerializer } from '../rule-yaml-serializer.js';
import * as YAML from 'yaml';

describe('S-expression expression-tree integration', () => {
  const whenTree = {
    lt: [
      {
        div: [{ sub: [{ field: 'tool.args.price' }, { field: 'context.cost' }] }, { field: 'tool.args.price' }],
      },
      0.15,
    ],
  };

  const whenFlat = { logic: 'AND', conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec' }] };

  describe('isSExprWhen form detection', () => {
    it('S-expression tree -> true', () => {
      expect(isSExprWhen(whenTree)).toBe(true);
    });

    it('flat conditions -> false', () => {
      expect(isSExprWhen(whenFlat)).toBe(false);
    });

    it('null / string / array -> false', () => {
      expect(isSExprWhen(null)).toBe(false);
      expect(isSExprWhen('true')).toBe(false);
      expect(isSExprWhen([1, 2])).toBe(false);
    });
  });

  describe('jsonWhenToExpr adds fromSExpr', () => {
    it('S-expression when -> correctly parsed as a tree, gloss no longer always-true', () => {
      const tree = jsonWhenToExpr(whenTree);
      if (tree === null) throw new Error('jsonWhenToExpr returned null');
      const gloss = renderGloss(tree, 'REQUEST_HUMAN', 'zh');
      // should not be the always-true "when true"
      expect(gloss).not.toContain('当 true 时');
      // should contain the price field and comparison semantics
      expect(gloss).toContain('tool.args.price');
    });

    it('flat when -> still takes the Simple compilation path (compatible)', () => {
      const tree = jsonWhenToExpr(whenFlat);
      if (tree === null) throw new Error('jsonWhenToExpr returned null');
      // flat compilation produces a compare node
      expect(toSExpr(tree)).toEqual({ eq: [{ field: 'tool.name' }, 'exec'] });
    });

    it('S-expression with time operation -> grade B (extension node)', () => {
      const timeWhen = { days_between: [{ field: 'a' }, { field: 'b' }] };
      const tree = jsonWhenToExpr(timeWhen);
      if (tree === null) throw new Error('jsonWhenToExpr returned null');
      const grade = deriveGradeFromTree(tree, false);
      expect(grade).toBe('B');
    });
  });

  describe('RuleYamlSerializer serialization of S-expression when', () => {
    const serializer = new RuleYamlSerializer('/tmp/rules-test');

    it('S-expression when -> YAML preserves tree structure (no logic: AND)', () => {
      // verify via the full toSpec5Yaml chain (calls the private method)
      const fakeRule = {
        content: {
          protocol: 'erdl/v2',
          version: '2.0.0',
          metadata: { name: 'price-margin', description: '', category: 'compliance', decision: 'REQUEST_HUMAN' },
          rules: [
            {
              name: 'price-margin',
              priority: 100,
              when: whenTree,
              then: 'REQUEST_HUMAN',
              message: 'margin below 15%',
            },
          ],
        },
      } as unknown as Parameters<RuleYamlSerializer['toSpec5Yaml']>[0];

      const yaml = serializer.toSpec5Yaml(fakeRule);
      // must not contain logic: AND (that marks the flat structure)
      expect(yaml).not.toContain('logic: AND');
      // should contain the S-expression node keys
      expect(yaml).toContain('lt:');
      expect(yaml).toContain('div:');
      expect(yaml).toContain('field:');
    });

    it('S-expression YAML parses back to a when tree (valid standard rule file)', () => {
      const fakeRule = {
        content: {
          protocol: 'erdl/v2',
          version: '2.0.0',
          metadata: { name: 'm', description: '', category: 'compliance', decision: 'REQUEST_HUMAN' },
          rules: [{ name: 'm', priority: 100, when: whenTree, then: 'REQUEST_HUMAN', message: 'margin < 15%' }],
        },
      } as unknown as Parameters<RuleYamlSerializer['toSpec5Yaml']>[0];

      const yaml = serializer.toSpec5Yaml(fakeRule);
      const parsed = YAML.parse(yaml) as { rules: Array<{ when: unknown }> };
      // parsed when should be structurally equivalent to the original S-expression tree
      expect(parsed.rules[0].when).toEqual(whenTree);
    });

    it('flat when -> YAML preserves logic/conditions (compatible)', () => {
      const fakeRule = {
        content: {
          protocol: 'erdl/v2',
          version: '2.0.0',
          metadata: { name: 'flat', description: '', category: 'security', decision: 'DENY' },
          rules: [
            {
              name: 'flat',
              priority: 100,
              when: whenFlat,
              then: 'DENY',
              message: 'block exec',
            },
          ],
        },
      } as unknown as Parameters<RuleYamlSerializer['toSpec5Yaml']>[0];

      const yaml = serializer.toSpec5Yaml(fakeRule);
      expect(yaml).toContain('logic: AND');
      expect(yaml).toContain('conditions:');
    });
  });

  describe('when.expr wrapped form (Sec. 5.3 Expression)', () => {
    it('extractWhenExpr recognizes { expr: tree } -> returns the tree S-expression', () => {
      const whenExprWrap = { expr: whenTree };
      const val = extractWhenExpr(whenExprWrap);
      expect(val).toEqual(whenTree);
    });

    it('extractWhenExpr recognizes when top-level as tree (compatible)', () => {
      const val = extractWhenExpr(whenTree);
      expect(val).toEqual(whenTree);
    });

    it('extractWhenExpr on flat conditions -> null', () => {
      expect(extractWhenExpr(whenFlat)).toBeNull();
    });

    it('isSExprWhen on { expr: tree } wrap -> false (when-level structure, not a pure tree)', () => {
      expect(isSExprWhen({ expr: whenTree })).toBe(false);
    });

    it('jsonWhenToExpr recognizes when.expr wrap -> correctly builds tree + gloss', () => {
      const tree = jsonWhenToExpr({ expr: whenTree });
      if (tree === null) throw new Error('jsonWhenToExpr returned null');
      const gloss = renderGloss(tree, 'REQUEST_HUMAN', 'zh');
      expect(gloss).toContain('tool.args.price');
    });

    it('RuleYamlSerializer serializes when.expr -> YAML contains expr key', () => {
      const fakeRule = {
        content: {
          protocol: 'erdl/v2',
          version: '2.0.0',
          metadata: { name: 'm', description: '', category: 'compliance', decision: 'REQUEST_HUMAN' },
          rules: [{ name: 'm', priority: 100, when: { expr: whenTree }, then: 'REQUEST_HUMAN', message: 'margin < 15%' }],
        },
      } as unknown as Parameters<RuleYamlSerializer['toSpec5Yaml']>[0];

      const yaml = new RuleYamlSerializer('/tmp/rules-test').toSpec5Yaml(fakeRule);
      expect(yaml).toContain('expr:');
      expect(yaml).toContain('lt:');
      expect(yaml).not.toContain('logic: AND');
      // when.expr should round-trip after YAML parse
      const parsed = YAML.parse(yaml) as { rules: Array<{ when: { expr: unknown } }> };
      expect(parsed.rules[0].when.expr).toEqual(whenTree);
    });

    it('time-operation when.expr (time-window example) -> grade B + correct gloss', () => {
      // time window: start_date within [effective_date, effective_date + 30 days] and category is C
      const waiverWhen = {
        expr: {
          and: [
            { gte: [{ field: 'start_date' }, { date_add: { unit: 'days', base: { field: 'effective_date' }, amount: 0 } }] },
            { lte: [{ field: 'start_date' }, { date_add: { unit: 'days', base: { field: 'effective_date' }, amount: 30 } }] },
            { eq: [{ field: 'category' }, 'C'] },
          ],
        },
      };
      const tree = jsonWhenToExpr(waiverWhen);
      if (tree === null) throw new Error('jsonWhenToExpr returned null');
      expect(deriveGradeFromTree(tree, false)).toBe('B');
      const gloss = renderGloss(tree, 'DENY', 'zh');
      // gloss should contain time and category conditions, not a magic string
      expect(gloss).toContain('30');
    });

    it('nested date_add serialization -> no [object Object], base correctly expanded', () => {
      const waiverWhen = {
        expr: {
          and: [
            { gte: [{ field: 'effective_date' }, { date_add: { unit: 'days', base: { field: 'effective_date' }, amount: 0 } }] },
            { lte: [{ field: 'effective_date' }, { date_add: { unit: 'years', base: { field: 'effective_date' }, amount: 1 } }] },
          ],
        },
      };
      const fakeRule = {
        content: {
          protocol: 'erdl/v2', version: '2.0.0',
          metadata: { name: 'm', description: '', category: 'compliance', decision: 'ALLOW' },
          rules: [{ name: 'm', priority: 100, when: waiverWhen, then: 'ALLOW', message: 'x' }],
        },
      } as unknown as Parameters<RuleYamlSerializer['toSpec5Yaml']>[0];
      const yaml = new RuleYamlSerializer('/tmp/x').toSpec5Yaml(fakeRule);
      // key: no JS [object Object]
      expect(yaml).not.toContain('[object Object]');
      expect(yaml).toContain('date_add:');
      expect(yaml).toContain('base:');
      expect(yaml).toContain('effective_date');
      expect(yaml).toContain('unit: days');
      expect(yaml).toContain('amount: 0');
    });
  });

  describe('roundtrip: toSExpr -> fromSExpr structural equivalence', () => {
    it('S-expression tree roundtrip stays consistent', () => {
      const node = fromSExpr(whenTree);
      expect(toSExpr(node)).toEqual(whenTree);
    });
  });
});
