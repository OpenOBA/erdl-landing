/**
 * erdl-schema - the **single source of truth** for the ERDL deterministic kernel's enums.
 *
 * Why this file exists: operator/decision enums used to be scattered across
 * multiple places with diverging values - the kernel supported 30 operators
 * while the validator only allowed 13, the UI only showed 13, the compliance
 * entry point validated 15, and the LLM prompt was told about only 6. A
 * deterministic kernel with multiple divergent definitions is deterministic
 * in name only.
 *
 * This file is the sole authoritative source for these enums: **types are
 * derived from the constants** (`typeof X[number]`). Writing another union
 * type or string array elsewhere is not allowed. All consumers MUST import
 * this file.
 *
 * Anchors:
 *  - 30 operators = 28 condition operators + 2 condition modifiers
 *  - 28 condition operators -> expression-tree compilation mapping (13 direct + 6 not-derived + 9 length/count combinations)
 *  - 13 base decision types (the value domain of result.decision)
 *  - 34 semantic nodes (10 groups, frozen)
 *
 * Freeze level: the operator set / node set is frozen (may be extended,
 * semantics may not change); the 13-decision value domain enters the audit
 * chain with each decision object.
 *
 * @license MIT
 */

// ===============================================================
// 1. Operators (28 condition operators + 2 modifiers = 30)
// ===============================================================

/** Comparison family (6). */
export const OP_COMPARE = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'] as const
/** List family (2). */
export const OP_LIST = ['in', 'not_in'] as const
/** String family (5). */
export const OP_STRING = ['contains', 'not_contains', 'match', 'starts_with', 'ends_with'] as const
/** Boundary negation family (2). */
export const OP_BOUNDARY_NEG = ['not_starts_with', 'not_ends_with'] as const
/** Existence family (2; the only operators that sense a missing field). */
export const OP_EXISTENCE = ['exists', 'not_exists'] as const
/** Length family (5). */
export const OP_LENGTH = ['length_gt', 'length_gte', 'length_lt', 'length_lte', 'length_eq'] as const
/** Range family (2). */
export const OP_RANGE = ['between', 'not_between'] as const
/** Count family (4). */
export const OP_COUNT = ['count_gt', 'count_gte', 'count_lt', 'count_lte'] as const

/** The 28 condition operators (compiled into expression-tree evaluation). */
export const CONDITION_OPERATORS = [
  ...OP_COMPARE, ...OP_LIST, ...OP_STRING, ...OP_BOUNDARY_NEG,
  ...OP_EXISTENCE, ...OP_LENGTH, ...OP_RANGE, ...OP_COUNT,
] as const

/**
 * The 2 condition modifiers (stateful operators; their state lives outside the
 * tree and is maintained by GuardStateManager; window counts enter the decision
 * object via `evaluation.temporal_state`).
 * Truth semantics: count reaches the threshold -> fire; otherwise -> record + allow.
 *  - rate  = rate limiting: the first N occurrences are allowed and counted;
 *    from the (N+1)th occurrence on, the rule fires (nginx limit_req / Redis INCR semantics)
 *  - within = the threshold-1 variant of rate: the first occurrence is allowed and
 *    recorded; from the 2nd occurrence within the window on, the rule fires (deduplication)
 */
export const CONDITION_MODIFIERS = ['within', 'rate'] as const

/** Full set of 30 semantic units (28 condition operators + 2 modifiers). */
export const ALL_OPERATORS = [...CONDITION_OPERATORS, ...CONDITION_MODIFIERS] as const

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number]
export type ConditionModifier = (typeof CONDITION_MODIFIERS)[number]
export type AnyOperator = (typeof ALL_OPERATORS)[number]

/**
 * The **value shape** of each operator.
 *
 * Why it is needed: template-based authoring and UI dropdowns can only offer
 * operators whose value shape matches. Example: if a template's value is a
 * scalar input but the dropdown offers between (which needs a [min,max]
 * two-element array), picking it will always fail at compile time with
 * "between requires a [min, max] array" - selectable but guaranteed wrong.
 * Value shapes used to live only in human-readable documentation tables; they
 * now live in the single source of truth, shared by the UI / validator / LLM prompts.
 */
