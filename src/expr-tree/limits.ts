/**
 * limits - resource limit checks.
 *
 * Hard resource quotas protecting against expression-tree bloat attacks:
 * - Grade A (Simple kernel): arith depth <= 2, tree depth <= 6, nodes <= 64, no quantifiers
 * - Grade B (extension nodes): arith depth <= 4, tree depth <= 10, nodes <= 256, quantifier nesting <= 2
 * - array length <= 10000
 * - regex steps <= 10000 (see safe-regex)
 *
 * @license MIT
 */

import type { ExprNode } from './node-types.js'

/** Resource quota grade. A = Simple-only kernel; B = extension nodes (quantifier/arithmetic/aggregate/temporal/fn). */
export type ResourceGrade = 'A' | 'B'

interface GradeLimits {
  MAX_ARITH_DEPTH: number
  MAX_TREE_DEPTH: number
  MAX_NODES: number
  MAX_QUANTIFIER_NESTING: number
}

export const LIMITS = {
  MAX_ARRAY_LENGTH: 10000,
  MAX_REGEX_STEPS: 10000,
  GRADES: {
    A: { MAX_ARITH_DEPTH: 2, MAX_TREE_DEPTH: 6, MAX_NODES: 64, MAX_QUANTIFIER_NESTING: 0 },
    B: { MAX_ARITH_DEPTH: 4, MAX_TREE_DEPTH: 10, MAX_NODES: 256, MAX_QUANTIFIER_NESTING: 2 },
  } satisfies Record<ResourceGrade, GradeLimits>,
}

export class ExprLimitError extends Error {
  constructor(message: string) {
    super(`[ExprLimit] ${message}`)
    this.name = 'ExprLimitError'
  }
}

/** Measure the tree's node count, depth, and arithmetic depth. */
export function measure(node: ExprNode, depth = 0, arithDepth = 0): { nodes: number; depth: number; arithDepth: number } {
  let nodes = 1
  let maxDepth = depth
  let maxArithDepth = arithDepth
  const curArith = node.type === 'arith' ? arithDepth + 1 : arithDepth
  if (node.type === 'arith') maxArithDepth = Math.max(maxArithDepth, curArith)

  const children = childNodes(node)
  for (const child of children) {
    const m = measure(child, depth + 1, curArith)
    nodes += m.nodes
    maxDepth = Math.max(maxDepth, m.depth)
    maxArithDepth = Math.max(maxArithDepth, m.arithDepth)
  }
  return { nodes, depth: maxDepth, arithDepth: maxArithDepth }
}

/** Node types of the Simple (Grade A) kernel — no arithmetic/quantifier/aggregate/temporal/fn extensions. */
const SIMPLE_ONLY_NODE_TYPES = new Set<ExprNode['type']>([
  'field', 'var', 'literal',
  'and', 'or', 'not',
  'compare', 'in', 'string',
  'exists', 'length', 'between',
])

/** Whether the tree uses kernel extension nodes beyond Simple (i.e. it is Grade B/C, not Grade A). */
export function treeUsesExtensionNodes(node: ExprNode): boolean {
  if (!SIMPLE_ONLY_NODE_TYPES.has(node.type)) return true
  const children = childNodes(node)
  for (const child of children) {
    if (treeUsesExtensionNodes(child)) return true
  }
  return false
}

/** Validate that the tree is within its grade limits; throws ExprLimitError when exceeded. */
export function enforceLimits(root: ExprNode, grade?: ResourceGrade): void {
  const g: ResourceGrade = grade ?? (treeUsesExtensionNodes(root) ? 'B' : 'A')
  const limits = LIMITS.GRADES[g]
  const { nodes, depth, arithDepth } = measure(root)
  if (nodes > limits.MAX_NODES) {
    throw new ExprLimitError(`node count ${nodes} exceeds ${g}-grade limit ${limits.MAX_NODES}`)
  }
  if (depth > limits.MAX_TREE_DEPTH) {
    throw new ExprLimitError(`tree depth ${depth} exceeds ${g}-grade limit ${limits.MAX_TREE_DEPTH}`)
  }
  if (arithDepth > limits.MAX_ARITH_DEPTH) {
    throw new ExprLimitError(`arithmetic depth ${arithDepth} exceeds ${g}-grade limit ${limits.MAX_ARITH_DEPTH}`)
  }
  // Array literal length <= 10000
  const arrLen = maxArrayLength(root)
  if (arrLen > LIMITS.MAX_ARRAY_LENGTH) {
    throw new ExprLimitError(`array length ${arrLen} exceeds limit ${LIMITS.MAX_ARRAY_LENGTH}`)
  }
  // Quantifier nesting <= grade limit
  const nesting = quantifierNestingDepth(root)
  if (nesting > limits.MAX_QUANTIFIER_NESTING) {
    throw new ExprLimitError(`quantifier nesting ${nesting} exceeds ${g}-grade limit ${limits.MAX_QUANTIFIER_NESTING}`)
  }
}

/** Walk the tree and return the maximum array literal length. */
function maxArrayLength(node: ExprNode): number {
  let max = 0
  const walk = (n: ExprNode): void => {
    if (n.type === 'literal' && Array.isArray(n.value)) max = Math.max(max, n.value.length)
    for (const c of childNodes(n)) walk(c)
  }
  walk(node)
  return max
}

/** Measure quantifier nesting depth (a quantifier inside another quantifier's predicate counts +1). */
function quantifierNestingDepth(root: ExprNode): number {
  let max = 0
  const walk = (n: ExprNode, depth: number): void => {
    if (n.type === 'quantifier') {
      max = Math.max(max, depth + 1)
      walk(n.over, depth)          // over is evaluated in the enclosing scope
      walk(n.predicate, depth + 1) // predicate is nested one level deeper
      return
    }
    for (const c of childNodes(n)) walk(c, depth)
  }
  walk(root, 0)
  return max
}

/** Get all child nodes of a node. */
export function childNodes(node: ExprNode): ExprNode[] {
  switch (node.type) {
    case 'field':
    case 'var':
    case 'literal':
      return []
    case 'and':
    case 'or':
      return node.args
    case 'not':
      return [node.arg]
    case 'compare':
      return [node.left, node.right]
    case 'in':
      return [node.left, node.right]
    case 'string':
      return [node.left, node.right]
    case 'exists':
      return [node.arg]
    case 'length':
      return [node.arg]
    case 'between':
      return [node.value, node.min, node.max]
    case 'quantifier':
      return [node.over, node.predicate]
    case 'arith':
      return node.args
    case 'days_between':
      return [node.from, node.to]
    case 'epoch_ms':
      return [node.arg]
    case 'date_add':
      return [node.base, node.amount]
    case 'date_part':
      return [node.arg]
    case 'month_last_day':
      return [node.arg]
    case 'aggregate':
      return [node.over]
    case 'fn':
      return node.args
  }
}
