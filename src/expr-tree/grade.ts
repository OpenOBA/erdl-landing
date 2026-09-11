/**
 * grade - rule grading.
 *
 * Grade determines audit strength and recomputability claims; grade metadata
 * lives in extension fields, not in the core frozen fields.
 *
 * | Grade | Representation | Audit SLA |
 * |:---:|------|------|
 * | A | Pure Simple (28 condition operators) | Highest - same-grade text is recomputable |
 * | B | Expression tree (full kernel: quantifiers/arithmetic/aggregates/temporal) | High - eval_trace MUST |
 * | C | Contains function delegation | Tiered - grade C must not masquerade as plain-text recomputable |
 *
 * Grade is [derived] from rule content, not manually annotated:
 * - Uses function delegation -> C
 * - Uses kernel nodes beyond the Simple 28 condition operators (arithmetic/quantifiers/aggregates/temporal) -> B
 * - Uses only the Simple 28 condition operators -> A
 *
 * @license MIT
 */

import type { ExprNode } from './node-types.js'
import { treeUsesExtensionNodes } from './limits.js'

export type RuleGrade = 'A' | 'B' | 'C'

/**
 * Derive the grade of an expression tree (excluding the function-delegation
 * check, which is passed in from outside as hasFnDelegation).
 * - Contains function delegation -> C
 * - Contains extension nodes (arithmetic/quantifiers/aggregates/temporal) -> B
 * - Only Simple nodes -> A
 */
export function deriveGradeFromTree(root: ExprNode, hasFnDelegation: boolean): RuleGrade {
  if (hasFnDelegation) return 'C'
  if (treeUsesExtensionNodes(root)) return 'B'
  return 'A'
}

/** Audit SLA hints for each grade (for documentation/display). */
export const GRADE_AUDIT_SLA: Record<RuleGrade, string> = {
  A: 'Highest: recomputable from same-level text',
  B: 'High: eval_trace MUST',
  C: 'Tiered: grade C must not claim pure-text recomputability',
}
