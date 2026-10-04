/**
 * state-definition.ts — §6a State Blocks & Transitions: types + load-time validation.
 *
 * ERDL Spec v2.3 §6a defines a single-instance finite state machine (FSM) as two
 * optional top-level fields — `state` (the state space) and `transitions` (the
 * deterministic, event-triggered transition function). The state body is held by
 * the engine *outside* the 34-node expression-tree kernel; rules read it read-only
 * via the `state.<name>` namespace (§6a.3), never by writing it directly.
 *
 * This module holds the pure, load-time MUST checks (deterministic, no runtime
 * state). The runtime FSM (event injection, transition execution, audit chain,
 * genesis) lives in `state-machine.ts`.
 *
 * @license MIT
 */

// ===============================================================
// Types (§6a.1 / §6a.2 / §6a.7)
// ===============================================================

/** A state-variable declaration (§6a.1 `state[]`). */
export interface StateDeclaration {
  name: string
  values: string[]
  initial?: string
  display_name?: { zh: string; en: string }
}

/** A transition rule (§6a.2 `transitions[]`). */
export interface TransitionRule {
  on: string
  name?: string
  audit_as?: string
  reason?: string
  enabled?: boolean
  when?: unknown
  gloss?: string
  set?: Record<string, string>
}

/** A state-machine event (§6a.7.1 `Event`). */
export interface StateEvent {
  event_id: string
  on: string
  at?: string
  actor?: string
  payload?: Record<string, unknown>
}

/**
 * The state snapshot read during evaluation (§6a.5.1 / §7.0.3), entered into the
 * DO hash preimage. `values` is on-demand (only the variables the evaluation read),
 * `state_version` anchors the snapshot to the transition chain, `transitions_head`
 * is the hash of the latest state-changing audit record (genesis hash initially).
 */
export interface StateSnapshot {
  values: Record<string, string>
  state_version: number
  transitions_head: string
}

/** §6a.2 audit_as narrowed set (MUST NOT take a blocking type). */
export const TRANSITION_AUDIT_AS = ['ALLOW', 'NOTIFY', 'DELEGATE', 'ESCALATE', 'REQUEST_HUMAN'] as const

/** §6a.2 on / reason format: lowercase start, alphanumeric + underscore, ≤32 chars. */
export const EVENT_NAME_RE = /^[a-z][a-z0-9_]{0,31}$/

/** §6a.4 resource limits. */
export const STATE_LIMITS = {
  stateCount: 4,
  transitionCount: 32,
  eventNameCount: 16,
} as const

/** §6a.7.1 event payload resource limits (≤8 keys / depth ≤2 / scalar ≤256B). */
export const EVENT_PAYLOAD_LIMITS = {
  maxKeys: 8,
  maxDepth: 2,
  maxValueBytes: 256,
} as const

/** §6a.2.2 guard forbidden nodes: quantifier / arithmetic / aggregate / fn / stateful operators. */
const GUARD_FORBIDDEN_NODES = new Set([
  'all', 'any', 'none', // quantifier
  'add', 'sub', 'mul', 'div', 'round', // arithmetic
  'count', 'sum', 'avg', 'min', 'max', // aggregate
  'fn', // function delegation
  'within', 'rate', // stateful operators
])

/** A load-time validation error. */
export interface StateBlockError {
  code: string
  message: string
}

// ===============================================================
// §6a.1 + §6a.2 + §6a.4: state/transitions structural validation
// ===============================================================

/**
 * Validate the state block (state + transitions) at load time, returning a list of
 * errors. Both fields are optional; an absent/empty state block is valid.
 */
