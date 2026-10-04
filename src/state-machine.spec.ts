/**
 * state-machine.spec.ts — §6a state block + state machine regression tests.
 *
 * Covers: load-time validation (state-definition), the runtime FSM
 * (state-machine), and the evaluator integration (state.* controlled read +
 * state_snapshot in the result).
 */
import { describe, it, expect } from 'vitest'
import { StateMachine } from './state-machine.js'
import { validateStateBlock, validateStateRefs, validateTransitionGuard, type StateDeclaration, type TransitionRule } from './state-definition.js'
import { Evaluator } from './evaluator.js'
import { parseErdlDocument } from './erdl-loader.js'
import { VirtualClock } from './clock.js'

const AUTHORIZATION: StateDeclaration = {
  name: 'authorization',
  values: ['authorized', 'revoked'],
  initial: 'revoked',
}

const REVOKE: TransitionRule = {
  on: 'revoke',
  audit_as: 'DELEGATE',
  reason: 'revoke',
  set: { authorization: 'revoked' },
}

const AUTHORIZE: TransitionRule = {
  on: 'authorize',
  audit_as: 'DELEGATE',
  reason: 'authorize',
  set: { authorization: 'authorized' },
}

describe('state-definition: load-time validation', () => {
  it('accepts a valid state block', () => {
    expect(validateStateBlock([AUTHORIZATION], [REVOKE, AUTHORIZE])).toEqual([])
  })

  it('rejects state variable values outside 2-4 range', () => {
    const bad: StateDeclaration = { name: 'x', values: ['only'], initial: 'only' }
    const errors = validateStateBlock([bad], undefined)
    expect(errors.some((e) => e.code === 'STATE_VALUES_RANGE')).toBe(true)
  })

  it('rejects initial not in values', () => {
    const bad: StateDeclaration = { name: 'x', values: ['a', 'b'], initial: 'c' }
    const errors = validateStateBlock([bad], undefined)
    expect(errors.some((e) => e.code === 'STATE_INITIAL_INVALID')).toBe(true)
  })

  it('rejects a set referencing an undeclared state variable', () => {
    const t: TransitionRule = { on: 'evt', audit_as: 'NOTIFY', set: { ghost: 'x' } }
    const errors = validateStateBlock([AUTHORIZATION], [t])
    expect(errors.some((e) => e.code === 'SET_UNKNOWN_STATE')).toBe(true)
  })

  it('rejects audit_as taking a blocking decision', () => {
    const t: TransitionRule = { on: 'evt', audit_as: 'DENY', set: { authorization: 'revoked' } }
    const errors = validateStateBlock([AUTHORIZATION], [t])
    expect(errors.some((e) => e.code === 'AUDIT_AS_INVALID')).toBe(true)
  })

  it('rejects a deterministic conflict (same event sets one variable to different values)', () => {
    const a: TransitionRule = { on: 'evt', audit_as: 'NOTIFY', set: { authorization: 'authorized' } }
    const b: TransitionRule = { on: 'evt', audit_as: 'NOTIFY', set: { authorization: 'revoked' } }
    const errors = validateStateBlock([AUTHORIZATION], [a, b])
    expect(errors.some((e) => e.code === 'TRANSITION_CONFLICT')).toBe(true)
  })

  it('rejects a transition guard using a forbidden node (quantifier)', () => {
    const t: TransitionRule = { on: 'evt', audit_as: 'NOTIFY', when: { all: { binding: 'x', over: { field: 'a' }, predicate: { field: 'x' } } }, set: { authorization: 'revoked' } }
    const errors = validateTransitionGuard([t])
    expect(errors.some((e) => e.code === 'GUARD_FORBIDDEN_NODE')).toBe(true)
  })

  it('rejects a rule referencing event.* (event is transition-only)', () => {
    const errors = validateStateRefs([{ when: { conditions: [{ field: 'event.actor', operator: 'eq', value: 'x' }] } }], undefined, [AUTHORIZATION])
    expect(errors.some((e) => e.code === 'EVENT_REF_IN_RULE')).toBe(true)
  })

  it('rejects a reference to an undeclared state variable', () => {
    const errors = validateStateRefs([{ when: { conditions: [{ field: 'state.ghost', operator: 'eq', value: 'x' }] } }], undefined, [AUTHORIZATION])
    expect(errors.some((e) => e.code === 'STATE_REF_UNKNOWN')).toBe(true)
  })
})

