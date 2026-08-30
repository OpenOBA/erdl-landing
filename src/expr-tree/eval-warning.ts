/**
 * eval-warning - evaluation warnings.
 *
 * Non-fatal problems during evaluation are recorded in eval_warnings.
 * Folding direction is tiered:
 * - tier <= 2 / Guard default: fail-close (safe failure)
 * - tier 3-5: fold to false
 *
 * @license MIT
 */

export type EvalWarningKind =
  | 'type_mismatch'          // strict type match failed
  | 'division_by_zero'       // division by zero
  | 'field_absent'           // field missing (null propagation)
  | 'quantifier_empty'       // safe folding of a quantifier over an empty array
  | 'aggregate_empty'        // safe folding of an aggregate over an empty array
  | 'regex_re_dos'           // regex ReDoS risk
  | 'array_over_limit'       // array exceeds limit
  | 'invalid_date'           // date parsing failed
  | 'not_ruleable'           // cannot be evaluated deterministically

export interface EvalWarning {
  kind: EvalWarningKind
  message: string
  /** Node type that triggered the warning */
  nodeType?: string
}

export interface EvalResult {
  /** Evaluation result value (number/string/boolean/array/null) */
  value: unknown
  /** Warnings collected during evaluation */
  warnings: EvalWarning[]
  /** Whether an unrecoverable error occurred (structural error, handled by the outer fallback) */
  errored: boolean
  error?: string
}

export function ok(value: unknown, warnings: EvalWarning[] = []): EvalResult {
  return { value, warnings, errored: false }
}

export function err(message: string, warnings: EvalWarning[] = []): EvalResult {
  return { value: null, warnings, errored: true, error: message }
}

/** Merge warnings from multiple sub-evaluation results. */
export function mergeWarnings(...results: EvalResult[]): EvalWarning[] {
  const out: EvalWarning[] = []
  for (const r of results) {
    out.push(...r.warnings)
  }
  return out
}