export function validateStateBlock(
  state: StateDeclaration[] | undefined,
  transitions: TransitionRule[] | undefined,
): StateBlockError[] {
  const errors: StateBlockError[] = []
  if ((!state || state.length === 0) && (!transitions || transitions.length === 0)) {
    return errors
  }

  // ── 1. state declarations (§6a.1 + §6a.4) ──
  const stateVars = new Map<string, StateDeclaration>()
  if (state && state.length > 0) {
    if (state.length > STATE_LIMITS.stateCount) {
      errors.push({ code: 'STATE_COUNT_EXCEEDED', message: `state variable count ${state.length} > ${STATE_LIMITS.stateCount} (§6a.4)` })
    }
    const seenNames = new Set<string>()
    for (const s of state) {
      if (s.name === 'state') {
        errors.push({ code: 'STATE_NAME_RESERVED', message: `state variable name "state" is reserved (§6a.1)` })
      }
      if (s.name.includes('.')) {
        errors.push({ code: 'STATE_NAME_DOT', message: `state variable name "${s.name}" MUST NOT contain "." (§6a.1)` })
      }
      if (seenNames.has(s.name)) {
        errors.push({ code: 'STATE_NAME_DUPLICATE', message: `state variable name "${s.name}" duplicated (§6a.1)` })
      }
      seenNames.add(s.name)

      if (!Array.isArray(s.values) || s.values.length < 2 || s.values.length > 4) {
        errors.push({ code: 'STATE_VALUES_RANGE', message: `state variable "${s.name}" values must be 2-4 enum strings (§6a.1)` })
      } else if (new Set(s.values).size !== s.values.length) {
        errors.push({ code: 'STATE_VALUES_DUPLICATE', message: `state variable "${s.name}" values contain duplicates (§6a.1)` })
      } else {
        for (const v of s.values) {
          if (typeof v !== 'string' || v.length === 0) {
            errors.push({ code: 'STATE_VALUE_EMPTY', message: `state variable "${s.name}" has a non-string/empty enum value (§6a.1)` })
          } else if (v.includes('.')) {
            errors.push({ code: 'STATE_VALUE_DOT', message: `state variable "${s.name}" enum value "${v}" MUST NOT contain "." (§6a.1)` })
          }
        }
      }

      if (s.initial !== undefined && (!s.values || !s.values.includes(s.initial))) {
        errors.push({ code: 'STATE_INITIAL_INVALID', message: `state variable "${s.name}" initial "${s.initial}" not in values (§6a.1)` })
      }

      stateVars.set(s.name, s)
    }
  }

  // ── 2. transitions (§6a.2 + §6a.4 + §6a.2.3) ──
  if (transitions && transitions.length > 0) {
    if (transitions.length > STATE_LIMITS.transitionCount) {
      errors.push({ code: 'TRANSITION_COUNT_EXCEEDED', message: `transition count ${transitions.length} > ${STATE_LIMITS.transitionCount} (§6a.4)` })
    }

    const eventNames = new Set<string>()
    // Same-event audit_as consistency: on -> audit_as (enabled rules only).
    const auditAsMap = new Map<string, string>()

    for (const t of transitions) {
      if (t.on !== undefined) {
        eventNames.add(t.on)
        if (!EVENT_NAME_RE.test(t.on)) {
          errors.push({ code: 'EVENT_NAME_INVALID', message: `event name "${t.on}" must match [a-z][a-z0-9_]{0,31} (§6a.2)` })
        }
      }
      if (t.reason !== undefined && !EVENT_NAME_RE.test(t.reason)) {
        errors.push({ code: 'REASON_INVALID', message: `transition reason "${t.reason}" must match [a-z][a-z0-9_]{0,31} (§6a.2)` })
      }

      if (t.audit_as !== undefined && !(TRANSITION_AUDIT_AS as readonly string[]).includes(t.audit_as)) {
        errors.push({ code: 'AUDIT_AS_INVALID', message: `audit_as "${t.audit_as}" not in {ALLOW,NOTIFY,DELEGATE,ESCALATE,REQUEST_HUMAN} (§6a.2)` })
      }

      // §6a.2.4 same-event audit_as consistency (enabled rules only).
      if (t.enabled !== false && t.on !== undefined && t.audit_as !== undefined) {
        const prior = auditAsMap.get(t.on)
        if (prior !== undefined && prior !== t.audit_as) {
          errors.push({ code: 'AUDIT_AS_INCONSISTENT', message: `event "${t.on}" has inconsistent audit_as (${prior} vs ${t.audit_as}) (§6a.2.4)` })
        } else {
          auditAsMap.set(t.on, t.audit_as)
        }
      }

      if (t.set !== undefined) {
        for (const [varName, val] of Object.entries(t.set)) {
          const decl = stateVars.get(varName)
          if (!decl) {
            errors.push({ code: 'SET_UNKNOWN_STATE', message: `set references undeclared state variable "${varName}" (§6a.2.4)` })
          } else if (!decl.values.includes(val)) {
            errors.push({ code: 'SET_VALUE_INVALID', message: `set value "${val}" not in state variable "${varName}" values (§6a.2.4)` })
          }
        }
      }
    }

    if (eventNames.size > STATE_LIMITS.eventNameCount) {
      errors.push({ code: 'EVENT_NAME_COUNT_EXCEEDED', message: `distinct event name count ${eventNames.size} > ${STATE_LIMITS.eventNameCount} (§6a.4)` })
    }

    // §6a.2.3: same-variable conflict (full (0)-(4) decidability check).
    errors.push(...checkTransitionConflicts(transitions, stateVars))
  }

  return errors
}

