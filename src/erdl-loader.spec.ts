/**
 * erdl-loader.spec.ts - document loader (YAML -> RuleDefinition[]) tests.
 */
import { parseErdlDocument, loadErdlFile } from './erdl-loader.js';
import { Evaluator } from './evaluator.js';
import { RuleYamlSerializer } from './rule-yaml-serializer.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('parseErdlDocument', () => {
  const simpleDoc = `
protocol: "erdl/v2"
version: "2.0.0"
metadata:
  name: "refund-guard"
  description: "Refund amount control"
  category: coding
  decision: ALLOW
  tags: [example]
rules:
  - name: "SEC-001-refund-limit"
    description: "Refunds over 5000 require human approval"
    priority: 10
    override: high
    ring: 3
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: eq
          value: "issue_refund"
        - field: "tool.args.amount"
          operator: gt
          value: 5000
    then: REQUEST_HUMAN
    message: "Refund amount over 5000, human approval required"
`;

  it('parses metadata', () => {
    const doc = parseErdlDocument(simpleDoc);
    expect(doc.protocol).toBe('erdl/v2');
    expect(doc.version).toBe('2.0.0');
    expect(doc.metadata.name).toBe('refund-guard');
    expect(doc.metadata.category).toBe('coding');
    expect(doc.metadata.decision).toBe('ALLOW');
    expect(doc.metadata.tags).toEqual(['example']);
  });

  it('maps a Simple rule to RuleDefinition', () => {
    const doc = parseErdlDocument(simpleDoc);
    expect(doc.rules).toHaveLength(1);
    const r = doc.rules[0]!;
    expect(r.id).toBe('sec_001_refund_limit');
    expect(r.name).toBe('SEC-001-refund-limit');
    expect(r.category).toBe('coding');
    expect(r.priority).toBe(10);
    expect(r.enabled).toBe(true);
    expect(r.override).toBe('high');
    expect(r.action.decision).toBe('REQUEST_HUMAN');
    expect(r.action.reason).toBe('Refund amount over 5000, human approval required');
    expect(r.action.ring).toBe(3);
    expect(r.conditionLogic).toBe('AND');
    expect(r.conditions).toHaveLength(2);
    expect(r.conditions[0]).toMatchObject({ field: 'tool.name', operator: 'eq', value: 'issue_refund' });
    expect(r.conditions[1]).toMatchObject({ field: 'tool.args.amount', operator: 'gt', value: 5000 });
  });

  it('maps the Expression form (when.expr) to a single expr condition', () => {
    const doc = parseErdlDocument(`
protocol: "erdl/v2"
version: "2.0.0"
metadata: { name: "x", decision: DENY }
rules:
  - name: "EXPR-001"
    when:
      expr: { eq: [{ field: "a" }, 1] }
    then: DENY
`);
    expect(doc.rules[0]!.conditions).toHaveLength(1);
    expect(doc.rules[0]!.conditions[0]!.expr).toEqual({ eq: [{ field: 'a' }, 1] });
  });

  it('maps when: "true" to empty conditions (catch-all)', () => {
    const doc = parseErdlDocument(`
protocol: "erdl/v2"
version: "2.0.0"
metadata: { name: "x", decision: ALLOW }
rules:
  - name: "ALL-001"
    when: "true"
    then: ALLOW
`);
    expect(doc.rules[0]!.conditions).toEqual([]);
  });

  it('maps unless to the rule unless field', () => {
    const doc = parseErdlDocument(`
protocol: "erdl/v2"
version: "2.0.0"
metadata: { name: "x", decision: ALLOW }
rules:
  - name: "R-001"
    when:
      conditions:
        - field: "tool.name"
          operator: eq
          value: "exec"
    then: DENY
    unless:
      conditions:
        - field: "context.role"
          operator: eq
          value: "admin"
`);
    expect(doc.rules[0]!.unless?.conditions).toHaveLength(1);
    expect(doc.rules[0]!.unless?.conditions[0]).toMatchObject({ field: 'context.role', operator: 'eq', value: 'admin' });
  });

  it('maps explanation/alternative (string and bilingual object)', () => {
    const doc = parseErdlDocument(`
protocol: "erdl/v2"
version: "2.0.0"
metadata: { name: "x", decision: DENY }
rules:
  - name: "R-002"
    when: "true"
    then: DENY
    explanation:
      zh: "防止越权"
      en: "Prevents privilege escalation"
    alternative: "Use a read-only tool instead"
`);
    expect(doc.rules[0]!.action.explanation).toEqual({ zh: '防止越权', en: 'Prevents privilege escalation' });
    expect(doc.rules[0]!.action.alternative).toBe('Use a read-only tool instead');
  });

  it('maps correction to action.correction (CORRECT decision)', () => {
    const doc = parseErdlDocument(`
protocol: "erdl/v2"
version: "2.1.0"
metadata: { name: "x", decision: ALLOW }
rules:
  - name: "SEC-014-correct-unsafe-path"
    when:
      conditions:
        - field: "tool.name"
          operator: eq
          value: "write_file"
        - field: "tool.args.path"
          operator: starts_with
          value: "/etc/"
    then: CORRECT
    instruction: "Change path from /etc/ to /var/app/."
    correction: "Rewrite the write target to /var/app/ instead of /etc/."
`);
    const r = doc.rules[0]!;
    expect(r.action.decision).toBe('CORRECT');
    expect(r.action.correction).toBe('Rewrite the write target to /var/app/ instead of /etc/.');
  });

  it('maps category (rule-level) and enabled', () => {
    const doc = parseErdlDocument(`
protocol: "erdl/v2"
version: "2.1.0"
metadata: { name: "x", category: security, decision: ALLOW }
rules:
  - name: "CNV-001"
    category: writing
    enabled: false
    when: "true"
    then: ALLOW
`);
    const r = doc.rules[0]!;
    expect(r.category).toBe('writing'); // rule-level category overrides metadata.category
    expect(r.enabled).toBe(false);
  });

  it('rejects an unsupported protocol', () => {
    expect(() =>
      parseErdlDocument(`protocol: "erdl/v1"\nversion: "1.0.0"\nmetadata: { name: "x" }\nrules: []`),
    ).toThrow(/Unsupported protocol/);
  });

  it('rejects a decision table with a clear message', () => {
    expect(() =>
      parseErdlDocument(`
protocol: "erdl/v2"
version: "2.0.0"
metadata: { name: "x", decision: ALLOW }
rules:
  - name: "DT-001"
    when:
      kind: decision_table
    then: ALLOW
`),
    ).toThrow(/decision table/);
  });

  it('loads and evaluates end-to-end (parse -> evaluate pipeline)', () => {
    const { rules, metadata } = parseErdlDocument(simpleDoc);
    const evaluator = new Evaluator();
    const result = evaluator.evaluate(rules, {
      tool: { name: 'issue_refund', args: { amount: 8000 } },
      'metadata.decision': metadata.decision,
    });
    expect(result.decision).toBe('REQUEST_HUMAN');
    expect(result.matchedRules).toHaveLength(1);
    expect(result.matchedRules[0]!.ruleId).toBe('sec_001_refund_limit');
  });
});

