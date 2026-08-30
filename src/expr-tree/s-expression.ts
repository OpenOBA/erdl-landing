/**
 * s-expression - S-expression serialization of expression trees (the external form).
 *
 * External form: key names are the nodes and children are arrays, e.g.:
 *   { lt: [ { div: [ {sub: [...]}, {field: "..."} ] }, 0.15 ] }
 *
 * Relationship to the TS discriminated union (the type field in node-types.ts):
 *   - In memory: discriminated union (type field), giving the evaluator an
 *     exhaustive switch + type safety
 *   - Serialization/hashing: S-expression (key names are the nodes), for
 *     cross-implementation hash conformance
 *   The two are bidirectionally reversible projections of the same tree, with
 *   zero semantic loss.
 *
 * Key-name convention (parameterized nodes expand to concrete operator names):
 *   field/var/literal, and/or/not,
 *   eq/ne/gt/gte/lt/lte, in,
 *   contains/match/starts_with/ends_with,
 *   exists/length/between, all/any/none,
 *   add/sub/mul/div/round, days_between/epoch_ms,
 *   count/sum/avg/min/max
 *
 * Literal conventions:
 *   - bare values (number/string/boolean/null) = literal node
 *   - { field: "path" } = field node
 *   - { var: "path" } = var node (path is only '$'/'$.x')
 *
 * @license MIT
 */

import type { ExprNode, CompareOp, StringOp, ArithOp, QuantifierKind, AggregateFn, DateAddUnit, DatePartUnit } from './node-types.js'

// ===========================================
// TS -> S-expression (serialization)
// ===========================================

export function toSExpr(node: ExprNode): unknown {
  switch (node.type) {
    case 'literal':
      return node.value
    case 'field':
      return { field: node.field }
    case 'var':
      return { var: node.path }

    case 'and':
    case 'or':
      return { [node.type]: node.args.map(toSExpr) }
    case 'not':
      return { not: toSExpr(node.arg) }

    case 'compare':
      return { [node.op]: [toSExpr(node.left), toSExpr(node.right)] }
    case 'in':
      return { in: [toSExpr(node.left), toSExpr(node.right)] }
    case 'string':
      return { [node.op]: [toSExpr(node.left), toSExpr(node.right)] }

    case 'exists':
      return { exists: toSExpr(node.arg) }
    case 'length':
      return { length: toSExpr(node.arg) }
    case 'between':
      return { between: [toSExpr(node.value), toSExpr(node.min), toSExpr(node.max)] }

    case 'quantifier':
      return {
        [node.kind]: {
          binding: node.binding,
          over: toSExpr(node.over),
          predicate: toSExpr(node.predicate),
        },
      }

    case 'arith':
      return { [node.op]: node.args.map(toSExpr) }

    case 'days_between':
      return { days_between: [toSExpr(node.from), toSExpr(node.to)] }
    case 'epoch_ms':
      return { epoch_ms: toSExpr(node.arg) }
    case 'date_add':
      // Key is forced to date_add; unit is kept as an object field to preserve parameterized semantics
      return { date_add: { unit: node.unit, base: toSExpr(node.base), amount: toSExpr(node.amount) } }
    case 'date_part':
      return { date_part: { unit: node.unit, arg: toSExpr(node.arg) } }
    case 'month_last_day':
      return { month_last_day: toSExpr(node.arg) }

    case 'aggregate':
      return { [node.fn]: toSExpr(node.over) }
  }
}

// ===========================================
// S-expression -> TS (deserialization)
// ===========================================

const COMPARE_OPS: CompareOp[] = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte']
const STRING_OPS: StringOp[] = ['contains', 'match', 'starts_with', 'ends_with']
const ARITH_OPS: ArithOp[] = ['add', 'sub', 'mul', 'div', 'round']
const QUANT_KINDS: QuantifierKind[] = ['all', 'any', 'none']
const AGGREGATE_FNS: AggregateFn[] = ['count', 'sum', 'avg', 'min', 'max']
const DATE_ADD_UNITS: DateAddUnit[] = ['years', 'months', 'days', 'hours']
const DATE_PART_UNITS: DatePartUnit[] = ['year', 'month', 'day', 'hour', 'minute', 'second', 'day_of_week']

export class SExprParseError extends Error {
  constructor(message: string) {
    super(`[SExpr] ${message}`)
    this.name = 'SExprParseError'
  }
}

