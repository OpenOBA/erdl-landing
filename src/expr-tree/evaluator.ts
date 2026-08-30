/**
 * exprTreeEvaluator - expression tree evaluator.
 *
 * Tree-walking evaluation, pure function, no side effects, no wall-clock reads.
 * Semantic constraints:
 * - Pure function
 * - Quantifier safe folding on empty arrays: all(empty)=false (intentional
 *   deviation), any/none(empty)=false
 * - Reading the wall clock is forbidden; time is injected via context.as_of
 *   (passed in from outside; this evaluator never reads Date.now)
 * - undefined sentinel semantics: field missing -> false everywhere except
 *   exists (null propagation)
 * - Evaluation error folding: the caller decides fail-close or fold-false per tier
 * - Strict type matching: no implicit type coercion
 *
 * @license MIT
 */

import type { ExprNode } from './node-types.js'
import { addYears, addMonths, addDays, addHours, getYear, getMonth, getDate, getDay, endOfMonth } from '../date-utils.js'
import { enforceLimits } from './limits.js'
import {
  ok, err, mergeWarnings,
  type EvalResult, type EvalWarning,
} from './eval-warning.js'
import { TraceCollector, type EvalTrace } from './eval-trace.js'
import {
  fromInt, fromNumber, add, sub, mul, div, compare as rationalCompare,
  toDecimalString,
  type Rational,
} from './fixed-point.js'
import { safeRegExp, safeTest, REGEX_MAX_INPUT_LENGTH } from '../safe-regex.js'
import { normalizeNfc } from './normalize.js'

/** Evaluation context: field/variable resolver functions + the engine-injected as_of time. */
export interface EvalContext {
  /** Resolve a field value (dot paths supported); returning undefined means absent. */
  resolveField(field: string): unknown
  /** Resolve a variable (var node; only '$'/'$.path'). */
  resolveVar(path: string): unknown
  /** Engine-injected time basis (as_of, ISO string or Date); wall-clock reads are forbidden. */
  asOf?: Date
}

/** Default context: resolve fields from a plain object. */
export function objectContext(obj: Record<string, unknown>, asOf?: Date): EvalContext {
  return {
    resolveField(field: string): unknown {
      if (Object.prototype.hasOwnProperty.call(obj, field)) return obj[field]
      return field.split('.').reduce<unknown>((cur, key) => {
        if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
        return (cur as Record<string, unknown>)[key]
      }, obj)
    },
    resolveVar(path: string): unknown {
      if (path === '$') return obj
      const p = path.startsWith('$.') ? path.slice(2) : path
      return p.split('.').reduce<unknown>((cur, key) => {
        if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
        return (cur as Record<string, unknown>)[key]
      }, obj)
    },
    asOf,
  }
}

export class ExprTreeEvaluator {
  /**
   * Evaluate an expression tree.
   * Returns an EvalResult (value + warnings + errored); does not throw (except for structural errors).
   */
  evaluate(node: ExprNode, context: EvalContext): EvalResult {
    enforceLimits(node)
    return this.evalNode(node, context)
  }

  /** Evaluate and collect an eval_trace (the tree is the evidence). */
  evaluateWithTrace(node: ExprNode, context: EvalContext): { result: EvalResult; trace: EvalTrace } {
    enforceLimits(node)
    this.traceCollector = new TraceCollector()
    // Context snapshot hash: uses the asOf timestamp (when injected); the full context is represented by the inputValues of each field node
    this.traceCollector.setContextHash(context.asOf ? String(context.asOf.getTime()) : '')
    try {
      const result = this.evalNode(node, context, 'root')
      const trace = this.traceCollector.toTrace(node, result.value)
      return { result, trace }
    } finally {
      this.traceCollector = null
    }
  }

  /** Trace collector (non-null only during evaluateWithTrace). */
  private traceCollector: TraceCollector | null = null

  private evalNode(node: ExprNode, context: EvalContext, path = 'root'): EvalResult {
    return this.evalNodeInner(node, context, path)
  }