describe('state-machine: runtime FSM', () => {
  const clock = new VirtualClock(1700000000000)
  const docHash = 'sha256:doc'

  it('genesis initializes state to the declared initial value', () => {
    const sm = new StateMachine([AUTHORIZATION], [REVOKE, AUTHORIZE], docHash, { clock })
    expect(sm.getValue('authorization')).toBe('revoked')
    expect(sm.getStateVersion()).toBe(0)
    const chain = sm.getChain()
    expect(chain.length).toBe(1)
    expect(chain[0].type).toBe('genesis')
  })

  it('an authorize event commits a transition and bumps state_version', () => {
    const sm = new StateMachine([AUTHORIZATION], [REVOKE, AUTHORIZE], docHash, { clock })
    const res = sm.injectEvent({ event_id: 'e1', on: 'authorize', actor: 'root-P', at: '2026-10-04T00:00:00Z' })
    expect(res.committed).toBe(true)
    expect(sm.getValue('authorization')).toBe('authorized')
    expect(sm.getStateVersion()).toBe(1)
    expect(res.record?.type).toBe('transition')
  })

  it('a duplicate event_id is silently dropped', () => {
    const sm = new StateMachine([AUTHORIZATION], [REVOKE, AUTHORIZE], docHash, { clock })
    sm.injectEvent({ event_id: 'e1', on: 'authorize', actor: 'root-P' })
    const second = sm.injectEvent({ event_id: 'e1', on: 'authorize', actor: 'root-P' })
    expect(second.committed).toBe(false)
    expect(second.record).toBeNull()
    expect(sm.getStateVersion()).toBe(1) // still 1, not 2
  })

  it('an event with no matching transition is silently dropped', () => {
    const sm = new StateMachine([AUTHORIZATION], [REVOKE], docHash, { clock })
    const res = sm.injectEvent({ event_id: 'e9', on: 'unknown', actor: 'x' })
    expect(res.committed).toBe(false)
    expect(res.record).toBeNull()
    expect(sm.getStateVersion()).toBe(0)
  })

  it('snapshot is on-demand and anchored to state_version + transitions_head', () => {
    const sm = new StateMachine([AUTHORIZATION], [REVOKE, AUTHORIZE], docHash, { clock })
    sm.injectEvent({ event_id: 'e1', on: 'authorize', actor: 'root-P' })
    const snap = sm.snapshot(['authorization'])
    expect(snap.values.authorization).toBe('authorized')
    expect(snap.state_version).toBe(1)
    expect(snap.transitions_head).toBe(sm.getTransitionsHead())
  })
})

describe('state-machine + evaluator integration', () => {
  it('a rule reading state.* resolves from the state machine and records state_snapshot', () => {
    const sm = new StateMachine([AUTHORIZATION], [REVOKE, AUTHORIZE], 'sha256:doc', { clock: new VirtualClock(1700000000000) })
    const evaluator = new Evaluator()
    const rules = [{
      id: 'SEC-001-revoked-guard',
      name: 'SEC-001-revoked-guard',
      description: 'block when authorization is revoked',
      category: 'security' as const,
      conditions: [{ expr: { eq: [{ field: 'state.authorization' }, 'revoked'] } }],
      conditionLogic: 'AND' as const,
      action: { decision: 'DENY' as const },
      priority: 1,
      enabled: true,
    }]
    // initial state is revoked → rule should fire DENY
    const result = evaluator.evaluate(rules, {}, { stateMachine: sm })
    expect(result.decision).toBe('DENY')
    expect(result.stateSnapshot?.values.authorization).toBe('revoked')
    expect(result.stateSnapshot?.state_version).toBe(0)
  })

  it('after authorize, the same rule folds to ALLOW (state changed the verdict)', () => {
    const sm = new StateMachine([AUTHORIZATION], [REVOKE, AUTHORIZE], 'sha256:doc', { clock: new VirtualClock(1700000000000) })
    sm.injectEvent({ event_id: 'e1', on: 'authorize', actor: 'root-P' })
    const evaluator = new Evaluator()
    const rules = [{
      id: 'SEC-001-revoked-guard',
      name: 'SEC-001-revoked-guard',
      description: 'block when authorization is revoked',
      category: 'security' as const,
      conditions: [{ expr: { eq: [{ field: 'state.authorization' }, 'revoked'] } }],
      conditionLogic: 'AND' as const,
      action: { decision: 'DENY' as const },
      priority: 1,
      enabled: true,
    }]
    const result = evaluator.evaluate(rules, {}, { stateMachine: sm })
    expect(result.decision).toBe('ALLOW')
    expect(result.stateSnapshot?.values.authorization).toBe('authorized')
    expect(result.stateSnapshot?.state_version).toBe(1)
  })
})

describe('erdl-loader: state block parsing', () => {
  it('parses a document with state + transitions', () => {
    const yaml = `protocol: "erdl/v2"
version: "2.2.0"
metadata:
  name: "auth-guard"
  decision: ALLOW
state:
  - name: authorization
    values: [authorized, revoked]
    initial: revoked
transitions:
  - on: authorize
    audit_as: DELEGATE
    reason: authorize
    set: { authorization: authorized }
  - on: revoke
    audit_as: DELEGATE
    reason: revoke
    set: { authorization: revoked }
rules:
  - name: "SEC-001-revoked-guard"
    description: "block when revoked"
    priority: 1
    when:
      conditions:
        - field: "state.authorization"
          operator: eq
          value: "revoked"
    then: DENY
`
    const doc = parseErdlDocument(yaml)
    expect(doc.state?.length).toBe(1)
    expect(doc.transitions?.length).toBe(2)
    expect(doc.rules.length).toBe(1)
  })

  it('rejects an undeclared state reference in a rule', () => {
    const yaml = `protocol: "erdl/v2"
version: "2.2.0"
metadata:
  name: "auth-guard"
state:
  - name: authorization
    values: [authorized, revoked]
    initial: revoked
rules:
  - name: "SEC-001"
    description: "x"
    priority: 1
    when:
      conditions:
        - field: "state.ghost"
          operator: eq
          value: "x"
    then: DENY
`
    expect(() => parseErdlDocument(yaml)).toThrow(/STATE_REF_UNKNOWN/)
  })

  it('rejects a document with an unknown top-level field', () => {
    const yaml = `protocol: "erdl/v2"
version: "2.2.0"
metadata:
  name: "x"
bogus: 1
rules: []
`
    expect(() => parseErdlDocument(yaml)).toThrow(/Unknown top-level field/)
  })
})
