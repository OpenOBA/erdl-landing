/**
 * gloss-decision-table.spec.ts - decision table gloss rendering regression tests
 */
import { renderDecisionTableGloss } from './gloss.js';

describe('renderDecisionTableGloss', () => {
  const table = {
    columns: ['category'],
    rows: [
      { conditions: { category: 'A' }, decision: 'ALLOW' },
      { conditions: { category: 'B' }, decision: 'ALLOW' },
      { conditions: { category: 'C' }, decision: 'DENY' },
    ],
  };

  it('renders zh gloss: rows joined by the full-width semicolon separator', () => {
    const gloss = renderDecisionTableGloss(table, 'zh');
    expect(gloss).toContain('当 category 为 "A" 时，放行');
    expect(gloss).toContain('当 category 为 "C" 时，拒绝');
    expect(gloss).toContain('；'); // row separator
  });

  it('injects fieldNames to display the Chinese display_name', () => {
    const gloss = renderDecisionTableGloss(table, 'zh', { category: '类别' });
    expect(gloss).toContain('当 类别 为 "A" 时，放行');
    expect(gloss).not.toContain('category 为');
  });

  it('renders en gloss', () => {
    const gloss = renderDecisionTableGloss(table, 'en');
    expect(gloss).toContain('When category is "A", allow');
  });
});