export const OP_VALUE_NONE = ['exists', 'not_exists'] as const
export const OP_VALUE_ARRAY = ['in', 'not_in'] as const
export const OP_VALUE_TUPLE = ['between', 'not_between'] as const
/** Operators whose value is a scalar (number/string/boolean/regex) = the 28 minus the three families above. */
export const OP_VALUE_SCALAR = CONDITION_OPERATORS.filter(
  (op) => !(OP_VALUE_NONE as readonly string[]).includes(op)
    && !(OP_VALUE_ARRAY as readonly string[]).includes(op)
    && !(OP_VALUE_TUPLE as readonly string[]).includes(op),
) as readonly ConditionOperator[]

export type OperatorValueShape = 'none' | 'scalar' | 'array' | 'tuple'

/** The value shape a given operator expects. */
export function operatorValueShape(op: string): OperatorValueShape | null {
  if ((OP_VALUE_NONE as readonly string[]).includes(op)) return 'none'
  if ((OP_VALUE_ARRAY as readonly string[]).includes(op)) return 'array'
  if ((OP_VALUE_TUPLE as readonly string[]).includes(op)) return 'tuple'
  if ((CONDITION_OPERATORS as readonly string[]).includes(op)) return 'scalar'
  return null
}

/**
 * Lenient parsing aliases (historical compatibility, not new operators).
 * After normalization the result must land inside CONDITION_OPERATORS.
 */
export const OPERATOR_ALIASES: Readonly<Record<string, ConditionOperator>> = Object.freeze({
  matches: 'match',
  neq: 'ne',
})

/** Compilation-target classification (used for self-verification that no operator is left dangling). */
export const OP_COMPILE_DIRECT = [
  ...OP_COMPARE, 'in', 'contains', 'starts_with', 'ends_with', 'match', 'exists', 'between',
] as const
export const OP_COMPILE_VIA_NOT = [
  'not_in', 'not_contains', 'not_starts_with', 'not_ends_with', 'not_exists', 'not_between',
] as const
export const OP_COMPILE_VIA_LENGTH_COUNT = [...OP_LENGTH, ...OP_COUNT] as const

export function isConditionOperator(v: unknown): v is ConditionOperator {
  return typeof v === 'string' && (CONDITION_OPERATORS as readonly string[]).includes(v)
}

/** Normalize an operator name (including aliases); returns null when invalid. */
export function normalizeOperatorName(op: string | undefined | null): ConditionOperator | null {
  if (!op) return null
  const mapped = OPERATOR_ALIASES[op] ?? op
  return isConditionOperator(mapped) ? mapped : null
}

// ===============================================================
// 2. Decisions (the 13 base decisions = the value domain of DO result.decision)
// ===============================================================

/** The 13 base decision types (the **only** value domain allowed in DO `result.decision`). */
export const DO_DECISIONS = [
  'ALLOW', 'DENY', 'CORRECT', 'NOTIFY', 'REQUEST_HUMAN', 'ESCALATE', 'DELEGATE',
  'DEFER', 'EMERGENCY_HALT', 'ROLLBACK', 'QUARANTINE', 'WORKFLOW', 'GUIDE',
] as const

/** Substates of the WORKFLOW state machine (not standalone decision types; not counted among the 13). */
export const WORKFLOW_SUBSTATES = ['WORKFLOW_WAITING', 'WORKFLOW_PROGRESS'] as const
/** All decision identifiers that can circulate inside the engine (15 = 13 base + 2 WORKFLOW substates). */
export const ALL_DECISIONS = [
  ...DO_DECISIONS, ...WORKFLOW_SUBSTATES,
] as const

/**
 * The subset of decisions allowed for Guard rules (derived here, in the single
 * source of truth, rather than as a local array in the validator).
 * = Ring 0-2 actions + the Ring 3 exceptions (ALLOW/CORRECT).
 */
export const GUARD_ALLOWED_DECISIONS = [
  'DENY', 'EMERGENCY_HALT',            // Ring 0
  'ROLLBACK', 'QUARANTINE',            // Ring 1
  'REQUEST_HUMAN', 'ESCALATE', 'DELEGATE', // Ring 2
  'CORRECT', 'ALLOW',                  // Ring 3 exceptions
] as const

/** Blocking decisions (used by quality gates such as wild-when-with-blocking-then). */
export const BLOCKING_DECISIONS = ['DENY', 'CORRECT', 'REQUEST_HUMAN', 'EMERGENCY_HALT'] as const

export type DODecision = (typeof DO_DECISIONS)[number]
export type Decision = (typeof ALL_DECISIONS)[number]

