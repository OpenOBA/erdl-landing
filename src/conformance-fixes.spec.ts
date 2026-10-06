/**
 * conformance-fixes.spec — conformance regression tests (SPEC §6 / §5.4 / §7.1a / §6a.2.3).
 *
 *
 * @license MIT
 */

import { describe, it, expect } from 'vitest'
import { parseErdlDocument } from './erdl-loader.js'
import { Evaluator } from './evaluator.js'
import { validateStateBlock, type StateDeclaration, type TransitionRule } from './state-definition.js'
import type { RuleDefinition } from './rule-definition.js'

const doc = (rulesYaml: string): string => `protocol: "erdl/v2"
version: "2.2.0"
metadata:
  name: conformance-fixes
rules:
${rulesYaml}`

const RULE_DEF = (over: Partial<RuleDefinition> = {}): RuleDefinition => ({
  id: over.name ?? 'R-1',
  name: over.name ?? 'R-1',
  description: '',
  category: 'custom',
  conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec' }],
  conditionLogic: 'AND',
  action: { decision: 'DENY' },
  priority: 10,
  enabled: true,
  ...over,
} as RuleDefinition)

describe('then closed-enumeration check at load (fail-closed, SPEC §6)', () => {
  it('a typo\'d then (DENYY) is rejected at load, not silently folded', () => {
    const yaml = doc(`  - name: TST-001-typo
    when: { logic: AND, conditions: [{ field: "tool.name", operator: eq, value: "exec" }] }
    then: DENYY`)
    expect(() => parseErdlDocument(yaml)).toThrow(/invalid then "DENYY"/)
  })

  it('WORKFLOW substates (WORKFLOW_WAITING) are rejected as rule actions (writing domain = 13 base types)', () => {
    const yaml = doc(`  - name: TST-002-substate
    when: { logic: AND, conditions: [{ field: "tool.name", operator: eq, value: "exec" }] }
    then: WORKFLOW_WAITING`)
    expect(() => parseErdlDocument(yaml)).toThrow(/invalid then "WORKFLOW_WAITING"/)
  })

  it('a decision-table row with invalid then is rejected with row position', () => {
    const yaml = doc(`  - name: TST-003-dt
    when:
      kind: decision_table
      columns: [{ field: "tool.name" }]
      rows:
        - when: [["eq", "exec"]]
          then: ALLOY`)
    expect(() => parseErdlDocument(yaml)).toThrow(/row 1 has invalid then "ALLOY"/)
  })
})

describe('decision-table default row and per-row priority (SPEC §5.4)', () => {
  const dtDoc = (rows: string): string => doc(`  - name: TST-004-dt
    when:
      kind: decision_table
      columns: [{ field: "tool.name" }]
      rows:
${rows}`)

  it('a default row (when: []) that is not last is rejected', () => {
    const yaml = dtDoc(`        - when: []
          then: ALLOW
        - when: [["eq", "exec"]]
          then: DENY`)
    expect(() => parseErdlDocument(yaml)).toThrow(/default row .* MUST be the last row/)
  })

  it('explicit per-row priority is honored (not silently discarded)', () => {
    const yaml = dtDoc(`        - when: [["eq", "exec"]]
          then: DENY
          priority: 5
        - when: []
          then: ALLOW
          priority: 99`)
    const { rules } = parseErdlDocument(yaml)
    expect(rules[0].priority).toBe(5)
    expect(rules[1].priority).toBe(99)
  })

  it('a per-row priority conflicting with row order is rejected', () => {
    const yaml = dtDoc(`        - when: [["eq", "exec"]]
          then: DENY
          priority: 9
        - when: []
          then: ALLOW
          priority: 3`)
    expect(() => parseErdlDocument(yaml)).toThrow(/priority 3 conflicts with row order/)
  })
})

describe('§7.1a tier 0-2 interception lock', () => {
  const lockedScenario = (denyTier: number | undefined): string => {
    const ev = new Evaluator()
    const deny: RuleDefinition = RULE_DEF({ name: 'SEC-010-locked-deny', tier: denyTier })
    const allow: RuleDefinition = RULE_DEF({
      name: 'BIZ-030-critical-allow',
      conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec' }],
      action: { decision: 'ALLOW' },
      override: 'critical',
      // same ring as the DENY, so the S5 ring constraint alone does NOT block the cover —
      // only the tier lock decides this scenario.
      action2: undefined,
    } as Partial<RuleDefinition>)
    // place ALLOW at the same ring (0) as the DENY
    ;(allow.action as { ring?: number }).ring = 0
    const result = ev.evaluate([deny, allow], { tool: { name: 'exec' } })
    return result.decision
  }

  it('tier 0-2 restrictive rule is locked: same-ring critical override ALLOW cannot cover it', () => {
    expect(lockedScenario(1)).toBe('DENY')
    expect(lockedScenario(0)).toBe('DENY')
    expect(lockedScenario(2)).toBe('DENY')
  })

  it('tier >= 3 restrictive rule stays coverable by a higher-level same-ring override ALLOW', () => {
    expect(lockedScenario(3)).toBe('ALLOW')
  })

  it('undeclared tier (undefined) is never locked — existing behavior preserved', () => {
    expect(lockedScenario(undefined)).toBe('ALLOW')
  })
})

describe('ne is not an exclusivity proof base (soundness, SPEC §6a.2.3)', () => {
  const AUTH: StateDeclaration = { name: 'authorization', values: ['authorized', 'revoked', 'pending'], initial: 'revoked' }

  it('ne 5 vs ne 6 on the same (on, variable) is now a conflict error (both can hold at x=7)', () => {
    const a: TransitionRule = {
      on: 'evt', name: 'TR-001-a',
      when: { logic: 'AND', conditions: [{ field: 'state.authorization', operator: 'ne', value: 'authorized' }] },
      set: { authorization: 'revoked' },
    }
    const b: TransitionRule = {
      on: 'evt', name: 'TR-002-b',
      when: { logic: 'AND', conditions: [{ field: 'state.authorization', operator: 'ne', value: 'pending' }] },
      set: { authorization: 'pending' },
    }
    const errors = validateStateBlock([AUTH], [a, b])
    expect(errors.some((e) => e.code === 'TRANSITION_CONFLICT')).toBe(true)
  })

  it('eq vs eq with different constants remains a valid exclusivity proof (no error)', () => {
    const a: TransitionRule = {
      on: 'evt', name: 'TR-003-a',
      when: { logic: 'AND', conditions: [{ field: 'state.authorization', operator: 'eq', value: 'authorized' }] },
      set: { authorization: 'revoked' },
    }
    const b: TransitionRule = {
      on: 'evt', name: 'TR-004-b',
      when: { logic: 'AND', conditions: [{ field: 'state.authorization', operator: 'eq', value: 'pending' }] },
      set: { authorization: 'pending' },
    }
    const errors = validateStateBlock([AUTH], [a, b])
    expect(errors.some((e) => e.code === 'TRANSITION_CONFLICT')).toBe(false)
  })
})
