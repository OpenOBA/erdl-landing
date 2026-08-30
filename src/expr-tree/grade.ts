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
import { childNodes } from './limits.js'

export type RuleGrade = 'A' | 'B' | 'C'

/** Node types corresponding to the Simple 28 condition operators (no arithmetic/quantifier/aggregate/temporal extensions). */
const SIMPLE_ONLY_NODE_TYPES = new Set<ExprNode['type']>([
  'field', 'var', 'literal',
  'and', 'or', 'not',
  'compare', 'in', 'string',
  'exists', 'length', 'between',
])

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

/** Check whether the tree uses kernel extension nodes beyond Simple (arithmetic/quantifiers/aggregates/temporal). */
function treeUsesExtensionNodes(node: ExprNode): boolean {
  // Root node is an extension type -> true
  if (!SIMPLE_ONLY_NODE_TYPES.has(node.type)) return true
  // Recursively check child nodes
  const children = childNodes(node)
  for (const child of children) {
    if (treeUsesExtensionNodes(child)) return true
  }
  return false
}

/** Audit SLA hints for each grade (for documentation/display). */
export const GRADE_AUDIT_SLA: Record<RuleGrade, string> = {
  A: 'Highest: recomputable from same-level text',
  B: 'High: eval_trace MUST',
  C: 'Tiered: grade C must not claim pure-text recomputability',
}