// ===============================================================
// §6a.2.3: same-variable conflict check (decidable, sound)
// ===============================================================

/** A top-level conjunct usable as a mutual-exclusion proof (eq/in on a field). */
interface ExclusivityConjunct {
  field: string
  values: string[]
}

/** Is this `when` unconditional (omitted / literal true)? */
function isUnconditionalWhen(when: unknown): boolean {
  if (when === undefined || when === null) return true
  if (typeof when === 'string') return when === 'true'
  if (typeof when !== 'object') return false
  const w = when as Record<string, unknown>
  // expr form: the literal `true` tree (no constant folding beyond the literal).
  if ('expr' in w && w.expr !== undefined) return w.expr === true
  return false
}

/** Convert one Simple condition to an exclusivity conjunct (eq/in only); null otherwise. */
function conditionToExclusivity(c: Record<string, unknown>): ExclusivityConjunct | null {
  const field = c.field
  const op = c.operator
  if (typeof field !== 'string' || typeof op !== 'string') return null
  if (op === 'eq' || op === 'ne') {
    return { field, values: [String(c.value)] }
  }
  if (op === 'in' && Array.isArray(c.value)) {
    return { field, values: c.value.map(String) }
  }
  return null
}

/** Collect top-level eq/in conjuncts from an expr node (only the top-level `and` children). */
function collectExprConjuncts(node: unknown, out: ExclusivityConjunct[]): void {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return
  const obj = node as Record<string, unknown>
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'and' && Array.isArray(val)) {
      // top-level AND: its direct children are the top-level conjuncts
      for (const child of val) {
        collectExprConjunctSingle(child, out)
      }
    } else if (key === 'eq' || key === 'ne' || key === 'in') {
      // a single comparison node at the top level
      const fieldNode = Array.isArray(val) ? val[0] : undefined
      const field = extractFieldName(fieldNode)
      if (field) {
        const raw = Array.isArray(val) ? val[1] : undefined
        out.push({ field, values: key === 'in' && Array.isArray(raw) ? raw.map(String) : [String(raw)] })
      }
    }
  }
}

function collectExprConjunctSingle(node: unknown, out: ExclusivityConjunct[]): void {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return
  const obj = node as Record<string, unknown>
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'eq' || key === 'ne' || key === 'in') {
      const field = Array.isArray(val) ? extractFieldName(val[0]) : undefined
      if (field) {
        const raw = Array.isArray(val) ? val[1] : undefined
        out.push({ field, values: key === 'in' && Array.isArray(raw) ? raw.map(String) : [String(raw)] })
      }
    }
  }
}

