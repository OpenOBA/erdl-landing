/**
 * ERDL - Rule Evaluator (ERDL Spec v2.1 Sec. 7 compliant)
 *
 * Execution Rings + override semantics + dual-mode condition evaluation.
 *
 * Algorithm (Sec. 7 evaluation semantics):
 *   1. Rules sorted by priority ascending (lower == higher priority)
 *   2. Evaluate in Ring order: Ring 0 first, then Ring 1, 2, 3
 *   3. Within each Ring, first-match-wins (short-circuit)
 *   4. override=true can override a DENY from a HIGHER-priority Ring
 *      (only DENY->ALLOW direction; never to a less-safe state)
 *   5. at equal priority, override rules sort ahead of non-override rules (Sec. 7.1)
 *
 * @license MIT
 */

import type { RuleDefinition, RuleCondition, EvaluationResult, RuleMatch, Decision, RingLevel, OverrideLevel, TemporalStateEntry } from './rule-definition.js'
import { GuardStateManager } from './guard-state-manager.js'
import { SystemClock, type Clock } from './clock.js'
import { ExprTreeEvaluator } from './expr-tree/evaluator.js'
import { normalizeOperator } from './expr-tree/rule-to-expr.js'
import { compileSimpleCondition } from './expr-tree/simple-compiler.js'
import { fromSExpr } from './expr-tree/s-expression.js'
import { ExprLimitError } from './expr-tree/limits.js'

// Sec. 7.1: override level ranking - critical > high > normal > low
// normal/low do NOT enable override behavior
const OVERRIDE_RANK: Record<OverrideLevel, number> = { critical: 0, high: 1, normal: 2, low: 3 }
/** Returns rank for sorting; undefined/non-enabling levels sort last */
function overrideSortRank(rule: RuleDefinition): number {
  if (!rule.override) return 4
  return OVERRIDE_RANK[rule.override] ?? 4
}
/** Sec. 7.1: only critical/high enable override behavior */
function overrideEnables(rule: RuleDefinition): boolean {
  return rule.override === 'critical' || rule.override === 'high'
}

export class Evaluator {
  // within/rate stateful operators - state externalized to GuardStateManager.
  // The expression tree / evaluation stays a pure function; sliding-window counts are maintained by the stateManager outside the tree.
  private readonly stateManager: GuardStateManager

  // Normalization: the condition-evaluation layer uses the expression-tree kernel (a single evaluation core)
  private readonly treeEvaluator = new ExprTreeEvaluator()

  // evaluation counter for periodic tracker cleanup
  private evalCount = 0

  /** Time source injection (defaults to SystemClock). Tests can freeze as_of with VirtualClock for reproducibility. */
  private readonly clock: Clock

  /** Time basis (asOf) for the current evaluation. Injected once at the evaluate() entry; the expression-tree kernel never reads the wall clock itself.
   *  Constant for the duration of a synchronous evaluation, so all rules within one decision share the same asOf. */
  private asOf: Date | null = null

  constructor(stateManager?: GuardStateManager, clock?: Clock) {
    this.stateManager = stateManager ?? new GuardStateManager()
    this.clock = clock ?? new SystemClock()
  }