  private evalNodeInner(node: ExprNode, context: EvalContext, path: string): EvalResult {
    switch (node.type) {
      case 'literal': {
        // NFC normalization for string literals
        const value = typeof node.value === 'string' ? normalizeNfc(node.value) : node.value
        const result = ok(value)
        this.traceCollector?.record(node.type, path, node, [node.value], result.value, result.value)
        return result
      }
      case 'field': {
        const resolved = context.resolveField(node.field)
        const result = ok(resolved)
        this.traceCollector?.record(node.type, path, node, [resolved], result.value, result.value)
        return result
      }
      case 'var': {
        const resolved = context.resolveVar(node.path)
        const result = ok(resolved)
        this.traceCollector?.record(node.type, path, node, [resolved], result.value, result.value)
        return result
      }

      case 'and': {
        const results = node.args.map((a, i) => this.evalNode(a, context, `${path}/arg${i}`))
        const warnings = mergeWarnings(...results)
        if (results.some((r) => r.errored)) {
          return err('and: child node evaluation error', warnings)
        }
        const out = results.every((r) => this.toBoolean(r.value))
        this.traceCollector?.record(node.type, path, node, results.map((r) => r.value), out, out, warnings.map((w) => w.message))
        return ok(out, warnings)
      }
      case 'or': {
        const results = node.args.map((a, i) => this.evalNode(a, context, `${path}/arg${i}`))
        const warnings = mergeWarnings(...results)
        if (results.some((r) => r.errored)) {
          return err('or: child node evaluation error', warnings)
        }
        const out = results.some((r) => this.toBoolean(r.value))
        this.traceCollector?.record(node.type, path, node, results.map((r) => r.value), out, out, warnings.map((w) => w.message))
        return ok(out, warnings)
      }
      case 'not': {
        const r = this.evalNode(node.arg, context, `${path}/arg`)
        if (r.errored) return r
        const out = !this.toBoolean(r.value)
        this.traceCollector?.record(node.type, path, node, [r.value], out, out, r.warnings.map((w) => w.message))
        return ok(out, r.warnings)
      }

      case 'compare': {
        const l = this.evalNode(node.left, context, `${path}/left`)
        const r = this.evalNode(node.right, context, `${path}/right`)
        const warnings = mergeWarnings(l, r)
        if (l.errored || r.errored) return err('compare: operand evaluation error', warnings)
        const out = this.compare(node.op, l.value, r.value, warnings)
        this.traceCollector?.record(node.type, path, node, [l.value, r.value], out, out, warnings.map((w) => w.message))
        return ok(out, warnings)
      }

      case 'in': {
        const l = this.evalNode(node.left, context, `${path}/left`)
        const r = this.evalNode(node.right, context, `${path}/right`)
        const warnings = mergeWarnings(l, r)
        if (l.errored || r.errored) return err('in: operand evaluation error', warnings)
        if (!Array.isArray(r.value)) {
          warnings.push({ kind: 'type_mismatch', message: 'right side of in must be an array', nodeType: 'in' })
          return ok(false, warnings)
        }
        // List limit: in/not_in operands are capped at 256 items
        if (r.value.length > 256) {
          warnings.push({ kind: 'array_over_limit', message: 'in list exceeds the 256-item limit', nodeType: 'in' })
          return ok(false, warnings)
        }
        const out = (r.value as unknown[]).includes(l.value)
        this.traceCollector?.record(node.type, path, node, [l.value, r.value], out, out, warnings.map((w) => w.message))
        return ok(out, warnings)
      }

      case 'string': {
        const l = this.evalNode(node.left, context, `${path}/left`)
        const r = this.evalNode(node.right, context, `${path}/right`)
        const warnings = mergeWarnings(l, r)
        if (l.errored || r.errored) return err('string: operand evaluation error', warnings)
        const out = this.stringMatch(node.op, l.value, r.value, warnings)
        this.traceCollector?.record(node.type, path, node, [l.value, r.value], out, out, warnings.map((w) => w.message))
        return ok(out, warnings)
      }

      case 'exists': {
        const r = this.evalNode(node.arg, context, `${path}/arg`)
        if (r.errored) return r
        const out = r.value !== undefined && r.value !== null
        this.traceCollector?.record(node.type, path, node, [r.value], out, out, r.warnings.map((w) => w.message))
        return ok(out, r.warnings)
      }
      case 'length': {
        const r = this.evalNode(node.arg, context, `${path}/arg`)
        if (r.errored) return r
        const v = r.value
        let out: number
        if (typeof v === 'string') {
          // length = number of Unicode code points (not UTF-16 code units).
          // JS str.length returns 2 for surrogate pairs (emoji, etc.), which would break byte-level consistency across implementations.
          out = Array.from(v).length
        } else if (Array.isArray(v)) {
          out = v.length
        } else {
          r.warnings.push({ kind: 'type_mismatch', message: 'length only supports strings/arrays', nodeType: 'length' })
          out = 0
        }
        this.traceCollector?.record(node.type, path, node, [v], out, out, r.warnings.map((w) => w.message))
        return ok(out, r.warnings)
      }
      case 'between': {
        const v = this.evalNode(node.value, context, `${path}/value`)
        const mn = this.evalNode(node.min, context, `${path}/min`)
        const mx = this.evalNode(node.max, context, `${path}/max`)
        const warnings = mergeWarnings(v, mn, mx)
        if (v.errored || mn.errored || mx.errored) return err('between: operand evaluation error', warnings)
        const out = this.between(v.value, mn.value, mx.value)
        this.traceCollector?.record(node.type, path, node, [v.value, mn.value, mx.value], out, out, warnings.map((w) => w.message))
        return ok(out, warnings)
      }

      case 'quantifier': {
        const over = this.evalNode(node.over, context, `${path}/over`)
        if (over.errored) return over
        if (!Array.isArray(over.value)) {
          const w: EvalWarning = { kind: 'type_mismatch', message: 'quantifier over must be an array', nodeType: 'quantifier' }
          return ok(false, [...over.warnings, w])
        }
        const arr = over.value as unknown[]
        if (arr.length === 0) {
          const w: EvalWarning = { kind: 'quantifier_empty', message: `quantifier ${node.kind} folds an empty array to false`, nodeType: 'quantifier' }
          return ok(false, [...over.warnings, w])
        }
        const results = arr.map((item, i) => {
          const boundCtx: EvalContext = {
            ...context,
            resolveVar: (p) => (p === node.binding ? item : context.resolveVar(p)),
            resolveField: (f) => (f === node.binding ? item : context.resolveField(f)),
          }
          return this.evalNode(node.predicate, boundCtx, `${path}/pred${i}`)
        })
        const warnings = mergeWarnings(over, ...results)
        const bools = results.map((r) => this.toBoolean(r.value))
        let out: boolean
        switch (node.kind) {
          case 'all': out = bools.every((b) => b); break
          case 'any': out = bools.some((b) => b); break
          case 'none': out = !bools.some((b) => b); break
        }
        this.traceCollector?.record(node.type, path, node, [over.value, ...results.map((r) => r.value)], out, out, warnings.map((w) => w.message))
        return ok(out, warnings)
      }

      case 'arith': {
        const results = node.args.map((a, i) => this.evalNode(a, context, `${path}/arg${i}`))
        const warnings = mergeWarnings(...results)
        if (results.some((r) => r.errored)) return err('arith: operand evaluation error', warnings)
        const result = this.arith(node.op, results.map((r) => r.value), warnings)
        this.traceCollector?.record(node.type, path, node, results.map((r) => r.value), result.value, result.value, warnings.map((w) => w.message))
        return result
      }

      case 'days_between': {
        const from = this.evalNode(node.from, context, `${path}/from`)
        const to = this.evalNode(node.to, context, `${path}/to`)
        const warnings = mergeWarnings(from, to)
        if (from.errored || to.errored) return err('days_between: operand evaluation error', warnings)
        const result = this.daysBetween(from.value, to.value, warnings)
        this.traceCollector?.record(node.type, path, node, [from.value, to.value], result.value, result.value, warnings.map((w) => w.message))
        return result
      }
      case 'epoch_ms': {
        const r = this.evalNode(node.arg, context, `${path}/arg`)
        if (r.errored) return r
        const result = this.epochMs(r.value, r.warnings)
        this.traceCollector?.record(node.type, path, node, [r.value], result.value, result.value, r.warnings.map((w) => w.message))
        return result
      }
      case 'date_add': {
        const base = this.evalNode(node.base, context, `${path}/base`)
        const amount = this.evalNode(node.amount, context, `${path}/amount`)
        const warnings = mergeWarnings(base, amount)
        if (base.errored || amount.errored) return err('date_add: operand evaluation error', warnings)
        const result = this.dateAdd(node.unit, base.value, amount.value, warnings)
        this.traceCollector?.record(node.type, path, node, [base.value, amount.value], result.value, result.value, warnings.map((w) => w.message))
        return result
      }
      case 'date_part': {
        const r = this.evalNode(node.arg, context, `${path}/arg`)
        if (r.errored) return r
        const result = this.datePart(node.unit, r.value, r.warnings)
        this.traceCollector?.record(node.type, path, node, [r.value], result.value, result.value, r.warnings.map((w) => w.message))
        return result
      }
      case 'month_last_day': {
        const r = this.evalNode(node.arg, context, `${path}/arg`)
        if (r.errored) return r
        const result = this.monthLastDay(r.value, r.warnings)
        this.traceCollector?.record(node.type, path, node, [r.value], result.value, result.value, r.warnings.map((w) => w.message))
        return result
      }

      case 'aggregate': {
        const over = this.evalNode(node.over, context, `${path}/over`)
        if (over.errored) return over
        if (!Array.isArray(over.value)) {
          const w: EvalWarning = { kind: 'type_mismatch', message: 'aggregate over must be an array', nodeType: 'aggregate' }
          return ok(null, [...over.warnings, w])
        }
        const result = this.aggregate(node.fn, over.value as unknown[], over.warnings)
        this.traceCollector?.record(node.type, path, node, [over.value], result.value, result.value, over.warnings.map((w) => w.message))
        return result
      }
    }
  }

