/**
 * ERDL expression tree - typed expression-tree kernel.
 *
 * The semantic kernel is a typed expression tree. The TS discriminated union
 * in this file has 20 type members: parameterized nodes (compare with 6
 * operators / string with 4 operators / arith with 5 operators / quantifier
 * with 3 quantifiers / aggregate with 5 aggregate functions) are merged into
 * a single type each, so the number of type members is smaller than the
 * number of S-expression semantic key names (see s-expression.ts).
 * The node set is frozen; it may only be pruned, never extended.
 *
 * This file defines two views of the kernel: the [in-memory type
 * representation] and the [S-expression canonical serialization]:
 *  - TS internals: a discriminated union (type field), giving the evaluator
 *    an exhaustive switch + type safety
 *  - S-expression (the external form; key names are the nodes): used for
 *    cross-implementation hashing / vectors / LLM-generation conformance
 *
 * The two are projections of the same tree with zero semantic loss - there
 * are not two evaluators.
 *
 * @license MIT
 */

// ===========================================
// 20 type members (parameterized nodes merged, see file header; frozen)
// ===========================================

/** Value access: field / var / literal. */
export type FieldNode = { type: 'field'; field: string }
export type VarNode = { type: 'var'; path: string }         // only '$' or '$.path'; reading clock/randomness is forbidden
export type LiteralNode = { type: 'literal'; value: unknown }

/** Logic: and / or / not. */
export type AndNode = { type: 'and'; args: ExprNode[] }
export type OrNode = { type: 'or'; args: ExprNode[] }
export type NotNode = { type: 'not'; arg: ExprNode }

/** Comparison: eq / ne / gt / gte / lt / lte (operands may be fields/variables/literals/arithmetic subtrees). */
export type CompareOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
export type CompareNode = { type: 'compare'; op: CompareOp; left: ExprNode; right: ExprNode }

/** Set: in. */
export type InNode = { type: 'in'; left: ExprNode; right: ExprNode }   // right evaluates to an array

/** String: contains / match / starts_with / ends_with. */
export type StringOp = 'contains' | 'match' | 'starts_with' | 'ends_with'
export type StringNode = { type: 'string'; op: StringOp; left: ExprNode; right: ExprNode }

/** Presence/dimension: exists / length / between. */
export type ExistsNode = { type: 'exists'; arg: ExprNode }
export type LengthNode = { type: 'length'; arg: ExprNode }
export type BetweenNode = { type: 'between'; value: ExprNode; min: ExprNode; max: ExprNode }

/** Quantifiers: all / any / none (per-element check over an array; see the evaluator for empty-array safe folding). */
export type QuantifierKind = 'all' | 'any' | 'none'
export type QuantifierNode = {
  type: 'quantifier'
  kind: QuantifierKind
  /** Binding variable name of the quantified element (e.g. 'x'). */
  binding: string
  /** The array source to iterate over. */
  over: ExprNode
  /** Predicate evaluated for each element (may reference the binding). */
  predicate: ExprNode
}

/** Arithmetic: add / sub / mul / div / round (deterministic fixed-point decimal operations). */
export type ArithOp = 'add' | 'sub' | 'mul' | 'div' | 'round'
export type ArithNode = { type: 'arith'; op: ArithOp; args: ExprNode[] }

/** Temporal: days_between / epoch_ms (reading the wall clock is forbidden; as_of is injected by the engine). */
export type DaysBetweenNode = { type: 'days_between'; from: ExprNode; to: ExprNode }
export type EpochMsNode = { type: 'epoch_ms'; arg: ExprNode }

/** Temporal addition units (parameterized: years/months/days/hours). */
export type DateAddUnit = 'years' | 'months' | 'days' | 'hours'
/** Temporal addition/subtraction: date_add{unit}; positive amount moves forward in time, negative amount moves backward. */
export type DateAddNode = { type: 'date_add'; unit: DateAddUnit; base: ExprNode; amount: ExprNode }

/** Temporal component units (parameterized). */
export type DatePartUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'day_of_week'
/** Extract a temporal component: date_part{unit} (day_of_week: 1 = Monday ... 7 = Sunday). */
export type DatePartNode = { type: 'date_part'; unit: DatePartUnit; arg: ExprNode }

/** Last day of the month containing the given date (the underlying primitive for end-of-month clamping). */
export type MonthLastDayNode = { type: 'month_last_day'; arg: ExprNode }

/** Aggregation: aggregate(count/sum/avg/min/max), array aggregation with an optional structured window. */
export type AggregateFn = 'count' | 'sum' | 'avg' | 'min' | 'max'
export type AggregateNode = { type: 'aggregate'; fn: AggregateFn; over: ExprNode }

/** Expression tree node union (20 discriminated-union type members after the temporal node family extension). */
export type ExprNode =
  | FieldNode | VarNode | LiteralNode
  | AndNode | OrNode | NotNode
  | CompareNode
  | InNode
  | StringNode
  | ExistsNode | LengthNode | BetweenNode
  | QuantifierNode
  | ArithNode
  | DaysBetweenNode | EpochMsNode | DateAddNode | DatePartNode | MonthLastDayNode
  | AggregateNode

// ===========================================
// Node type classification (for validation / resource limits / canonicalization)
// ===========================================

export const NODE_TYPE_LABELS: Record<ExprNode['type'], string> = {
  field: 'field', var: 'var', literal: 'literal',
  and: 'and', or: 'or', not: 'not',
  compare: 'compare', in: 'in', string: 'string',
  exists: 'exists', length: 'length', between: 'between',
  quantifier: 'quantifier', arith: 'arith',
  days_between: 'days_between', epoch_ms: 'epoch_ms', aggregate: 'aggregate',
  date_add: 'date_add', date_part: 'date_part', month_last_day: 'month_last_day',
}

/** Leaf nodes (no children). */
export type LeafNodeType = 'field' | 'var' | 'literal'
/** Logic combinators. */
export type LogicNodeType = 'and' | 'or' | 'not'

export function isLeaf(node: ExprNode): node is FieldNode | VarNode | LiteralNode {
  return node.type === 'field' || node.type === 'var' || node.type === 'literal'
}
