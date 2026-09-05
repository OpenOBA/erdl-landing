/**
 * Resolution semantics tests for the Evaluator (§7.1).
 *
 * Locks the catch-all (empty-condition) rule semantics defined by §7.1 item 6:
 * an empty-condition rule MUST NOT rewrite the decision established by an
 * explicit-condition rule, in either direction — a fallback rule only takes
 * effect when no explicit-condition rule matches.
 *
 * @license MIT
 */

import { describe, it, expect } from 'vitest'
import { Evaluator } from './evaluator.js'
import type { RuleDefinition } from './rule-definition.js'

function rule(partial: Partial<RuleDefinition> & Pick<RuleDefinition, 'name' | 'decision' | 'priority' | 'conditions'>): RuleDefinition {
  const decision = (partial as unknown as { decision: string }).decision
  return {
    id: partial.name,
    description: partial.name,
    category: 'custom',
    enabled: true,
    conditions: partial.conditions,
    action: {
      decision: decision as RuleDefinition['action']['decision'],
      ring: partial.action?.ring,
    },
    priority: partial.priority,
    override: partial.override,
    ...(partial as object),
  } as unknown as RuleDefinition
}

const ctx = { 'tool.name': 'issue_refund' }

describe('§7.1 item 6 — catch-all (empty-condition) resolution', () => {
  it('catch-all ALLOW does NOT override an explicit DENY (relax direction)', () => {
    // Ring 0 explicit DENY (specific block) + Ring 3 catch-all ALLOW with
    // override=critical (fallback). The fallback MUST NOT rewrite the explicit
    // DENY — across three rings, in the relaxing direction.
    const rules: RuleDefinition[] = [
      rule({
        name: 'explicit-deny', decision: 'DENY', priority: 10,
        conditions: [{ field: 'tool.name', operator: 'eq', value: 'issue_refund' }],
        action: { decision: 'DENY', ring: 0 },
      }),
      rule({
        name: 'catchall-allow', decision: 'ALLOW', priority: 20,
        conditions: [], override: 'critical',
        action: { decision: 'ALLOW', ring: 3 },
      }),
    ]
    const r = new Evaluator().evaluate(rules, ctx)
    expect(r.decision).toBe('DENY')
  })

  it('catch-all ALLOW still acts as fallback when no explicit rule matches', () => {
    // No explicit rule matches → the catch-all ALLOW is the fallback.
    const rules: RuleDefinition[] = [
      rule({
        name: 'explicit-other', decision: 'DENY', priority: 10,
        conditions: [{ field: 'tool.name', operator: 'eq', value: 'delete_file' }],
        action: { decision: 'DENY', ring: 0 },
      }),
      rule({
        name: 'catchall-allow', decision: 'ALLOW', priority: 20,
        conditions: [], override: 'critical',
        action: { decision: 'ALLOW', ring: 3 },
      }),
    ]
    const r = new Evaluator().evaluate(rules, ctx)
    expect(r.decision).toBe('ALLOW')
  })

  it('catch-all DENY does NOT override an explicit ALLOW (existing, unchanged)', () => {
    const rules: RuleDefinition[] = [
      rule({
        name: 'explicit-allow', decision: 'ALLOW', priority: 10,
        conditions: [{ field: 'tool.name', operator: 'eq', value: 'issue_refund' }],
        action: { decision: 'ALLOW', ring: 0 },
      }),
      rule({
        name: 'catchall-deny', decision: 'DENY', priority: 20,
        conditions: [], override: 'critical',
        action: { decision: 'DENY', ring: 3 },
      }),
    ]
    const r = new Evaluator().evaluate(rules, ctx)
    expect(r.decision).toBe('ALLOW')
  })

  it('explicit override ALLOW still overrides an explicit DENY (non-catch-all, unchanged)', () => {
    // The override relax mechanism still works for explicit-condition rules.
    const rules: RuleDefinition[] = [
      rule({
        name: 'explicit-deny', decision: 'DENY', priority: 10,
        conditions: [{ field: 'tool.name', operator: 'eq', value: 'issue_refund' }],
        action: { decision: 'DENY', ring: 0 },
      }),
      rule({
        name: 'explicit-allow-override', decision: 'ALLOW', priority: 20,
        conditions: [{ field: 'tool.name', operator: 'eq', value: 'issue_refund' }],
        override: 'critical',
        action: { decision: 'ALLOW', ring: 3 },
      }),
    ]
    const r = new Evaluator().evaluate(rules, ctx)
    expect(r.decision).toBe('ALLOW')
  })
})