  // -- Boolean conversion (strict typing: only boolean true is truthy; null propagation: undefined/null -> false) --
  private toBoolean(v: unknown): boolean {
    return v === true
  }

  // -- Comparison (strict type matching) --
  private compare(op: string, left: unknown, right: unknown, warnings: EvalWarning[]): boolean {
    switch (op) {
      case 'eq':
      case 'ne': {
        // Null propagation: when the field is missing (undefined) or null (exists(null)=false, treated as absent),
        // eq/ne always return false, with the single exception of the == null / != null check (right is null/undefined -
        // the only operators that sense field presence).
        // Otherwise missing != 'admin' would be misjudged as true via !(undefined === 'admin'), breaking fail-closed (a safety hole).
        // null and undefined follow null propagation uniformly, aligned with the isAbsent blocking on the Simple path.
        if (left === undefined || left === null) {
          const isNullCheck = right === undefined || right === null
          if (isNullCheck) return op === 'eq' // eq null -> true; ne null -> false
          return false // missing/null field vs a non-null value: both eq and ne are false (fail-closed)
        }
        // Numeric values (number/Rational) use rational comparison; objects use deep comparison; everything else uses strict ===
        const lr = this.toRational(left)
        const rr = this.toRational(right)
        if (lr !== null && rr !== null) {
          const eq = rationalCompare(lr, rr) === 0
          return op === 'eq' ? eq : !eq
        }
        // Object deep comparison (equality via JSON.stringify)
        // Determinism risk note: JSON.stringify depends on object field insertion order; implementations must keep field order consistent
        if (typeof left === 'object' && left !== null && typeof right === 'object' && right !== null) {
          const eq = JSON.stringify(left) === JSON.stringify(right)
          return op === 'eq' ? eq : !eq
        }
        // NFC normalization before string comparison (precomposed e equals decomposed e+')
        const ls = typeof left === 'string' ? normalizeNfc(left) : left
        const rs = typeof right === 'string' ? normalizeNfc(right) : right
        const eq = ls === rs
        return op === 'eq' ? eq : !eq
      }
      case 'gt': return this.numCompare(left, right, 'gt', warnings)
      case 'gte': return this.numCompare(left, right, 'gte', warnings)
      case 'lt': return this.numCompare(left, right, 'lt', warnings)
      case 'lte': return this.numCompare(left, right, 'lte', warnings)
      default: return false
    }
  }