function extractFieldName(node: unknown): string | undefined {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    const obj = node as Record<string, unknown>
    if (typeof obj.field === 'string') return obj.field
  }
  return undefined
}

/**
 * Extract the top-level eq/in conjuncts usable for the mutual-exclusion proof.
 * Returns null when the `when` is not provable (e.g. `logic: OR`).
 */
function extractExclusivityConjuncts(when: unknown): ExclusivityConjunct[] | null {
  if (when === undefined || when === null || typeof when === 'string') return []
  if (typeof when !== 'object') return null
  const w = when as Record<string, unknown>

  // expr form
  if ('expr' in w && w.expr !== undefined) {
    const out: ExclusivityConjunct[] = []
    collectExprConjuncts(w.expr, out)
    return out
  }

  // Simple form
  if ('conditions' in w && Array.isArray(w.conditions)) {
    if (w.logic === 'OR') return null // OR → single unprovable top-level conjunct
    const out: ExclusivityConjunct[] = []
    for (const c of w.conditions as Array<Record<string, unknown>>) {
      const conj = conditionToExclusivity(c)
      if (conj) out.push(conj)
    }
    return out
  }

  return null
}

/** Are two rules provably mutually exclusive (per §6a.2.3 (2))? */
function provablyExclusive(a: ExclusivityConjunct[], b: ExclusivityConjunct[]): boolean {
  for (const ca of a) {
    for (const cb of b) {
      if (ca.field === cb.field) {
        const setA = new Set(ca.values)
        const overlap = cb.values.some((v) => setA.has(v))
        if (!overlap) return true // disjoint constant sets → mutually exclusive
      }
    }
  }
  return false
}

/**
 * §6a.2.3 same-variable conflict check (decidable, sound):
 *  - (0) an unconditional rule must be the only rule for that (on, variable);
 *  - (1)(2) otherwise every pair must be provably mutually exclusive via top-level eq/in conjuncts;
 *  - (3) any unprovable pair → Error.
 * Idempotent rules (same set value) are exempt. `enabled:false` rules are excluded.
 */
function checkTransitionConflicts(
  transitions: TransitionRule[],
  stateVars: Map<string, StateDeclaration>,
): StateBlockError[] {
  const errors: StateBlockError[] = []
  // Group enabled rules by (on, variable): rules that set that variable.
  const groups = new Map<string, TransitionRule[]>()
  for (const t of transitions) {
    if (t.enabled === false) continue
    if (!t.set) continue
    for (const varName of Object.keys(t.set)) {
      const key = `${t.on ?? ''}\u0000${varName}`
      const list = groups.get(key) ?? []
      list.push(t)
      groups.set(key, list)
    }
  }

  for (const [key, rules] of groups) {
    // Collect distinct set values for this (on, variable).
    const values = new Set(rules.map((r) => r.set![key.split('\u0000')[1]]))
    if (values.size <= 1) continue // idempotent (same value) → no conflict

    const [on, varName] = key.split('\u0000')

    // (0) unconditional rule must be unique.
    const unconditional = rules.filter((r) => isUnconditionalWhen(r.when))
    if (unconditional.length > 0 && rules.length > 1) {
      errors.push({
        code: 'TRANSITION_CONFLICT_UNCONDITIONAL',
        message: `event "${on}" sets variable "${varName}" via an unconditional rule that coexists with others (§6a.2.3 (0))`,
      })
      continue
    }

    // (1)(2)(3) pairwise mutual-exclusion proof.
    const conjuncts = rules.map((r) => extractExclusivityConjuncts(r.when))
    let allExclusive = true
    for (let i = 0; i < rules.length && allExclusive; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const ci = conjuncts[i]
        const cj = conjuncts[j]
        if (ci === null || cj === null || !provablyExclusive(ci, cj)) {
          allExclusive = false
          break
        }
      }
    }
    if (!allExclusive) {
      errors.push({
        code: 'TRANSITION_CONFLICT',
        message: `event "${on}" sets variable "${varName}" to different values ${[...values].join(',')} without provable mutual exclusion — deterministic conflict (§6a.2.3)`,
      })
    }
  }

  return errors
}

