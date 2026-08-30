/**
 * rule-to-expr - compile RuleDefinition (flat conditions) into an expression tree.
 *
 * Compiles a RuleCondition[] (as used by the flat evaluator in evaluator.ts)
 * into an expression tree, enabling cross-validation between the two
 * evaluation paths and normalization of the condition-evaluation layer.
 *
 * Semantics alignment:
 * - Operator alias normalization: matches->match, neq->ne
 * - Only pure conditions (field+operator+value) are compiled; within/rate/pattern/keywords are not (stateful/impure)
 * - conditionLogic: AND (default) / OR -> and/or tree
 *
 * @license MIT
 */

import type { RuleDefinition, RuleCondition } from '../rule-definition.js'
import type { ExprNode } from './node-types.js'
import { fromSExpr, extractWhenExpr } from './s-expression.js'
import { compileSimpleConditions, type SimpleCondition, type SimpleOperator } from './simple-compiler.js'
import { CONDITION_OPERATORS } from '../erdl-schema.js'

/** Map a RuleCondition operator -> SimpleOperator (normalize aliases + filter out impure operators). */
export function normalizeOperator(op: string | undefined): SimpleOperator | null {
  if (!op) return null
  // Normalize aliases
  if (op === 'matches') op = 'match'
  if (op === 'neq') op = 'ne'
  // Decide whether it is a SimpleOperator (checked against the single source of truth, not a local copy)
  return (CONDITION_OPERATORS as readonly string[]).includes(op) ? (op as SimpleOperator) : null
}

/** Convert a single RuleCondition -> SimpleCondition (returns null when it cannot be compiled). */
export function ruleConditionToSimple(cond: RuleCondition): SimpleCondition | null {
  // Impure conditions (within/rate/pattern/keywords) are not compiled
  if (cond.within || cond.rate || cond.pattern || cond.keywords) return null
  const field = cond.field
  if (!field) return null
  const op = normalizeOperator(cond.operator)
  if (op === null) return null
  return { field, operator: op, value: cond.value }
}

/**
 * Compile a RuleDefinition's when-conditions -> expression tree.
 * Returns null when the rule contains impure conditions (within/rate/pattern/keywords) and cannot be compiled into a pure tree.
 */
export function ruleWhenToExpr(rule: RuleDefinition): ExprNode | null {
  const conds = rule.conditions ?? []
  if (conds.length === 0) {
    // Empty conditions = always true (catch-all)
    return { type: 'literal', value: true }
  }
  const simples: SimpleCondition[] = []
  for (const cond of conds) {
    const s = ruleConditionToSimple(cond)
    if (s === null) return null // contains impure conditions
    simples.push(s)
  }
  const logic = rule.conditionLogic ?? 'AND'
  return compileSimpleConditions(simples, logic)
}

/**
 * Compile the when-clause of an LLM-generated rule JSON -> expression tree
 * (single entry point supporting both shapes).
 *
 * Two when shapes:
 * - flat { logic, conditions } (the Simple projection)
 * - S-expression expression tree (the Expression projection, including extension nodes such as temporal arithmetic)
 *
 * Used by NL-generation entry points; tolerant of malformed JSON and
 * normalizes aliases. Returns null when it cannot be compiled.
 */
export function jsonWhenToExpr(when: Record<string, unknown>): ExprNode | null {
  // Expression projection: prefer the when.expr wrapper shape,
  // with a fallback to the legacy shape where when itself is the tree.
  const exprValue = extractWhenExpr(when)
  if (exprValue !== null) {
    try {
      return fromSExpr(exprValue)
    } catch {
      return null
    }
  }

  const conds = when?.conditions as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(conds) || conds.length === 0) {
    // Empty conditions -> always true
    return { type: 'literal', value: true }
  }
  const logic = (when.logic as 'AND' | 'OR') ?? 'AND'
  const simples: SimpleCondition[] = []
  for (const c of conds) {
    const field = c?.field as string | undefined
    const op = c?.operator as string | undefined
    if (!field || !op) return null
    const normOp = normalizeOperator(op)
    if (normOp === null) return null
    simples.push({ field, operator: normOp, value: c.value })
  }
  return compileSimpleConditions(simples, logic)
}