  private numCompare(left: unknown, right: unknown, op: string, warnings: EvalWarning[]): boolean {
    // string vs string compares lexicographically; number/Rational compares as rationals; mixed types return false
    if (typeof left === 'string' && typeof right === 'string') {
      switch (op) {
        case 'gt': return left > right
        case 'gte': return left >= right
        case 'lt': return left < right
        case 'lte': return left <= right
      }
      return false
    }
    const lr = this.toRational(left)
    const rr = this.toRational(right)
    if (lr === null || rr === null) {
      warnings.push({ kind: 'type_mismatch', message: `comparison between ${typeof left} and ${typeof right} is not supported`, nodeType: 'compare' })
      return false
    }
    const cmp = rationalCompare(lr, rr)
    switch (op) {
      case 'gt': return cmp > 0
      case 'gte': return cmp >= 0
      case 'lt': return cmp < 0
      case 'lte': return cmp <= 0
    }
    return false
  }

  /** Convert a numeric value (number / Rational) to a rational; everything else (including string / bare bigint) returns null. */
  private toRational(v: unknown): Rational | null {
    if (typeof v === 'number') {
      // fromNumber expands exponential notation (String(1e-7)="1e-7" -> "0.0000001");
      // any conversion failure (non-finite values, etc.) returns null -> type_mismatch warning + fail-close, never thrown outward
      try {
        return fromNumber(v)
      } catch {
        return null
      }
    }
    if (this.isRational(v)) return v as Rational
    // Strict type matching: string / bare bigint are not implicitly coerced to numbers -> null
    return null
  }