// ===============================================================
// §6a.2.4: state/event reference checks (load-time Error)
// ===============================================================

/** Extract field references from a `when` object (Simple conditions + expr tree + decision table). */
function extractFields(when: unknown): string[] {
  const fields: string[] = []
  if (!when || typeof when !== 'object') return fields
  const w = when as Record<string, unknown>
  const conds = w.conditions as Array<Record<string, unknown>> | undefined
  if (Array.isArray(conds)) {
    for (const c of conds) {
      if (typeof c.field === 'string') fields.push(c.field)
    }
  }
  if (w.expr !== undefined) collectExprFields(w.expr, fields)
  if (Array.isArray(w.columns)) {
    for (const col of w.columns) if (typeof col === 'string') fields.push(col)
  }
  return fields
}

/** Recursively collect `field` nodes from an expression tree. */
function collectExprFields(node: unknown, fields: string[]): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) collectExprFields(item, fields)
    return
  }
  const obj = node as Record<string, unknown>
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'field' && typeof val === 'string') {
      fields.push(val)
    } else if (typeof val === 'object' && val !== null) {
      collectExprFields(val, fields)
    }
  }
}

/** Rule input for reference checks (only when/unless are read). */
export interface RuleRefInput {
  when?: unknown
  unless?: unknown
}

/**
 * §6a.2.4 reference checks (load-time Error):
 *  - field path exactly "state" (no path segment) → Error
 *  - reference to an undeclared state.<name> → Error
 *  - rules referencing event.* → Error (event namespace is transition-only)
 */
export function validateStateRefs(
  rules: RuleRefInput[] | undefined,
  transitions: TransitionRule[] | undefined,
  state: StateDeclaration[] | undefined,
): StateBlockError[] {
  const errors: StateBlockError[] = []
  const declared = new Set((state ?? []).map((s) => s.name))

  const check = (fields: string[], location: 'rule' | 'transition') => {
    for (const f of fields) {
      if (f === 'state') {
        errors.push({ code: 'STATE_PATH_BARE', message: `field path "state" has no path segment (§6a.2.4)` })
      } else if (f.startsWith('state.')) {
        const name = f.slice('state.'.length).split('.')[0]
        if (!declared.has(name)) {
          errors.push({ code: 'STATE_REF_UNKNOWN', message: `reference to undeclared state variable "${name}" (field "${f}", §6a.2.4)` })
        }
      } else if (f.startsWith('event.') && location === 'rule') {
        errors.push({ code: 'EVENT_REF_IN_RULE', message: `rule references event.* field "${f}" (event is transition-only, §6a.2.4)` })
      } else if (location === 'transition' && !f.startsWith('event.')) {
        // §6a.2.4(c): a transition guard MUST read state.* / event.* only — any
        // other field (free fact) is rejected at load time, not null-propagated.
        errors.push({ code: 'FREE_FACT_IN_GUARD', message: `transition guard references free fact "${f}" (guards read state.* / event.* only, §6a.2.4)` })
      }
    }
  }

  for (const rule of rules ?? []) {
    check(extractFields(rule.when), 'rule')
    check(extractFields(rule.unless), 'rule')
  }
  for (const t of transitions ?? []) {
    check(extractFields(t.when), 'transition')
  }

  return errors
}

// ===============================================================
// §6a.2.2: transition guard node whitelist (load-time Error)
// ===============================================================

/** Recursively collect forbidden node keys from a `when` tree. */
function collectForbiddenNodes(node: unknown, forbidden: Set<string>): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) collectForbiddenNodes(item, forbidden)
    return
  }
  const obj = node as Record<string, unknown>
  for (const [key, val] of Object.entries(obj)) {
    if (GUARD_FORBIDDEN_NODES.has(key)) {
      forbidden.add(key)
    }
    if (typeof val === 'object' && val !== null) {
      collectForbiddenNodes(val, forbidden)
    }
  }
}