export function fromSExpr(input: unknown): ExprNode {
  // Bare value -> literal
  if (input === null || typeof input !== 'object') {
    return { type: 'literal', value: input }
  }
  if (Array.isArray(input)) {
    // Bare array -> literal node (e.g. the set value of in, ["a","b","c"]; elements are not recursed into nodes)
    return { type: 'literal', value: input }
  }

  const obj = input as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.length !== 1) {
    throw new SExprParseError(`each S-expression node must have exactly one key, got ${keys.length}: ${keys.join(',')}`)
  }
  const key = keys[0]
  const val = obj[key]

  switch (key) {
    case 'field':
      return { type: 'field', field: String(val) }
    case 'var':
      return { type: 'var', path: String(val) }
    case 'and':
    case 'or': {
      if (!Array.isArray(val)) throw new SExprParseError(`value of ${key} must be an array`)
      return { type: key, args: val.map(fromSExpr) }
    }
    case 'not':
      return { type: 'not', arg: fromSExpr(val) }
    case 'in': {
      if (!Array.isArray(val) || val.length !== 2) throw new SExprParseError('in requires two operands')
      return { type: 'in', left: fromSExpr(val[0]), right: fromSExpr(val[1]) }
    }
    case 'exists':
      return { type: 'exists', arg: fromSExpr(val) }
    case 'length':
      return { type: 'length', arg: fromSExpr(val) }
    case 'between': {
      if (!Array.isArray(val) || val.length !== 3) throw new SExprParseError('between requires three operands')
      return { type: 'between', value: fromSExpr(val[0]), min: fromSExpr(val[1]), max: fromSExpr(val[2]) }
    }
    case 'days_between': {
      if (!Array.isArray(val) || val.length !== 2) throw new SExprParseError('days_between requires two operands')
      return { type: 'days_between', from: fromSExpr(val[0]), to: fromSExpr(val[1]) }
    }
    case 'epoch_ms':
      return { type: 'epoch_ms', arg: fromSExpr(val) }
    case 'date_add': {
      if (typeof val !== 'object' || val === null) throw new SExprParseError('value of date_add must be an object {unit,base,amount}')
      const o = val as Record<string, unknown>
      if (!DATE_ADD_UNITS.includes(o.unit as DateAddUnit)) throw new SExprParseError(`unknown date_add unit: ${o.unit}`)
      return { type: 'date_add', unit: o.unit as DateAddUnit, base: fromSExpr(o.base), amount: fromSExpr(o.amount) }
    }
    case 'date_part': {
      if (typeof val !== 'object' || val === null) throw new SExprParseError('value of date_part must be an object {unit,arg}')
      const o = val as Record<string, unknown>
      if (!DATE_PART_UNITS.includes(o.unit as DatePartUnit)) throw new SExprParseError(`unknown date_part component: ${o.unit}`)
      return { type: 'date_part', unit: o.unit as DatePartUnit, arg: fromSExpr(o.arg) }
    }
    case 'month_last_day':
      return { type: 'month_last_day', arg: fromSExpr(val) }
  }

  // Parameterized nodes: compare / string / arith / quantifier / aggregate
  if (COMPARE_OPS.includes(key as CompareOp)) {
    if (!Array.isArray(val) || val.length !== 2) throw new SExprParseError(`${key} requires two operands`)
    return { type: 'compare', op: key as CompareOp, left: fromSExpr(val[0]), right: fromSExpr(val[1]) }
  }

  // Simple negation-dual operators (not_in/not_contains/...) -> leniently parsed as not(xxx(...)).
  // The expression-tree canon derives these with not, but an LLM may emit the Simple operator
  // names directly; normalize them to not-trees here to avoid false rejections.
  // Semantic boundary (null propagation): not_in(x,list) with x absent gives in->false, not->true,
  // which may unexpectedly allow; this semantics is defined by null propagation and must stay
  // consistent across implementations (a documented determinism risk - do not change the semantics).
  if (key === 'not_in') {
    if (!Array.isArray(val) || val.length !== 2) throw new SExprParseError('not_in requires two operands')
    return { type: 'not', arg: { type: 'in', left: fromSExpr(val[0]), right: fromSExpr(val[1]) } }
  }
  if (key === 'not_contains' || key === 'not_starts_with' || key === 'not_ends_with') {
    if (!Array.isArray(val) || val.length !== 2) throw new SExprParseError(`${key} requires two operands`)
    const innerOp = key === 'not_contains' ? 'contains' : key === 'not_starts_with' ? 'starts_with' : 'ends_with'
    return { type: 'not', arg: { type: 'string', op: innerOp as StringOp, left: fromSExpr(val[0]), right: fromSExpr(val[1]) } }
  }
  if (key === 'not_exists') {
    return { type: 'not', arg: { type: 'exists', arg: fromSExpr(val) } }
  }
  if (key === 'not_between') {
    if (!Array.isArray(val) || val.length !== 3) throw new SExprParseError('not_between requires three operands')
    return { type: 'not', arg: { type: 'between', value: fromSExpr(val[0]), min: fromSExpr(val[1]), max: fromSExpr(val[2]) } }
  }

  if (STRING_OPS.includes(key as StringOp)) {
    if (!Array.isArray(val) || val.length !== 2) throw new SExprParseError(`${key} requires two operands`)
    return { type: 'string', op: key as StringOp, left: fromSExpr(val[0]), right: fromSExpr(val[1]) }
  }
  if (ARITH_OPS.includes(key as ArithOp)) {
    if (!Array.isArray(val)) throw new SExprParseError(`value of ${key} must be an array`)
    return { type: 'arith', op: key as ArithOp, args: val.map(fromSExpr) }
  }
  if (QUANT_KINDS.includes(key as QuantifierKind)) {
    if (typeof val !== 'object' || val === null) throw new SExprParseError(`value of ${key} must be an object {binding,over,predicate}`)
    const q = val as Record<string, unknown>
    return {
      type: 'quantifier',
      kind: key as QuantifierKind,
      binding: String(q.binding),
      over: fromSExpr(q.over),
      predicate: fromSExpr(q.predicate),
    }
  }
  if (AGGREGATE_FNS.includes(key as AggregateFn)) {
    return { type: 'aggregate', fn: key as AggregateFn, over: fromSExpr(val) }
  }

  throw new SExprParseError(`unknown node key: ${key}`)
}