  /** Check whether the value is a Rational object (structural marker). */
  private isRational(v: unknown): boolean {
    return typeof v === 'object' && v !== null &&
      typeof (v as Rational).num === 'bigint' &&
      typeof (v as Rational).den === 'bigint'
  }

  // -- String matching (object deep search + match regex semantics; strings are NFC-normalized) --
  private stringMatch(op: string, left: unknown, right: unknown, warnings: EvalWarning[]): boolean {
    if (typeof right !== 'string') {
      warnings.push({ kind: 'type_mismatch', message: 'right operand of string operations must be a string', nodeType: 'string' })
      return false
    }
    const rn = normalizeNfc(right)
    switch (op) {
      case 'contains': {
        // Object values: recursively search all contained strings
        if (typeof left === 'object' && left !== null) {
          return this.deepContains(left as Record<string, unknown>, rn)
        }
        // Strict type matching: non-string, non-object values (number/boolean, etc.) are not implicitly String()-coerced
        if (typeof left !== 'string') {
          warnings.push({ kind: 'type_mismatch', message: 'left operand of contains must be a string', nodeType: 'string' })
          return false
        }
        return normalizeNfc(left).includes(rn)
      }
      case 'starts_with':
        return typeof left === 'string' && normalizeNfc(left).startsWith(rn)
      case 'ends_with':
        return typeof left === 'string' && normalizeNfc(left).endsWith(rn)
      case 'match': {
        try {
          // Regex is case-sensitive by default (mainstream: JS/Python/Rust/OPA regex are all sensitive by default);
          // rules must write (?i) explicitly for case-insensitivity. Hardening: safeTest enforces an input length cap (bounded cost)
          const re = safeRegExp(rn)
          if (typeof left === 'object' && left !== null) {
            return this.deepMatch(left as Record<string, unknown>, re)
          }
          if (typeof left !== 'string') return false
          const ln = normalizeNfc(left)
          if (ln.length > REGEX_MAX_INPUT_LENGTH) {
            warnings.push({ kind: 'regex_re_dos', message: `regex match input too long (${ln.length} > ${REGEX_MAX_INPUT_LENGTH}), input truncated for matching`, nodeType: 'string' })
          }
          return safeTest(re, ln)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          warnings.push({ kind: 'regex_re_dos', message: msg, nodeType: 'string' })
          return false
        }
      }
      default: return false
    }
  }