  evaluate(
    rules: RuleDefinition[],
    context: Record<string, unknown>,
  ): EvaluationResult {
    // Inject the time basis (asOf) for this evaluation. The engine reads time once here via the injected Clock; the expression-tree kernel stays pure.
    this.asOf = new Date(this.clock.now())

    // E-10 fix: periodically clean up expired tracker entries to prevent memory leak
    this.evalCount++
    if (this.evalCount % 100 === 0) {
      this.stateManager.cleanup(60 * 60 * 1000)
    }

    // deep clone context to prevent mutation of the caller's object
    // evaluate() may set context['workflow.active'] (lines 104, 477) - without cloning,
    // repeated evaluations with the same context object would be polluted by prior workflow state
    // structuredClone instead of a JSON round trip - preserves Date/BigInt, safe with circular references, keeps undefined
    context = structuredClone(context)

    // if workflow is active, evaluate the current step
    if (context['workflow.active']) {
      return this.evaluateWorkflowStep(context)
    }

    const enabled = rules.filter((r) => r.enabled)
    if (enabled.length === 0) {
      // Sec. 2.2 metadata: metadata.decision fallback takes precedence over default ALLOW
      const metadataDecision = context['metadata.decision'] as string | undefined
      if (metadataDecision) {
        return { decision: metadataDecision as Decision, matchedRules: [], totalEvaluated: 0, totalMatched: 0, primaryReason: `No enabled rules; metadata.decision fallback: ${metadataDecision}` }
      }
      // no enabled rules -> ALLOW
      return { decision: 'ALLOW', matchedRules: [], totalEvaluated: 0, totalMatched: 0 }
    }

    // Group by Ring, sort within each Ring by priority (at equal priority, override rules sort first)
    const byRing = new Map<number, RuleDefinition[]>()
    for (const rule of enabled) {
      const ring = rule.action.ring ?? 3
      let ringRules = byRing.get(ring)
      if (!ringRules) {
        ringRules = []
        byRing.set(ring, ringRules)
      }
      ringRules.push(rule)
    }

    // Sort Ring keys ascending (Ring 0 evaluates first)
    const ringKeys = [...byRing.keys()].sort((a, b) => a - b)

    const allMatched: RuleMatch[] = []
    // Window-count snapshots of stateful operators (within/rate), recorded into the DO temporal_state
    const temporalState: TemporalStateEntry[] = []
    // Sec. 7.4: unless exemptions recorded separately - NOT in matchedRules
    const unlessExemptions: RuleMatch[] = []
    let finalDecision: Decision | undefined = undefined
    let lastDecisionRing: number | undefined // track which ring set the current decision
    let finalInstruction: string | undefined
    let finalReason: string | undefined
    let finalCorrection: string | undefined
    let finalExplanation: RuleDefinition['action']['explanation'] | undefined
    let finalAlternative: RuleDefinition['action']['alternative'] | undefined

    for (const ring of ringKeys) {
      const ringRules = byRing.get(ring)
      if (!ringRules) continue

      // Sec. 7.1: sort by priority ascending first, then override level within the same priority.
      // empty-condition rules (catch-all defaults) sort last within the ring
      // so explicit-condition rules always evaluate first.
      const sortedRingRules = [...ringRules].sort((a, b) => {
        const aEmpty = (!a.conditions || a.conditions.length === 0) ? 1 : 0
        const bEmpty = (!b.conditions || b.conditions.length === 0) ? 1 : 0
        if (aEmpty !== bEmpty) return aEmpty - bEmpty
        if (a.priority !== b.priority) return a.priority - b.priority
        const oa = overrideSortRank(a)
        const ob = overrideSortRank(b)
        return oa - ob
      })

      for (const rule of sortedRingRules) {
        // Sec. 7.4: unless exemption - evaluated BEFORE when
        if (rule.unless?.conditions && rule.unless.conditions.length > 0) {
          const unlessLogic = rule.unless.logic ?? 'AND'
          const unlessExempt = unlessLogic === 'OR'
            ? rule.unless.conditions.some((cond) => this.evaluateLeaf(cond, context))
            : rule.unless.conditions.every((cond) => this.evaluateLeaf(cond, context))
          if (unlessExempt) {
            unlessExemptions.push({
              ruleId: rule.name,
              ruleName: `${rule.name}/unless`,
              decision: 'ALLOW',
              reason: `unless condition matched - rule exempt`,
              priority: rule.priority,
              ring: (rule.action.ring ?? 3) as RingLevel,
            })
            if (finalDecision === undefined) {
              finalDecision = 'ALLOW'
              lastDecisionRing = ring
            }
            continue
          }
        }

        const matched = rule.conditions.length === 0 ||
          (rule.conditionLogic === 'OR'
            ? rule.conditions.some((cond) => this.evaluateLeaf(cond, context))
            : rule.conditions.every((cond) => this.evaluateLeaf(cond, context)))
        if (!matched) continue

        const match = this.makeMatch(rule, ring as RingLevel)
        allMatched.push(match)
        // Collect window-count snapshots of stateful operators (within/rate) into the DO temporal_state
        this.collectTemporalState(rule, temporalState)

        // WORKFLOW - if the rule has a workflow, start workflow mode
        if (match.decision === 'WORKFLOW' && rule.workflow) {
          context['workflow.active'] = {
            rule_name: rule.name,
            rule_id: rule.id,
            steps: rule.workflow.steps,
            current_step: 0,
            started_at: new Date(this.clock.now()),
          }
          // Return immediately to start workflow
          return this.evaluateWorkflowStep(context)
        }

        // Sec. 7 + Sec. 7.1: override semantics
        // - override only allows DENY->ALLOW (safe direction); ALLOW->DENY is NOT allowed
        // - override critical/high enables cross-Ring coverage (a Ring 3 ALLOW covers a Ring 0 DENY)
        // - EMERGENCY_HALT short-circuits; DENY does NOT short-circuit
        //
        // Sec. 7.1 gate: once a decision is made, non-override non-terminating rules
        // are treated differently by decision type:
        // - ALLOW + override-enabling + finalDecision=DENY -> allow override (below)
        // - ALLOW + non-override + finalDecision=ALLOW -> allow instruction accumulation
        // - ALLOW + non-override + finalDecision!=ALLOW -> pop (can't change existing decision)
        // - CORRECT/NOTIFY/REQUEST_HUMAN + non-override -> pop
        // - DENY/EMERGENCY_HALT: always let through
        if (finalDecision !== undefined) {
          const isTerminating = match.decision === 'DENY' || match.decision === 'EMERGENCY_HALT'
          const isAllowAccumulation = match.decision === 'ALLOW' && finalDecision === 'ALLOW'
          if (!overrideEnables(rule) && !isTerminating && !isAllowAccumulation) {
            allMatched.pop()
            continue
          }
        }

        if (match.decision === 'ALLOW') {
          // override ALLOW covers prior DENY -> ALLOW (safe direction, cross-Ring)
          if (overrideEnables(rule) && finalDecision === 'DENY') {
            finalDecision = 'ALLOW'
            lastDecisionRing = ring
            finalInstruction = match.instruction
            finalReason = match.reason
            finalCorrection = match.correction
            finalExplanation = match.explanation
            finalAlternative = match.alternative
            break // override takes effect, stop evaluating this ring
          }
          if (finalDecision === undefined) {
            finalDecision = 'ALLOW'
            lastDecisionRing = ring
          }
          // Sec. 7.1: accumulate instructions even when finalDecision is already ALLOW
          if (match.instruction) {
            finalInstruction = finalInstruction
              ? `${finalInstruction}; ${match.instruction}`
              : match.instruction
          }
          continue // keep evaluating for potential DENY/override rules
        }

        if (match.decision === 'EMERGENCY_HALT') {
          finalDecision = 'EMERGENCY_HALT'
          lastDecisionRing = ring
          finalReason = match.reason
          finalInstruction = match.instruction
          finalExplanation = match.explanation
          finalAlternative = match.alternative
          // Sec. 7.1: only EMERGENCY_HALT short-circuits
          if (ring === 0) {
            return {
              decision: finalDecision,
              matchedRules: allMatched,
              unlessExemptions: unlessExemptions.length > 0 ? unlessExemptions : undefined,
              primaryReason: finalReason ?? `${finalDecision} triggered by Ring 0 rule`,
              primaryExplanation: finalExplanation,
              primaryAlternative: finalAlternative,
              totalEvaluated: allMatched.length, // actual evaluated count on short-circuit
              totalMatched: allMatched.length,
              temporalState: temporalState.length > 0 ? temporalState : undefined,
            }
          }
          break // stop this ring
        }

        if (match.decision === 'DENY') {
          // Sec. 7.1: a higher-ring DENY can override a lower-ring ALLOW
          // within the same ring, DENY does NOT override ALLOW
          // (unsafe direction; a same-ring DENY after ALLOW -> popped)
          // an empty-condition catch-all DENY never overrides an explicit-condition ALLOW
          const isCatchAllDeny = (!rule.conditions || rule.conditions.length === 0)
          if (isCatchAllDeny && finalDecision === 'ALLOW') {
            allMatched.pop()
            continue
          }
          if (finalDecision === undefined || finalDecision === 'DENY') {
            finalDecision = 'DENY'
            lastDecisionRing = ring
            finalReason = match.reason
            finalInstruction = match.instruction
            finalCorrection = match.correction
            finalExplanation = match.explanation
            finalAlternative = match.alternative
          } else if (finalDecision === 'ALLOW') {
            // Sec. 7.1:
            // - Cross-ring: a higher-ring DENY overrides a lower-ring ALLOW
            // - Same-ring: a normal DENY overrides ALLOW (higher-priority DENY wins)
            // - Same-ring: an override DENY after ALLOW -> popped (unsafe direction)
            const allowRing = lastDecisionRing ?? ring
            if (ring > allowRing || (ring === allowRing && !overrideEnables(rule))) {
              // Higher-ring OR same-ring non-override DENY -> override ALLOW
              finalDecision = 'DENY'
              lastDecisionRing = ring
              finalReason = match.reason
              finalInstruction = match.instruction
              finalCorrection = match.correction
              finalExplanation = match.explanation
              finalAlternative = match.alternative
            } else {
              // a same-ring override DENY cannot override ALLOW
              allMatched.pop()
            }
          } else {
            // DENY cannot override ESCALATE/REQUEST_HUMAN - remove from matched
            allMatched.pop()
          }
          // DENY does NOT short-circuit - continue evaluating for a potential override ALLOW
          continue
        }

        // CORRECT / REQUEST_HUMAN / ESCALATE / NOTIFY / WORKFLOW_PROGRESS: accumulate
        if (finalDecision === undefined) {
          finalDecision = match.decision
        }
        if (match.reason && (match.decision === 'REQUEST_HUMAN' || match.decision === 'ESCALATE')) {
          finalReason = match.reason
          finalExplanation = match.explanation
        }
        if (match.correction && match.decision === 'CORRECT') {
          finalCorrection = match.correction
          finalExplanation = match.explanation
        }
        continue // keep evaluating
      }
    }

    if (allMatched.length === 0) {
      // Sec. 2.2 metadata: priority chain - rules[].then > metadata.decision > default
      // metadata.decision is a file-level field; callers may inject it via context['metadata.decision']
      const metadataDecision = context['metadata.decision'] as string | undefined
      if (metadataDecision) {
        return {
          decision: metadataDecision as Decision,
          matchedRules: [],
          totalEvaluated: enabled.length,
          totalMatched: 0,
          primaryReason: `No rules matched; metadata.decision fallback: ${metadataDecision}`,
        }
      }
      // an unless exemption sets finalDecision=ALLOW even though matched_rules=[]
      // - return finalDecision rather than hardcoding a default
      if (finalDecision === undefined) finalDecision = 'ALLOW'
      return { decision: finalDecision as Decision, matchedRules: [], unlessExemptions: unlessExemptions.length > 0 ? unlessExemptions : undefined, totalEvaluated: enabled.length, totalMatched: 0 }
    }

    return {
      decision: finalDecision as Decision,
      matchedRules: allMatched,
      unlessExemptions: unlessExemptions.length > 0 ? unlessExemptions : undefined,
      primaryReason: finalReason,
      primaryInstruction: finalInstruction,
      primaryCorrection: finalCorrection,
      primaryExplanation: finalExplanation,
      primaryAlternative: finalAlternative,
      totalEvaluated: enabled.length,
      totalMatched: allMatched.length,
      temporalState: temporalState.length > 0 ? temporalState : undefined,
    }
  }

