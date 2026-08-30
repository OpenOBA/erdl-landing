/**
 * verify-gloss-full.spec.ts - gloss end-to-end verification (agent runtime fields + decision table + business fields)
 */
import { AGENT_RUNTIME_FIELD_NAME_MAP, DEFAULT_FIELD_CONTRACTS, buildFieldNameMap } from './field-contracts.js';
import { renderGloss, renderNode } from './expr-tree/gloss.js';
import type { ExprNode } from './expr-tree/node-types.js';
import { jsonWhenToExpr } from './expr-tree/rule-to-expr.js';

describe('gloss end-to-end verification', () => {
  it('agent runtime field tool.name resolves to its Chinese display name', () => {
    const when = { logic: 'AND', conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec' }] };
    const tree = jsonWhenToExpr(when);
    if (tree === null) throw new Error('jsonWhenToExpr returned null');
    const gloss = renderGloss(tree, 'DENY', 'zh', AGENT_RUNTIME_FIELD_NAME_MAP);
    expect(gloss).toContain('工具名');
    expect(gloss).not.toContain('tool.name 等于');
  });

  it('business fields amount/date resolve to their display names', () => {
    const when = { gte: [{ field: 'amount' }, { field: 'date' }] };
    const tree = jsonWhenToExpr(when);
    if (tree === null) throw new Error('jsonWhenToExpr returned null');
    const map = buildFieldNameMap(DEFAULT_FIELD_CONTRACTS);
    const gloss = renderGloss(tree, 'DENY', 'zh', map);
    expect(gloss).toContain('金额');
    expect(gloss).toContain('日期');
  });

  it('decision table verification (covered in gloss-decision-table.spec; type contract check here)', () => {
    // verify AGENT_RUNTIME_FIELD_NAME_MAP contains the tool-related fields
    expect(AGENT_RUNTIME_FIELD_NAME_MAP['tool.name']).toBe('工具名');
    expect(AGENT_RUNTIME_FIELD_NAME_MAP['tool.args']).toBe('工具参数');
    expect(AGENT_RUNTIME_FIELD_NAME_MAP['context.role']).toBe('角色');
  });

  it('arithmetic operators render as words (spec 5.5 template), not symbols', () => {
    const field = (name: string): ExprNode => ({ type: 'field', field: name });
    const arith = (op: 'add' | 'sub' | 'mul' | 'div' | 'round', args: ExprNode[]): ExprNode => ({ type: 'arith', op, args });
    expect(renderNode(arith('add', [field('price'), field('cost')]), 'zh')).toBe('(price 加 cost)');
    expect(renderNode(arith('add', [field('price'), field('cost')]), 'en')).toBe('(price plus cost)');
    expect(renderNode(arith('sub', [field('price'), field('cost')]), 'zh')).toBe('(price 减 cost)');
    expect(renderNode(arith('sub', [field('price'), field('cost')]), 'en')).toBe('(price minus cost)');
    expect(renderNode(arith('mul', [field('price'), field('cost')]), 'zh')).toBe('(price 乘 cost)');
    expect(renderNode(arith('mul', [field('price'), field('cost')]), 'en')).toBe('(price times cost)');
    expect(renderNode(arith('div', [field('price'), field('cost')]), 'zh')).toBe('(price 除以 cost)');
    expect(renderNode(arith('div', [field('price'), field('cost')]), 'en')).toBe('(price divided by cost)');
    expect(renderNode(arith('round', [field('price')]), 'zh')).toBe('price 四舍五入');
    expect(renderNode(arith('round', [field('price')]), 'en')).toBe('price rounded');
  });
});
