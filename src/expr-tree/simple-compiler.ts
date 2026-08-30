/**
 * simple-compiler - compile the Simple condition operators (28) into expression trees.
 *
 * The Simple surface is "28 condition operators + 2 modifiers (within/rate) =
 * 30 semantic units". This file compiles only the 28 condition operators;
 * within/rate are stateful modifiers handled outside the tree
 * (GuardStateManager) and are not compiled here.
 * The evaluation core converges from "operator branching" to "node-type traversal".
 *
 * Compilation targets of the 28 condition operators (canonical mapping):
 * - 13 direct nodes: eq/ne/gt/gte/lt/lte . in . contains/starts_with/ends_with/match . exists . between
 * - 6  not combinations: not_in/not_contains/not_starts_with/not_ends_with/not_exists/not_between
 * - 9  length/count combinations: length_gt/gte/lt/lte/eq (5) + count_gt/gte/lt/lte (4)
 * - 2  temporal modifiers: within/rate (state lives outside the tree in
 *   GuardStateManager; not compiled into tree evaluation - see below)
 *
 * @license MIT
 */

import type { ExprNode } from './node-types.js'
import type { ConditionOperator } from '../erdl-schema.js'

/** Full set of Simple condition operators (28, frozen at the canonical level; excluding the within/rate modifiers).
 * Derived from the single source of truth (ConditionOperator) instead of a local copy. */
export type SimpleOperator = ConditionOperator

/** Simple condition (field + operator + value triple). */
export interface SimpleCondition {
  field: string
  operator: SimpleOperator
  value?: unknown
}

export class SimpleCompileError extends Error {
  constructor(message: string) {
    super(`[SimpleCompile] ${message}`)
    this.name = 'SimpleCompileError'
  }
}

/** Build a field reference node. */
function field(name: string): ExprNode {
  return { type: 'field', field: name }
}

/** Build a literal node. */
function literal(value: unknown): ExprNode {
  return { type: 'literal', value }
}

/** Build a compare node. */
function cmp(op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte', left: ExprNode, right: ExprNode): ExprNode {
  return { type: 'compare', op, left, right }
}

/** Build a not node. */
function not(arg: ExprNode): ExprNode {
  return { type: 'not', arg }
}

/**
 * exists guard (null propagation): derived operators (not_* / length_*) must return false
 * for a missing field, instead of being misjudged as true after a not-flip or a numeric comparison.
 * Compiled as exists(field) AND <inner> - when the field is missing (undefined/null),
 * exists=false -> the whole condition is false.
 * Rationale: compiling not_* as not(positive operator) would let the positive operator return
 * false for a missing field, and not(false)=true would flip null propagation (a fail-open safety
 * hole); length_* has the same problem (length(missing)=0, and 0>negative / 0==0 would wrongly pass).
 */
function andExists(fieldName: string, inner: ExprNode): ExprNode {
  return { type: 'and', args: [{ type: 'exists', arg: field(fieldName) }, inner] }
}

/**
 * Compile a single Simple condition -> expression tree node,
 * following the canonical operator mapping.
 */
export function compileSimpleCondition(cond: SimpleCondition): ExprNode {
  const { field: fieldName, operator, value } = cond
  if (!fieldName) throw new SimpleCompileError('field must not be empty')

  switch (operator) {
    // -- 13 direct nodes --
    case 'eq': case 'ne': case 'gt': case 'gte': case 'lt': case 'lte':
      return cmp(operator, field(fieldName), literal(value))
    case 'in':
      return { type: 'in', left: field(fieldName), right: literal(value) }
    case 'contains':
    case 'starts_with':
    case 'ends_with':
    case 'match':
      return { type: 'string', op: operator, left: field(fieldName), right: literal(value) }
    case 'exists':
      return { type: 'exists', arg: field(fieldName) }
    case 'between': {
      // value must be [min, max]
      if (!Array.isArray(value) || value.length !== 2) {
        throw new SimpleCompileError(`between requires a [min, max] array, got ${JSON.stringify(value)}`)
      }
      return { type: 'between', value: field(fieldName), min: literal(value[0]), max: literal(value[1]) }
    }

    // -- 6 not combinations (not_* get an exists guard so a missing field is not not-flipped) --
    case 'not_in':
      return andExists(fieldName, not({ type: 'in', left: field(fieldName), right: literal(value) }))
    case 'not_contains':
      return andExists(fieldName, not({ type: 'string', op: 'contains', left: field(fieldName), right: literal(value) }))
    case 'not_starts_with':
      return andExists(fieldName, not({ type: 'string', op: 'starts_with', left: field(fieldName), right: literal(value) }))
    case 'not_ends_with':
      return andExists(fieldName, not({ type: 'string', op: 'ends_with', left: field(fieldName), right: literal(value) }))
    case 'not_exists':
      // not_exists is one of the few operators that senses field presence (null propagation);
      // keep not(exists) and do not add an exists guard
      return not({ type: 'exists', arg: field(fieldName) })
    case 'not_between': {
      if (!Array.isArray(value) || value.length !== 2) {
        throw new SimpleCompileError(`not_between requires a [min, max] array, got ${JSON.stringify(value)}`)
      }
      return andExists(fieldName, not({ type: 'between', value: field(fieldName), min: literal(value[0]), max: literal(value[1]) }))
    }

    // -- 9 length/count combinations (length_*/count_* get an exists guard so a missing field is not misjudged via 0/null values) --
    case 'length_gt': return andExists(fieldName, cmp('gt', lengthOf(fieldName), literal(value)))
    case 'length_gte': return andExists(fieldName, cmp('gte', lengthOf(fieldName), literal(value)))
    case 'length_lt': return andExists(fieldName, cmp('lt', lengthOf(fieldName), literal(value)))
    case 'length_lte': return andExists(fieldName, cmp('lte', lengthOf(fieldName), literal(value)))
    case 'length_eq': return andExists(fieldName, cmp('eq', lengthOf(fieldName), literal(value)))
    case 'count_gt': return andExists(fieldName, cmp('gt', countOf(fieldName), literal(value)))
    case 'count_gte': return andExists(fieldName, cmp('gte', countOf(fieldName), literal(value)))
    case 'count_lt': return andExists(fieldName, cmp('lt', countOf(fieldName), literal(value)))
    case 'count_lte': return andExists(fieldName, cmp('lte', countOf(fieldName), literal(value)))

    default:
      // within/rate are stateful operators and are not compiled here (their state lives outside the tree)
      throw new SimpleCompileError(`unsupported Simple operator: ${operator}`)
  }
}

/** length(field) node. */
function lengthOf(fieldName: string): ExprNode {
  return { type: 'length', arg: field(fieldName) }
}

/** count(field) node (aggregate count). */
function countOf(fieldName: string): ExprNode {
  return { type: 'aggregate', fn: 'count', over: field(fieldName) }
}

/**
 * Compile a set of Simple conditions -> an and-combination tree.
 * Empty array -> literal true (always true).
 */
export function compileSimpleConditions(conds: SimpleCondition[], logic: 'AND' | 'OR' = 'AND'): ExprNode {
  if (conds.length === 0) return literal(true)
  const nodes = conds.map(compileSimpleCondition)
  if (nodes.length === 1) return nodes[0]
  return { type: logic === 'OR' ? 'or' : 'and', args: nodes }
}
