/**
 * state-machine.ts — §6a runtime FSM: event injection, transition execution,
 * audit chain (genesis / transition / transition_error), state_snapshot.
 *
 * ERDL Spec v2.3 §6a: the state body is held by the engine *outside* the
 * expression-tree kernel. This module is the runtime half: it holds the current
 * state values, processes events eagerly (FIFO, event_id de-duplicated), executes
 * transition guards atomically (first EvaluationError → fail-closed, no set),
 * and appends serially-anchored audit records.
 *
 * The expression-tree kernel reads state read-only via `state.<name>` (§6a.3);
 * transition guards read `state.*` + `event.*` only (§6a.7). Both are served by
 * the custom EvalContext built here — never by writing state directly.
 *
 * Concurrency (§6a.5.6): the reference API is synchronous; injectEvent /
 * getSnapshot / evaluate therefore serialize per instance by construction.
 *
 * @license MIT
 */

import { createHash } from 'node:crypto'
import { canonicalize } from 'json-canonicalize'
import { ExprTreeEvaluator, type EvalContext } from './expr-tree/evaluator.js'
import { jsonWhenToExpr } from './expr-tree/rule-to-expr.js'
import { toSExpr } from './expr-tree/s-expression.js'
import { normalizeNfc, normalizeStringValue } from './expr-tree/normalize.js'
import { SystemClock, type Clock } from './clock.js'
import { validateEventPayload, type StateDeclaration, type StateEvent, type StateSnapshot, type TransitionRule } from './state-definition.js'

/** A serially-anchored audit record (one of the three §6a.5.5 kinds). */
export type AuditRecord =
  | { type: 'genesis'; protocol: string; doc_tree_hash: string; initial: Record<string, string>; at: string; previous_hash: null; hash: string }
  | { type: 'transition'; event_id: string; on: string; actor: string; at: string; audit_as: string; set: Record<string, string>; state_version: number; previous_hash: string; hash: string }
  | { type: 'transition_error'; event_id: string; on: string; actor: string; at: string; audit_as: string; error: string; errored: true; previous_hash: string; hash: string }

/** Result of injecting one event. */
export interface InjectEventResult {
  /** The audit record appended (null when the event was silently dropped — no matching transition / duplicate event_id). */
  record: AuditRecord | null
  /** Whether the event matched a transition and was committed. */
  committed: boolean
  /** The error description when a transition guard failed (fail-closed). */
  error?: string
}