/**
 * §6a.2.2 guard node whitelist (load-time Error): transitions[].when MUST NOT use
 * quantifiers, arithmetic, aggregate, fn, or within/rate.
 */
export function validateTransitionGuard(
  transitions: TransitionRule[] | undefined,
): StateBlockError[] {
  const errors: StateBlockError[] = []
  for (const t of transitions ?? []) {
    if (t.when === undefined || t.when === null) continue
    const forbidden = new Set<string>()
    collectForbiddenNodes(t.when, forbidden)
    for (const node of forbidden) {
      errors.push({
        code: 'GUARD_FORBIDDEN_NODE',
        message: `transition guard uses forbidden node "${node}" (§6a.2.2 whitelist: no quantifier/arithmetic/aggregate/fn/within/rate)`,
      })
    }
  }
  return errors
}

// ===============================================================
// §6a.7.1: event payload resource limits (≤8 keys / depth ≤2 / scalar ≤256B)
// ===============================================================

const PAYLOAD_RESERVED_KEYS = new Set(['event_id', 'on', 'actor', 'at'])

/**
 * Validate an event's `payload` against §6a.7.1 resource limits. Returns a list
 * of breach codes (empty = valid). The event_id/on/actor/at fields are validated
 * separately by the caller; this checks only the payload shape.
 */
export function validateEventPayload(payload: Record<string, unknown> | undefined): StateBlockError[] {
  const errors: StateBlockError[] = []
  if (payload === undefined || payload === null) return errors
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push({ code: 'PAYLOAD_NOT_OBJECT', message: 'event payload must be an object (§6a.7.1)' })
    return errors
  }

  const keys = Object.keys(payload)
  if (keys.length > EVENT_PAYLOAD_LIMITS.maxKeys) {
    errors.push({ code: 'PAYLOAD_KEY_COUNT', message: `event payload has ${keys.length} keys > ${EVENT_PAYLOAD_LIMITS.maxKeys} (§6a.7.1)` })
  }
  for (const k of keys) {
    if (k.includes('.')) {
      errors.push({ code: 'PAYLOAD_KEY_DOT', message: `event payload key "${k}" MUST NOT contain "." (§6a.7.1)` })
    }
    if (PAYLOAD_RESERVED_KEYS.has(k)) {
      errors.push({ code: 'PAYLOAD_KEY_RESERVED', message: `event payload key "${k}" is reserved (§6a.7.1)` })
    }
  }

  // Depth ≤2 + leaf scalar ≤256B.
  const walk = (node: unknown, depth: number): void => {
    if (node === null || node === undefined) return
    if (typeof node === 'object' && !Array.isArray(node)) {
      if (depth + 1 > EVENT_PAYLOAD_LIMITS.maxDepth) {
        errors.push({ code: 'PAYLOAD_DEPTH', message: `event payload depth exceeds ${EVENT_PAYLOAD_LIMITS.maxDepth} (§6a.7.1)` })
        return
      }
      for (const v of Object.values(node as Record<string, unknown>)) walk(v, depth + 1)
    } else if (Array.isArray(node)) {
      errors.push({ code: 'PAYLOAD_ARRAY', message: 'event payload leaf MUST be scalar, not an array (§6a.7.1)' })
    } else {
      const s = String(node)
      if (Buffer.byteLength(s, 'utf8') > EVENT_PAYLOAD_LIMITS.maxValueBytes) {
        errors.push({ code: 'PAYLOAD_VALUE_SIZE', message: `event payload leaf exceeds ${EVENT_PAYLOAD_LIMITS.maxValueBytes} bytes (§6a.7.1)` })
      }
    }
  }
  for (const v of Object.values(payload)) walk(v, 1)

  return errors
}