/** Whether a value may enter the DO's result.decision (value-domain gate). */
export function isDODecision(v: unknown): v is DODecision {
  return typeof v === 'string' && (DO_DECISIONS as readonly string[]).includes(v)
}
export function isDecision(v: unknown): v is Decision {
  return typeof v === 'string' && (ALL_DECISIONS as readonly string[]).includes(v)
}

// ===============================================================
// 3. Rule categories
// ===============================================================

/**
 * Rule categories: 11 in total. The category enum is not frozen and may be extended.
 */
export const RULE_CATEGORIES = [
  'coding', 'engineering', 'security', 'writing', 'design',
  'performance', 'testing', 'compliance', 'accessibility', 'observability', 'custom',
] as const
export type RuleCategory = (typeof RULE_CATEGORIES)[number]

/**
 * Registry of CAT prefixes for rule names (registration-based and extensible, not a closed set).
 * Prefix -> owning category. New business-domain prefixes MUST be registered here
 * first - "use first, register later" is forbidden.
 * The naming gate validates against this table unconditionally.
 */
export const RULE_NAME_PREFIXES: Readonly<Record<string, RuleCategory>> = Object.freeze({
  SEC: 'security',
  COD: 'coding',
  ENG: 'engineering',
  PRF: 'performance',
  TST: 'testing',
  WRT: 'writing',
  OBS: 'observability',
  CUS: 'custom',
  ETH: 'compliance',   // Ethics
  CMP: 'compliance',   // Compliance
  POL: 'compliance',   // Policy
  CNV: 'writing',      // Convention
})

// ===============================================================
// 4. The 34 semantic nodes (frozen) - countable per group, nothing left dangling
// ===============================================================

/**
 * The 34 semantic nodes listed group by group (10 groups). Their relationship to
 * the 20 discriminated types in `expr-tree/node-types.ts` is "semantic node <->
 * type projection" (parameterized nodes are merged), not a numeric contradiction.
 */
export const SEMANTIC_NODES = Object.freeze({
  value: ['field', 'var', 'literal'],
  logic: ['and', 'or', 'not'],
  comparison: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
  set: ['in'],
  string: ['contains', 'match', 'starts_with', 'ends_with'],
  existence: ['exists', 'length', 'between'],
  quantifier: ['all', 'any', 'none'],
  arithmetic: ['add', 'sub', 'mul', 'div', 'round'],
  time: ['days_between', 'epoch_ms', 'date_add', 'date_part', 'month_last_day'],
  aggregate: ['aggregate'],
}) as Readonly<Record<string, readonly string[]>>

/** Flat list of the 34 semantic node names. */
export const SEMANTIC_NODE_NAMES: readonly string[] = Object.freeze(Object.values(SEMANTIC_NODES).flat())

/** Full set of expression-tree discriminated type members (20; ExprNode['type'] from node-types.ts). */
export const EXPR_NODE_TYPES = [
  'field', 'var', 'literal', 'and', 'or', 'not', 'compare', 'in', 'string',
  'exists', 'length', 'between', 'quantifier', 'arith',
  'days_between', 'epoch_ms', 'date_add', 'date_part', 'month_last_day', 'aggregate',
] as const

// ===============================================================
// 5. Self-verification constants (for docs/prompts/tests to reference, eliminating hand-written number drift)
// ===============================================================

export const SCHEMA_COUNTS = Object.freeze({
  conditionOperators: CONDITION_OPERATORS.length, // 28
  conditionModifiers: CONDITION_MODIFIERS.length, // 2
  allOperators: ALL_OPERATORS.length,             // 30
  doDecisions: DO_DECISIONS.length,               // 13
  allDecisions: ALL_DECISIONS.length,             // 15
  semanticNodes: SEMANTIC_NODE_NAMES.length,      // 34
  exprNodeTypes: EXPR_NODE_TYPES.length,          // 20
  ruleCategories: RULE_CATEGORIES.length,         // 11
  ruleNamePrefixes: Object.keys(RULE_NAME_PREFIXES).length, // 12
})

/** Spec-alignment baseline (any change to this file must keep these references in sync). */
export const SPEC_BASELINE = Object.freeze({
  spec: 'erdl-spec',
  operators: 'Sec. 5.2 Simple 30 operators',
  decisions: 'Sec. 6 then decision types (13)',
  nodes: 'Sec. 5.3 Expression 34-node tree',
  temporalSemantics: 'Sec. 5.2 Simple (within/rate modifiers)',
})