describe('loadErdlFile', () => {
  it('reads and parses a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'erdl-loader-'));
    const file = join(dir, 'rules.erdl.yaml');
    writeFileSync(file, 'protocol: "erdl/v2"\nversion: "2.0.0"\nmetadata: { name: "x", decision: ALLOW }\nrules:\n  - name: "R-1"\n    when: "true"\n    then: ALLOW\n', 'utf-8');
    const doc = loadErdlFile(file);
    expect(doc.rules).toHaveLength(1);
    expect(doc.rules[0]!.name).toBe('R-1');
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('legal_basis / source_text round-trip (serializer -> loader)', () => {
  it('emits and reads snake_case consistently', () => {
    const serializer = new RuleYamlSerializer('/tmp/x');
    const ruleConfig = {
      name: 'x',
      content: {
        protocol: 'erdl/v2',
        version: '2.0.0',
        metadata: { name: 'x', decision: 'ALLOW' },
        rules: [
          {
            name: 'SEC-001',
            when: 'true',
            then: 'ALLOW',
            legal_basis: 'Regulation X, Article 23',
            source_text: 'The original regulation text.',
          },
        ],
      },
    };
    const yaml = serializer.toSpec5Yaml(ruleConfig as never);
    expect(yaml).toContain('legal_basis:');
    expect(yaml).not.toContain('legalBasis:');
    expect(yaml).toContain('source_text:');
    expect(yaml).not.toContain('sourceText:');
    const doc = parseErdlDocument(yaml);
    expect(doc.rules[0]!.legal_basis).toBe('Regulation X, Article 23');
    expect(doc.rules[0]!.source_text).toBe('The original regulation text.');
  });

  it('round-trips correction (CORRECT decision fix text)', () => {
    const serializer = new RuleYamlSerializer('/tmp/x');
    const ruleConfig = {
      name: 'x',
      content: {
        protocol: 'erdl/v2',
        version: '2.1.0',
        metadata: { name: 'x', decision: 'ALLOW' },
        rules: [
          {
            name: 'SEC-014',
            when: { conditions: [{ field: 'tool.name', operator: 'eq', value: 'write_file' }] },
            then: 'CORRECT',
            correction: 'Rewrite the write target to /var/app/ instead of /etc/.',
          },
        ],
      },
    };
    const yaml = serializer.toSpec5Yaml(ruleConfig as never);
    expect(yaml).toContain('correction:');
    const doc = parseErdlDocument(yaml);
    expect(doc.rules[0]!.action.correction).toBe(
      'Rewrite the write target to /var/app/ instead of /etc/.',
    );
  });
});