  /** Recursively search all string values in an object (deepContains). */
  private deepContains(obj: Record<string, unknown>, search: string, depth = 0): boolean {
    if (depth > 10) return false
    for (const v of Object.values(obj)) {
      if (typeof v === 'string') {
        if (normalizeNfc(v).includes(search)) return true
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        if (this.deepContains(v as Record<string, unknown>, search, depth + 1)) return true
      }
    }
    return false
  }

  /** Recursively search all string values in an object with a regex match (deepMatch). */
  private deepMatch(obj: Record<string, unknown>, re: RegExp, depth = 0): boolean {
    if (depth > 10) return false
    // Pass the same re consistently through the recursion (case sensitivity decided by the caller), avoiding top-level/deep-level semantic drift
    for (const v of Object.values(obj)) {
      if (typeof v === 'string') {
        if (safeTest(re, normalizeNfc(v))) return true
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        if (this.deepMatch(v as Record<string, unknown>, re, depth + 1)) return true
      }
    }
    return false
  }

  // -- between (closed interval [min,max]; supports numbers/Rational) --
  private between(value: unknown, min: unknown, max: unknown): boolean {
    const v = this.toRational(value)
    const mn = this.toRational(min)
    const mx = this.toRational(max)
    if (v === null || mn === null || mx === null) return false
    return rationalCompare(v, mn) >= 0 && rationalCompare(v, mx) <= 0
  }

  // -- Arithmetic (strict fixed-point decimals: intermediate rationals, no spontaneous rounding) --
  private arith(op: string, values: unknown[], warnings: EvalWarning[]): EvalResult {
    // Convert each operand to a rational; non-numeric -> type mismatch
    const rats: Rational[] = []
    for (const v of values) {
      const r = this.toRational(v)
      if (r === null) {
        warnings.push({ kind: 'type_mismatch', message: `arithmetic operand is not a number: ${typeof v}`, nodeType: 'arith' })
        return ok(null, warnings)
      }
      rats.push(r)
    }

    switch (op) {
      case 'add': {
        if (rats.length === 0) return ok(fromInt(0), warnings)
        let acc = rats[0]
        for (let i = 1; i < rats.length; i++) acc = add(acc, rats[i])
        return ok(acc, warnings)
      }
      case 'mul': {
        if (rats.length === 0) return ok(fromInt(1), warnings)
        let acc = rats[0]
        for (let i = 1; i < rats.length; i++) acc = mul(acc, rats[i])
        return ok(acc, warnings)
      }
      case 'sub': {
        // Subtraction is not associative -> must be binary
        if (rats.length !== 2) {
          warnings.push({ kind: 'type_mismatch', message: `sub requires two operands, got ${rats.length}`, nodeType: 'arith' })
          return ok(null, warnings)
        }
        return ok(sub(rats[0], rats[1]), warnings)
      }
      case 'div': {
        // Division is not associative -> must be binary
        if (rats.length !== 2) {
          warnings.push({ kind: 'type_mismatch', message: `div requires two operands, got ${rats.length}`, nodeType: 'arith' })
          return ok(null, warnings)
        }
        if (rats[1].num === 0n) {
          warnings.push({ kind: 'division_by_zero', message: 'division by zero', nodeType: 'arith' })
          return ok(null, warnings)
        }
        return ok(div(rats[0], rats[1]), warnings)
      }
      case 'round': {
        if (rats.length !== 1) {
          warnings.push({ kind: 'type_mismatch', message: `round requires one operand, got ${rats.length}`, nodeType: 'arith' })
          return ok(null, warnings)
        }
        // round -> half-even rounding to an integer (reuses the correct rounding semantics of toDecimalString(scale=0))
        const s = toDecimalString(rats[0], 0)
        return ok(fromInt(s), warnings)
      }
      default:
        return err(`unknown arithmetic operation ${op}`, warnings)
    }
  }