/** Hash a JCS-canonicalized object (RFC 8785 + SHA-256), `sha256:` prefixed. */
function hashObject(obj: unknown): string {
  const canonical = canonicalize(obj as Record<string, unknown>)
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`
}

/**
 * Compute the `doc_tree_hash` (§6a.5.5): the state-machine document-level
 * canonical hash, anchoring the state-machine identity (state + transitions).
 *
 * Anchors `metadata.name` + `state` + `transitions` ONLY — rules are excluded
 * (their provenance is carried by the DO-layer `rule_set_version.id`, RFC-002
 * §2.3). Preimage field order and fixed key set are pinned in SPEC §6a.5.5:
 *
 *   name        → metadata.name
 *   state       → [ { name, values, initial } ]
 *   transitions → [ { on, name, audit_as, reason, enabled, when, set } ]
 *
 * Encoding: valueless keys encode `null` (key not omitted); a missing `enabled`
 * encodes `true` (default); `when` stores the compiled S-expression (E7), or
 * `null` when absent (unconditional transition); strings NFC (E10); numbers JCS.
 */
export function computeDocTreeHash(
  metadataName: string,
  state: StateDeclaration[],
  transitions: TransitionRule[],
): string {
  const statePreimage = (state ?? []).map((s) => ({
    name: s.name,
    values: s.values,
    initial: s.initial ?? null,
  }))
  const transitionsPreimage = (transitions ?? []).map((t) => {
    let when: unknown = null
    if (t.when !== undefined && t.when !== null) {
      const tree = jsonWhenToExpr(t.when as Record<string, unknown>)
      if (tree !== null) when = toSExpr(tree)
    }
    return {
      on: t.on,
      name: t.name ?? null,
      audit_as: t.audit_as ?? null,
      reason: t.reason ?? null,
      enabled: t.enabled ?? true,
      when,
      set: t.set ?? null,
    }
  })
  const preimage = normalizeStringValue({
    name: metadataName,
    state: statePreimage,
    transitions: transitionsPreimage,
  })
  return hashObject(preimage)
}

/** Sort an object's keys by UTF-8 code-point order (for `set`/`initial` normalization). */
function sortKeys(obj: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of Object.keys(obj).sort()) out[k] = obj[k]
  return out
}

/** NFC-normalize all values in a string map (E10). */
function nfcMap(obj: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) out[k] = normalizeNfc(v)
  return out
}

export class StateMachine {
  /** Current state values (variable name → value). */
  private readonly values = new Map<string, string>()
  private readonly declarations = new Map<string, StateDeclaration>()
  private readonly transitions: TransitionRule[]
  private readonly treeEvaluator = new ExprTreeEvaluator()
  private readonly clock: Clock
  private readonly protocol: string

  /** Genesis-anchored chain state. */
  private stateVersion = 0
  private transitionsHead: string
  private readonly chain: AuditRecord[] = []
  private readonly seenEventIds = new Set<string>()

  constructor(
    state: StateDeclaration[],
    transitions: TransitionRule[],
    docTreeHash: string,
    options?: { protocol?: string; clock?: Clock },
  ) {
    this.protocol = options?.protocol ?? 'erdl/v2'
    this.clock = options?.clock ?? new SystemClock()
    this.transitions = transitions

    for (const decl of state) {
      this.declarations.set(decl.name, decl)
      this.values.set(decl.name, decl.initial ?? decl.values[0])
    }

    // Genesis record (§6a.5.5): initial snapshot + document canonical-tree hash.
    const initial = sortKeys(nfcMap(Object.fromEntries(this.values)))
    const genesisAt = new Date(this.clock.now()).toISOString()
    const genesis: AuditRecord = {
      type: 'genesis',
      protocol: this.protocol,
      doc_tree_hash: docTreeHash,
      initial,
      at: genesisAt,
      previous_hash: null,
      hash: '',
    }
    genesis.hash = hashObject({
      type: 'genesis',
      protocol: this.protocol,
      doc_tree_hash: docTreeHash,
      initial,
      at: genesisAt,
      previous_hash: null,
    })
    this.transitionsHead = genesis.hash
    this.chain.push(genesis)
  }

  /** Read a state variable's current value (undefined = undeclared). */
  getValue(name: string): string | undefined {
    return this.values.get(name)
  }

  /** The serially-anchored audit chain (genesis first). */
  getChain(): readonly AuditRecord[] {
    return this.chain
  }

  /** Current state version (0 = genesis). */
  getStateVersion(): number {
    return this.stateVersion
  }

  /** Hash of the latest state-changing audit record (genesis hash initially). */
  getTransitionsHead(): string {
    return this.transitionsHead
  }

  /**
   * Build the on-demand state snapshot (§6a.5.1): only the variables the caller
   * names are materialized. Anchored to the transition chain via state_version
   * + transitions_head.
   */
  snapshot(readVars: string[]): StateSnapshot {
    const values: Record<string, string> = {}
    for (const name of readVars) {
      const v = this.values.get(name)
      if (v !== undefined) values[name] = v
    }
    return {
      values: sortKeys(nfcMap(values)),
      state_version: this.stateVersion,
      transitions_head: this.transitionsHead,
    }
  }

  /**
   * Inject one event and process it eagerly (§6a.2.1 / §6a.5.4).
   *
   * - duplicate event_id → silently dropped (no audit record, no version bump)
   * - no matching transition → silently dropped (deterministic)
   * - guard EvaluationError → fail-closed: no set, `transition_error` record
   * - all guards pass → one atomic commit, `transition` record, version +1
   *
   * The `actor` is supplied by the (authenticated) identity layer; the engine
   * records it but does not itself authenticate (§6a.5.4).
   */
  injectEvent(event: StateEvent): InjectEventResult {
    // §6a.7.1: reject an over-limit payload (chain-external log is the caller's concern).
    const payloadErrors = validateEventPayload(event.payload)
    if (payloadErrors.length > 0) {
      return { record: null, committed: false, error: `payload rejected: ${payloadErrors.map((e) => e.code).join(', ')}` }
    }

    // Duplicate event_id: drop (chain-external log is the caller's concern).
    if (this.seenEventIds.has(event.event_id)) {
      return { record: null, committed: false }
    }
    this.seenEventIds.add(event.event_id)

    const matching = this.transitions.filter((t) => t.on === event.on && t.enabled !== false)
    if (matching.length === 0) {
      // No matching transition: deterministic silent drop (§6a.2.1).
      return { record: null, committed: false }
    }

    const at = event.at ?? new Date(this.clock.now()).toISOString()
    const actor = event.actor ?? ''
    const auditAs = matching[0].audit_as ?? 'NOTIFY'

    // Evaluate guards in definition order against the pre-event state snapshot.
    // First EvaluationError stops the whole transaction (atomic fail-closed).
    const preSnapshot = Object.fromEntries(this.values)
    for (const t of matching) {
      if (t.when === undefined || t.when === null) continue
      const tree = jsonWhenToExpr(t.when as Record<string, unknown>)
      if (tree === null) {
        // An un-compilable guard is a load-time concern; at runtime fail-closed.
        const errMsg = `transition guard for event "${event.on}" failed to compile`
        return this.appendError(event, actor, at, auditAs, errMsg)
      }
      const ctx = this.guardContext(preSnapshot, event, at)
      const result = this.treeEvaluator.evaluate(tree, ctx)
      if (result.errored) {
        return this.appendError(event, actor, at, auditAs, result.error ?? 'transition guard evaluation error')
      }
      if (result.value !== true) {
        // Guard not satisfied → this transition does not fire (not an error).
        return { record: null, committed: false }
      }
    }

    // All guards pass → atomic commit of the merged `set`.
    const set: Record<string, string> = {}
    for (const t of matching) {
      if (t.set) {
        for (const [varName, val] of Object.entries(t.set)) {
          set[varName] = val
        }
      }
    }
    for (const [varName, val] of Object.entries(set)) {
      this.values.set(varName, normalizeNfc(val))
    }

    this.stateVersion += 1
    const record: AuditRecord = {
      type: 'transition',
      event_id: event.event_id,
      on: event.on,
      actor: normalizeNfc(actor),
      at,
      audit_as: auditAs,
      set: sortKeys(nfcMap(set)),
      state_version: this.stateVersion,
      previous_hash: this.transitionsHead,
      hash: '',
    }
    record.hash = hashObject({
      type: 'transition',
      event_id: event.event_id,
      on: event.on,
      actor: normalizeNfc(actor),
      at,
      audit_as: auditAs,
      set: sortKeys(nfcMap(set)),
      state_version: this.stateVersion,
      previous_hash: this.transitionsHead,
    })
    this.transitionsHead = record.hash
    this.chain.push(record)

    return { record, committed: true }
  }

  /** Append a transition_error record (fail-closed: no set, no version bump, no head move). */
  private appendError(event: StateEvent, actor: string, at: string, auditAs: string, error: string): InjectEventResult {
    const record: AuditRecord = {
      type: 'transition_error',
      event_id: event.event_id,
      on: event.on,
      actor: normalizeNfc(actor),
      at,
      audit_as: auditAs,
      error,
      errored: true,
      previous_hash: this.transitionsHead,
      hash: '',
    }
    record.hash = hashObject({
      type: 'transition_error',
      event_id: event.event_id,
      on: event.on,
      actor: normalizeNfc(actor),
      at,
      audit_as: auditAs,
      error,
      errored: true,
      previous_hash: this.transitionsHead,
    })
    this.chain.push(record)
    return { record, committed: false, error }
  }

  /** Build the guard EvalContext: reads state.* (pre-event) + event.* only; no free fact. */
  private guardContext(preSnapshot: Record<string, string>, event: StateEvent, at: string): EvalContext {
    const resolveField = (field: string): unknown => {
      if (field.startsWith('state.')) {
        const name = field.slice('state.'.length)
        return preSnapshot[name]
      }
      if (field.startsWith('event.')) {
        const key = field.slice('event.'.length)
        if (key === 'event_id') return event.event_id
        if (key === 'on') return event.on
        if (key === 'actor') return event.actor ?? ''
        if (key === 'at') return at
        // payload keys: event.<key> and event.<key>.<sub> (depth ≤ 2)
        const parts = key.split('.')
        let cur: unknown = event.payload ?? {}
        for (const p of parts) {
          if (cur === null || typeof cur !== 'object') return undefined
          cur = (cur as Record<string, unknown>)[p]
        }
        return cur
      }
      // Free fact is forbidden in transition guards (§6a.7.3); returns undefined.
      return undefined
    }
    return {
      resolveField,
      resolveVar: (path) => (path === '$' ? preSnapshot : undefined),
      asOf: new Date(at),
    }
  }
}