/** Round-trip test helper: toSExpr -> fromSExpr should restore the tree (structurally equivalent). */
export function roundtrip(node: ExprNode): ExprNode {
  return fromSExpr(toSExpr(node))
}

/**
 * Determine whether a value is an S-expression expression tree (as opposed to
 * a flat {logic, conditions} / shorthand structure).
 *
 * Decision basis (negative tests, lenient first):
 * - non-object / array / null / string -> no
 * - contains conditions / logic / expr / decision_table keys -> not a pure
 *   S-expression (it is a when-level structure)
 * - otherwise attempt fromSExpr parsing; success means it is an S-expression
 *
 * This is the single entry point for "when-shape detection" (shared by
 * evaluation / gloss / serializer, avoiding divergent per-site checks).
 */
export function isSExprWhen(when: unknown): boolean {
  if (when === null || when === undefined) return false
  if (typeof when !== 'object' || Array.isArray(when)) return false
  const obj = when as Record<string, unknown>
  // A when-level structure (containing conditions / logic / expr / decision_table) is not a pure S-expression
  if ('conditions' in obj || 'logic' in obj || 'expr' in obj || 'decision_table' in obj) return false
  try {
    fromSExpr(when)
    return true
  } catch {
    return false
  }
}

/**
 * Extract the raw S-expression value of an expression tree from a when
 * structure (the canonical shape is when.expr).
 *
 * Recognizes two written shapes of the Expression projection:
 * - wrapped shape (canonical): `when: { expr: { lt: [...] } }` -> returns the expr value
 * - top-level tree (compatibility shape): `when: { lt: [...] }` -> returns when itself
 *
 * Returns null when it is not the Expression projection (it may be flat
 * conditions or something else).
 */
export function extractWhenExpr(when: unknown): unknown | null {
  if (when === null || when === undefined || typeof when !== 'object' || Array.isArray(when)) {
    return null
  }
  const obj = when as Record<string, unknown>

  // Canonical shape: the when.expr wrapper
  if ('expr' in obj) {
    const inner = obj['expr']
    try {
      fromSExpr(inner) // validate that the expr value is a legal S-expression
      return inner
    } catch {
      return null
    }
  }

  // Compatibility shape: when itself is the tree
  if (isSExprWhen(when)) {
    return when
  }

  return null
}