  // -- Temporal (wall-clock reads forbidden; as_of injected via context) --
  private daysBetween(from: unknown, to: unknown, warnings: EvalWarning[]): EvalResult {
    const d1 = from instanceof Date ? from.getTime() : new Date(String(from)).getTime()
    const d2 = to instanceof Date ? to.getTime() : new Date(String(to)).getTime()
    if (Number.isNaN(d1) || Number.isNaN(d2)) {
      warnings.push({ kind: 'invalid_date', message: 'date parse failed', nodeType: 'days_between' })
      return ok(null, warnings)
    }
    return ok(Math.floor((d2 - d1) / 86400000), warnings)
  }

  private epochMs(value: unknown, warnings: EvalWarning[]): EvalResult {
    const t = value instanceof Date ? value.getTime() : new Date(String(value)).getTime()
    if (Number.isNaN(t)) {
      warnings.push({ kind: 'invalid_date', message: 'date parse failed', nodeType: 'epoch_ms' })
      return ok(null, warnings)
    }
    return ok(t, warnings)
  }

  /** Parse any value as a Date; returns null when invalid. */
  private toDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
    const d = new Date(String(value ?? ''))
    return Number.isNaN(d.getTime()) ? null : d
  }

  /** Temporal addition/subtraction: date_add{unit}; a negative amount moves backward in time. Year/month arithmetic is carried by UTC calendar operations (end-of-month clamping, UTC semantics). */
  private dateAdd(unit: string, base: unknown, amount: unknown, warnings: EvalWarning[]): EvalResult {
    const d = this.toDate(base)
    if (d === null) {
      warnings.push({ kind: 'invalid_date', message: `date_add base date is invalid: ${String(base)}`, nodeType: 'date_add' })
      return ok(null, warnings)
    }
    const n = this.toRational(amount)
    if (n === null) {
      warnings.push({ kind: 'type_mismatch', message: `date_add step must be a number: ${typeof amount}`, nodeType: 'date_add' })
      return ok(null, warnings)
    }
    const int = Number(toDecimalString(n, 0))
    switch (unit) {
      case 'years': return ok(addYears(d, int), warnings)
      case 'months': return ok(addMonths(d, int), warnings)
      case 'days': return ok(addDays(d, int), warnings)
      case 'hours': return ok(addHours(d, int), warnings)
      default:
        warnings.push({ kind: 'type_mismatch', message: `unknown date_add unit: ${unit}`, nodeType: 'date_add' })
        return ok(null, warnings)
    }
  }

  /** Extract a temporal component: date_part{unit}. day_of_week: UTC getDay returns 0=Sunday, normalized to 1=Monday...7=Sunday. */
  private datePart(unit: string, value: unknown, warnings: EvalWarning[]): EvalResult {
    const d = this.toDate(value)
    if (d === null) {
      warnings.push({ kind: 'invalid_date', message: `date_part date is invalid: ${String(value)}`, nodeType: 'date_part' })
      return ok(null, warnings)
    }
    switch (unit) {
      case 'year': return ok(getYear(d), warnings)
      case 'month': return ok(getMonth(d) + 1, warnings) // human convention: 1 = January
      case 'day': return ok(getDate(d), warnings)
      case 'hour': return ok(d.getUTCHours(), warnings)
      case 'minute': return ok(d.getUTCMinutes(), warnings)
      case 'second': return ok(d.getUTCSeconds(), warnings)
      case 'day_of_week': {
        const d0 = getDay(d) // 0 = Sunday
        return ok(d0 === 0 ? 7 : d0, warnings) // 1 = Monday ... 7 = Sunday
      }
      default:
        warnings.push({ kind: 'type_mismatch', message: `unknown date_part component: ${unit}`, nodeType: 'date_part' })
        return ok(null, warnings)
    }
  }

  /** Last day of the month containing the given date (the end-of-month clamping primitive). */
  private monthLastDay(value: unknown, warnings: EvalWarning[]): EvalResult {
    const d = this.toDate(value)
    if (d === null) {
      warnings.push({ kind: 'invalid_date', message: `month_last_day date is invalid: ${String(value)}`, nodeType: 'month_last_day' })
      return ok(null, warnings)
    }
    return ok(endOfMonth(d), warnings)
  }


  // -- Aggregation (strict fixed-point decimals: sum/avg/min/max use rationals, consistent with arith; count stays an integer) --
  private aggregate(fn: string, arr: unknown[], warnings: EvalWarning[]): EvalResult {
    switch (fn) {
      case 'count': return ok(arr.length, warnings)
      case 'sum': {
        const rats = this.toRationalArray(arr, 'sum', warnings)
        if (rats === null) return ok(null, warnings)
        let acc = fromInt(0)
        for (const r of rats) acc = add(acc, r)
        return ok(acc, warnings)
      }
      case 'avg': {
        if (arr.length === 0) {
          warnings.push({ kind: 'aggregate_empty', message: 'avg on an empty array safely folds to false', nodeType: 'aggregate' })
          return ok(false, warnings)
        }
        const rats = this.toRationalArray(arr, 'avg', warnings)
        if (rats === null) return ok(null, warnings)
        let acc = fromInt(0)
        for (const r of rats) acc = add(acc, r)
        return ok(div(acc, fromInt(rats.length)), warnings)
      }
      case 'min': {
        const rats = this.toRationalArray(arr, 'min', warnings)
        if (rats === null) return ok(null, warnings)
        if (rats.length === 0) {
          warnings.push({ kind: 'aggregate_empty', message: 'min on an empty array safely folds to false', nodeType: 'aggregate' })
          return ok(false, warnings)
        }
        let m = rats[0]
        for (let i = 1; i < rats.length; i++) if (rationalCompare(rats[i], m) < 0) m = rats[i]
        return ok(m, warnings)
      }
      case 'max': {
        const rats = this.toRationalArray(arr, 'max', warnings)
        if (rats === null) return ok(null, warnings)
        if (rats.length === 0) {
          warnings.push({ kind: 'aggregate_empty', message: 'max on an empty array safely folds to false', nodeType: 'aggregate' })
          return ok(false, warnings)
        }
        let m = rats[0]
        for (let i = 1; i < rats.length; i++) if (rationalCompare(rats[i], m) > 0) m = rats[i]
        return ok(m, warnings)
      }
      default: return err(`unknown aggregate function ${fn}`, warnings)
    }
  }

  /** Convert all array elements to rationals; a non-numeric element (including string, strict typing) returns null and records a warning. */
  private toRationalArray(arr: unknown[], fn: string, warnings: EvalWarning[]): Rational[] | null {
    const rats: Rational[] = []
    for (const v of arr) {
      const r = this.toRational(v)
      if (r === null) {
        warnings.push({ kind: 'type_mismatch', message: `${fn} array contains a non-numeric element: ${typeof v}`, nodeType: 'aggregate' })
        return null
      }
      rats.push(r)
    }
    return rats
  }
}

/** Singleton. */
export const exprTreeEvaluator = new ExprTreeEvaluator()