  /** Build a RuleMatch from a matched rule */
  private makeMatch(rule: RuleDefinition, ring: RingLevel): RuleMatch {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      decision: rule.action.decision,
      instruction: rule.action.instruction,
      reason: rule.action.reason,
      explanation: rule.action.explanation,
      alternative: rule.action.alternative,
      ring: rule.action.ring ?? ring,
      correction: rule.action.correction,
      priority: rule.priority,
    }
  }

  simulate(
    rule: RuleDefinition,
    context: Record<string, unknown>,
  ): RuleMatch | null {
    if (!rule.enabled) return null
    const ctx = { ...context }
    const matched = rule.conditions.length === 0 || rule.conditions.every((cond) => this.evaluateLeaf(cond, ctx))
    if (!matched) return null

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      decision: rule.action.decision,
      instruction: rule.action.instruction,
      reason: rule.action.reason,
      priority: rule.priority,
    }
  }

  // ============================================
  // Sec. 7.4: field/operator/value evaluation
  // ============================================

  /**
   * Collect window-count snapshots of the stateful operators (within/rate) of a matched rule.
   * Called after the match (the count already includes the allowances before this match), so replay verification can align sequence-by-sequence accumulation.
   */
  private collectTemporalState(rule: RuleDefinition, out: TemporalStateEntry[]): void {
    for (const cond of rule.conditions) {
      if (cond.rate && cond.field) {
        const windowMs = this.parseWindow(cond.rate.split('/')[1] ?? '1m')
        const maxCount = parseInt(cond.rate.split('/')[0] ?? '10', 10)
        const rateKey = this.rateKey(cond.field, cond.operator ?? '', cond.value, cond.rate)
        out.push({
          rule_id: rule.id,
          operator: 'rate',
          field: cond.field,
          window_ms: windowMs,
          count: this.stateManager.getCount(rateKey, windowMs, true),
          limit: maxCount,
        })
      }
      if (cond.within && cond.field) {
        const windowMs = this.parseWindow(cond.within)
        const trackerKey = this.withinKey(cond.field, cond.operator ?? '', cond.value)
        out.push({
          rule_id: rule.id,
          operator: 'within',
          field: cond.field,
          window_ms: windowMs,
          count: this.stateManager.getCount(trackerKey, windowMs, false),
        })
      }
    }
  }

  /**
   * rate counter key: includes field + operator + value + rate, so different operations (different values) are rate-limited independently
   * (a key without value would let distinct operations share one counter).
   */
  private rateKey(field: string, operator: string, value: unknown, rate: string): string {
    return `rate:${field}:${operator}:${this.serializeValue(value)}:${rate}`
  }

  /**
   * within counter key: includes field + operator + value, so different operations are deduplicated independently.
   */
  private withinKey(field: string, operator: string, value: unknown): string {
    return `within:${field}:${operator}:${this.serializeValue(value)}`
  }

  /** Stable serialization of value (for counter keys; does not enter the DO hash). */
  private serializeValue(value: unknown): string {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    const t = typeof value
    if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') return String(value)
    return JSON.stringify(value)
  }

  /** Build the EvalContext for tree evaluation (reuses the resolveField semantics + injects asOf). */
  private buildTreeContext(context: Record<string, unknown>): { resolveField: (f: string) => unknown; resolveVar: (v: string) => unknown; asOf?: Date } {
    return {
      resolveField: (f: string) => this.resolveField(f, context),
      resolveVar: (v: string) => {
        if (v === '$') return context
        const p = v.startsWith('$.') ? v.slice(2) : v
        return this.resolveField(p, context)
      },
      asOf: this.asOf ?? undefined,
    }
  }

  private evaluateLeaf(cond: RuleCondition, context: Record<string, unknown>): boolean {
    // Expression projection: a structured expression tree (S-expression) takes priority and is evaluated directly by the tree kernel
    if (cond.expr !== undefined && cond.expr !== null) {
      try {
        const tree = fromSExpr(cond.expr)
        const evalCtx = this.buildTreeContext(context)
        return this.treeEvaluator.evaluate(tree, evalCtx).value === true
      } catch (e) {
        // Split by exception type - resource-limit breaches (ExprLimitError) are attack signals and must be observable;
        // structural errors such as parse failures fail close silently
        if (e instanceof ExprLimitError) {
          console.warn(`[Evaluator] expression resource limit exceeded (fail-close): ${e.message}`)
        }
        // S-expression parse failure -> evaluation fails (fail-close)
        return false
      }
    }

    const { field, operator } = cond
    if (!field) return false

    if (!operator) return false

    const raw = this.resolveField(field, context)

    // Null propagation: when the field is absent, all comparisons return false except ==null/!=null/exists.
    // Semantics: "field does not exist" is uniformly treated as "condition not satisfied", not as an evaluation error.
    // Only exists/not_exists and ==null/!=null can sense field presence.
    const isAbsent = raw === undefined || raw === null
    if (isAbsent) {
      if (operator === 'exists') return false
      if (operator === 'not_exists') return true
      if (operator === 'eq' && (cond.value === null || cond.value === undefined)) return true
      if (operator === 'ne' && (cond.value === null || cond.value === undefined)) return false
      // All other comparisons with absent field -> false
      return false
    }

    // Normalization: pure conditions are evaluated with the expression-tree kernel (single evaluation core).
    // Aliases matches->match / neq->ne are handled uniformly by normalizeOperator (rule-to-expr.ts).
    const normalizedOp = normalizeOperator(operator)
    if (normalizedOp !== null && field) {
      // Aligned with the expr branch above: any tree-kernel evaluation exception fails close,
      // and is never thrown outward to the Guard caller (e.g. contexts with extreme values, over-limit attacks)
      try {
        const tree = compileSimpleCondition({ field, operator: normalizedOp, value: cond.value })
        const evalCtx = this.buildTreeContext(context)
        const result = this.treeEvaluator.evaluate(tree, evalCtx)
        const matched = result.value === true

        // rate limiting (post-check: only counted when the field matches; value-isolated so different operations are limited independently).
        // Correct semantics: the first N occurrences are allowed (and counted); from the (N+1)th on, they are blocked.
        if (matched && cond.rate) {
          const rateKey = this.rateKey(field, operator, cond.value, cond.rate)
          const windowMs = this.parseWindow(cond.rate.split('/')[1] ?? '1m')
          const maxCount = parseInt(cond.rate.split('/')[0] ?? '10', 10)
          if (this.stateManager.checkRate(rateKey, maxCount, windowMs)) {
            // Under the limit: record this operation (allow); the condition does not hold
            this.stateManager.recordRate(rateKey, windowMs)
            return false
          }
          // Over the limit: the condition holds (triggers the block)
        }

        // within deduplication (post-check: only counted when the field matches; value-isolated).
        // Correct semantics: first trigger (no history) -> record + allow; subsequent triggers inside the window (has history) -> block.
        if (matched && cond.within) {
          const trackerKey = this.withinKey(field, operator, cond.value)
          const windowMs = this.parseWindow(cond.within)
          if (!this.stateManager.checkWithin(trackerKey, windowMs)) {
            // No history in the window (first trigger): record this; the condition does not hold (allow)
            this.stateManager.recordWithin(trackerKey)
            return false
          }
          // History exists in the window: the condition holds (triggers the block)
        }

        return matched
      } catch {
        return false
      }
    }

    // normalizeOperator covers all 28 pure condition operators; reaching here means the
    // operator is impure (within/rate are handled earlier in the main loop; pattern/keywords are impure).
    // The single evaluation core is the expression-tree kernel; there is no parallel switch-based evaluator.
    return false
  }

  /** Parse window string like "5m", "1h" -> milliseconds */
  private parseWindow(window: string): number {
    const match = window.trim().match(/^(\d+)(s|m|h|d)$/)
    if (!match) return 60000 // default 1 minute
    const num = parseInt(match[1], 10)
    const unit = match[2]
    const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
    return num * (multipliers[unit] ?? 60000)
  }

  private resolveField(field: string, context: Record<string, unknown>): unknown {
    // use hasOwnProperty instead of `in` to prevent prototype chain access
    // `in` traverses prototype, allowing __proto__/constructor pollution attacks
    if (Object.prototype.hasOwnProperty.call(context, field)) return context[field]
    // Fall back to nested path resolution
    return field.split('.').reduce<unknown>((obj, key) => {
      if (obj === null || obj === undefined || typeof obj !== 'object') return undefined
      if (Array.isArray(obj)) return undefined // reject array prototype access
      // use hasOwnProperty for nested access
      if (!Object.prototype.hasOwnProperty.call(obj, key)) return undefined
      return (obj as Record<string, unknown>)[key]
    }, context)
  }

  // ===============================================
  // Workflow step evaluation
  // ===============================================

  private evaluateWorkflowStep(context: Record<string, unknown>): EvaluationResult {
    const active = context['workflow.active'] as {
      steps: Array<{ id: string; description: string; verify: RuleCondition[]; auto_pass_if?: string }>
      current_step: number
      rule_name: string
    }

    const currentStep = active.steps[active.current_step]
    if (!currentStep) {
      // workflow exhausted all steps
      return { decision: 'ALLOW', matchedRules: [], totalEvaluated: 0, totalMatched: 0 }
    }

    // Check auto_pass condition
    if (currentStep.auto_pass_if) {
      const autoMatch = currentStep.auto_pass_if.match(/^tool\.name\s+eq\s+(\w+)$/)
      if (autoMatch) {
        if (context['tool.name'] !== autoMatch[1]) {
          return {
            decision: 'WORKFLOW_WAITING',
            matchedRules: [{
              ruleId: active.rule_name,
              ruleName: active.rule_name,
              decision: 'WORKFLOW_WAITING',
              reason: `Awaiting: ${currentStep.description}`,
              priority: 1,
            }],
            totalEvaluated: 1, totalMatched: 0,
          }
        }
      }
    }

    // Verify current step conditions
    const matched = currentStep.verify.length === 0 ||
      currentStep.verify.every((cond) => this.evaluateLeaf(cond, context))

    if (!matched) {
      return {
        decision: 'WORKFLOW_WAITING',
        matchedRules: [{
          ruleId: active.rule_name,
          ruleName: active.rule_name,
          decision: 'WORKFLOW_WAITING',
          reason: `Awaiting: ${currentStep.description}`,
          priority: 1,
        }],
        totalEvaluated: 1, totalMatched: 0,
      }
    }

    // Step passed - advance
    active.current_step++
    context['workflow.active'] = active

    if (active.current_step >= active.steps.length) {
      return {
        decision: 'ALLOW',
        matchedRules: [{
          ruleId: active.rule_name,
          ruleName: active.rule_name,
          decision: 'ALLOW',
          reason: 'Workflow complete - all steps verified',
          priority: 1,
        }],
        primaryReason: 'Workflow complete',
        totalEvaluated: 1, totalMatched: 1,
      }
    }

    const nextStep = active.steps[active.current_step]
    return {
      decision: 'WORKFLOW_PROGRESS',
      matchedRules: [{
        ruleId: active.rule_name,
        ruleName: active.rule_name,
        decision: 'WORKFLOW_PROGRESS',
        reason: `Step ${active.current_step}/${active.steps.length} complete. Next: ${nextStep.description}`,
        priority: 1,
      }],
      totalEvaluated: 1, totalMatched: 1,
    }
  }
}
