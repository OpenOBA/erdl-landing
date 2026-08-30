/**
 * decision-table - decision table projection.
 *
 * A decision table is matrix-shaped (rows = condition combinations, columns =
 * condition dimensions), aimed at pricing, approval and discount rules written
 * by business/finance users.
 * It compiles into the same kernel (expression tree) - each row's condition
 * combination compiles to an and-tree; inter-row semantics are described below.
 *
 * The defining property is "matrix form, compiled into the same kernel"; no
 * specific row/column syntax is imposed. This implementation adopts standard
 * decision-table semantics (a simplified DMN), with the structural convention
 * made explicit:
 * - column = condition field (column name)
 * - row = condition values for the columns (all conditions within a row are ANDed)
 * - one decision (action) per row
 * - inter-row hit policy: single hit (first match); the caller selects by priority
 *
 * The compilation output is a list of "row -> { condition tree (ExprNode) + decision }";
 * each row's condition tree is an and-combination in the same expression-tree
 * kernel - this is what "compiles into the same kernel" means in practice.
 *
 * @license MIT
 */

import type { ExprNode } from './node-types.js'
import { compileSimpleCondition } from './simple-compiler.js'

/** Decision table (matrix form). */
export interface DecisionTable {
  /** Condition columns (field names). */
  columns: string[]
  /** Rows: each row is condition values + decision. */
  rows: DecisionTableRow[]
}

/** A single row of a decision table. */
export interface DecisionTableRow {
  /** Condition values for this row's columns (key = column name, value = expected value; missing column = unconstrained). */
  conditions: Record<string, unknown>
  /** The decision (action) for this row. */
  decision: string
  /** Priority (under the single-hit policy, earlier matches win). */
  priority?: number
}

/** Compilation output: one row -> condition tree + decision. */
export interface CompiledDecisionRow {
  /** Expression tree compiled from this row's conditions (and-combination). */
  expr: ExprNode
  /** The decision for this row. */
  decision: string
  /** Priority. */
  priority: number
}

export class DecisionTableError extends Error {
  constructor(message: string) {
    super(`[DecisionTable] ${message}`)
    this.name = 'DecisionTableError'
  }
}

/**
 * Compile a decision table -> list of row condition trees.
 * Each row's conditions compile to an and-tree (all non-null conditions use eq); one decision per row.
 */
export function compileDecisionTable(table: DecisionTable): CompiledDecisionRow[] {
  if (!table.columns || table.columns.length === 0) {
    throw new DecisionTableError('decision table must have at least one column')
  }
  if (!table.rows || table.rows.length === 0) {
    throw new DecisionTableError('decision table must have at least one row')
  }

  return table.rows.map((row, idx) => {
    const conds: ExprNode[] = []
    for (const col of table.columns) {
      const value = row.conditions[col]
      if (value === undefined) continue // this column is unconstrained
      conds.push(compileSimpleCondition({ field: col, operator: 'eq', value }))
    }
    if (conds.length === 0) {
      throw new DecisionTableError(`row ${idx + 1} has no condition constraints`)
    }
    const expr: ExprNode = conds.length === 1 ? conds[0] : { type: 'and', args: conds }
    return {
      expr,
      decision: row.decision,
      priority: row.priority ?? idx, // default to row order
    }
  })
}
