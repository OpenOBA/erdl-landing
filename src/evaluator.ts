/**
 * ERDL - Rule Evaluator (ERDL Spec v2.3 Sec. 7 compliant)
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

import type { RuleDefinition, RuleCondition, EvaluationResult, RuleMatch, Decision, RingLevel, OverrideLevel, TemporalStateEntry, EvalProfile } from './rule-definition.js'
import { GuardStateManager } from './guard-state-manager.js'
import { SystemClock, type Clock } from './clock.js'
import { ExprTreeEvaluator } from './expr-tree/evaluator.js'
import { normalizeOperator, ruleToExpr } from './expr-tree/rule-to-expr.js'
import { hashTreeWithPrefix } from './expr-tree/canonical.js'
import { compileSimpleCondition } from './expr-tree/simple-compiler.js'
import { fromSExpr, toSExpr } from './expr-tree/s-expression.js'
import { ExprLimitError } from './expr-tree/limits.js'
import type { EvalWarning } from './expr-tree/eval-warning.js'
import type { ExprNode } from './expr-tree/node-types.js'
import type { StateMachine } from './state-machine.js'
import { canonicalize } from 'json-canonicalize'
import { createHash } from 'node:crypto'

// Sec. 7.1: override level ranking - critical > high > normal > low
// normal/low do NOT enable override behavior
const OVERRIDE_RANK: Record<OverrideLevel, number> = { critical: 0, high: 1, normal: 2, low: 3 }
/** Returns rank for sorting; an absent override defaults to `normal` (SPEC §7.1 item 3). */
function overrideSortRank(rule: RuleDefinition): number {
  if (!rule.override) return OVERRIDE_RANK.normal
  return OVERRIDE_RANK[rule.override] ?? OVERRIDE_RANK.normal
}
/** Sec. 7.1: only critical/high enable override behavior */
function overrideEnables(rule: RuleDefinition): boolean {
  return rule.override === 'critical' || rule.override === 'high'
}

// §6 + §7.1: restrictive-polarity decisions (DENY + its action variants ROLLBACK /
// QUARANTINE) tighten an ALLOW. EMERGENCY_HALT / WORKFLOW are terminal and
// short-circuit (handled before the §7.1 gate). Consolidated 2026-09-06 —
// previously only DENY was treated as tightening; ROLLBACK/QUARANTINE fell into
// the accumulate branch and could never override ALLOW.
const RESTRICTIVE_DECISIONS: ReadonlySet<string> = new Set(['DENY', 'ROLLBACK', 'QUARANTINE'])
function isRestrictive(decision: string): boolean {
  return RESTRICTIVE_DECISIONS.has(decision)
}

/** §7.1a 决策强度偏序（数字越小越强）。NOTIFY 不参与（附带动作）。 */
const DECISION_STRENGTH: Record<string, number> = {
  EMERGENCY_HALT: 0, WORKFLOW: 0,
  DENY: 1, ROLLBACK: 1, QUARANTINE: 1,
  REQUEST_HUMAN: 2, ESCALATE: 3, DELEGATE: 4, DEFER: 5,
  CORRECT: 6, GUIDE: 7, ALLOW: 8,
}

/** §7.1a fold 决策合并：当前结果 + 新命中 → 新结果。 */
function foldDecision(final: Decision | undefined, next: Decision, overrideEnabled: boolean): Decision {
  if (next === 'EMERGENCY_HALT' || next === 'WORKFLOW') return next
  if (final === undefined) return next
  if (isRestrictive(next) && !isRestrictive(final)) return next // 收紧自由
  if (isRestrictive(final) && !isRestrictive(next)) {
    return overrideEnabled ? next : final // 放松需 override
  }
  const ns = DECISION_STRENGTH[next] ?? 8
  const fs = DECISION_STRENGTH[final] ?? 8
  return ns < fs ? next : final // 同向取更强
}

/** §8.2a.1a 规则规范对象（rule canonical object）。 */
function ruleCanonicalObject(rule: RuleDefinition): Record<string, unknown> {
  const whenTree = ruleToExpr(rule)
  let unlessTree: unknown = null
  if (rule.unless && rule.unless.conditions && rule.unless.conditions.length > 0) {
    const unlessRule: RuleDefinition = { ...rule, conditions: rule.unless.conditions, conditionLogic: rule.unless.logic ?? 'AND', unless: undefined }
    const unlessExpr = ruleToExpr(unlessRule)
    unlessTree = unlessExpr ? toSExpr(unlessExpr) : null
  }
  return {
    name: rule.name,
    when_tree: whenTree ? toSExpr(whenTree) : null,
    unless_tree: unlessTree,
    then: rule.action.decision,
    priority: rule.priority,
    override: rule.override ?? 'normal',
    ring: rule.action.ring ?? 3,
    enabled: rule.enabled,
  }
}

/** §8.2a.1a rule_set_hash：规则语义全集哈希（含 fallback 决策）。 */
function computeRuleSetHash(rules: RuleDefinition[], fallbackDecision?: Decision): string {
  const canonical = canonicalize({
    fallback_decision: fallbackDecision ?? 'ALLOW',
    rules: rules.map(ruleCanonicalObject),
  })
  return 'sha256:' + createHash('sha256').update(canonical).digest('hex')
}

/** §8.2a.1a 规范版本与引擎标识（进 eval_profile）。 */
const SPEC_VERSION = 'v2.3'
const ENGINE_ID = 'erdl-engine'

/** §8.2a.1a 字段契约哈希（契约哈希化引用；无契约时为 null）。 */
function computeContractHash(fieldContracts?: Record<string, { type?: string; default_value?: unknown; optional?: boolean }>): string | null {
  if (!fieldContracts) return null
  return 'sha256:' + createHash('sha256').update(canonicalize(fieldContracts)).digest('hex')
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

  /** Field contracts (field name → { type?, default_value? }), applied to field nodes under §7.0.1a (default_value for missing fields, type check under strict mode). */
  private fieldContracts?: Record<string, { type?: string; default_value?: unknown; optional?: boolean }>

  /** §6a: state machine (optional) — when supplied, `state.<name>` resolves from it and the result carries a state_snapshot. */
  private stateMachine?: StateMachine
  /** §6a: state variables actually read during this evaluation (on-demand snapshot). */
  private readonly stateVarsRead = new Set<string>()

  constructor(stateManager?: GuardStateManager, clock?: Clock) {
    this.stateManager = stateManager ?? new GuardStateManager()
    this.clock = clock ?? new SystemClock()
  }

  evaluate(
    rules: RuleDefinition[],
    context: Record<string, unknown>,
    options?: { asOf?: Date | string; fallbackDecision?: Decision; strict?: boolean; fieldContracts?: Record<string, { type?: string; default_value?: unknown; optional?: boolean }>; stateMachine?: StateMachine },
  ): EvaluationResult {
    this.stateMachine = options?.stateMachine
    this.stateVarsRead.clear()
    // Inject the time basis (asOf) for this evaluation. A caller-supplied asOf (for
    // recomputation) takes precedence over the injected Clock; the expression-tree
    // kernel stays pure.
    this.asOf = options?.asOf !== undefined ? new Date(options.asOf) : new Date(this.clock.now())
    this.treeEvaluator.strict = options?.strict ?? false
    this.fieldContracts = options?.fieldContracts

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
    // §8.2a.1a: rule_set_hash 覆盖规则语义全集（含 fallback 决策）
    const ruleSetHash = computeRuleSetHash(enabled, options?.fallbackDecision)
    // §8.2a.1a: eval_profile 记录求值选项（strict/context/契约哈希/版本/引擎）
    const evalProfile: EvalProfile = {
      strict: this.treeEvaluator.strict,
      context: 'guard',
      contract_hash: computeContractHash(this.fieldContracts),
      spec_version: SPEC_VERSION,
      engine_id: ENGINE_ID,
    }
    if (enabled.length === 0) {
      // Sec. 2.2 metadata: metadata.decision fallback takes precedence over default ALLOW
      const metadataDecision = options?.fallbackDecision
      if (metadataDecision) {
        return { decision: metadataDecision, matchedRules: [], totalEvaluated: 0, totalMatched: 0, ruleSetHash, evalProfile, primaryReason: `No enabled rules; metadata.decision fallback: ${metadataDecision}` }
      }
      // no enabled rules -> ALLOW
      return { decision: 'ALLOW', matchedRules: [], totalEvaluated: 0, totalMatched: 0, ruleSetHash, evalProfile }
    }

    // §7.1 item 6 (global): a catch-all (empty-condition) rule takes effect only
    // when NO explicit-condition rule matched — so explicit rules evaluate first
    // (ring-major), then catch-all rules (ring-major), and catch-all rules are
    // inert once any explicit rule matched.
    const ringOf = (r: RuleDefinition) => (r.action.ring ?? 3) as number
    const isCatchAllRule = (r: RuleDefinition) => !r.conditions || r.conditions.length === 0
    const cmpRule = (a: RuleDefinition, b: RuleDefinition) => {
      const ra = ringOf(a)
      const rb = ringOf(b)
      if (ra !== rb) return ra - rb
      if (a.priority !== b.priority) return a.priority - b.priority
      return overrideSortRank(a) - overrideSortRank(b)
    }
    const explicitRules = enabled.filter((r) => !isCatchAllRule(r)).sort(cmpRule)
    const catchAllRules = enabled.filter((r) => isCatchAllRule(r)).sort(cmpRule)

    const allMatched: RuleMatch[] = []
    // Window-count snapshots of stateful operators (within/rate), recorded into the DO temporal_state
    const temporalState: TemporalStateEntry[] = []
    // Sec. 7.4: unless exemptions recorded separately - NOT in matchedRules
    const unlessExemptions: RuleMatch[] = []
    let finalDecision: Decision | undefined = undefined
    let finalInstruction: string | undefined
    let finalReason: string | undefined
    let finalCorrection: string | undefined
    let finalExplanation: RuleDefinition['action']['explanation'] | undefined
    let finalAlternative: RuleDefinition['action']['alternative'] | undefined
    let anyExplicitMatched = false
    // §7.0.2: WORKFLOW 待启动（仅在无拦截类命中时启动）
    let pendingWorkflow: { rule: RuleDefinition; match: RuleMatch } | null = null
    // §7.0.3 total_evaluated: the number of rules whose unless/when evaluation was
    // actually entered (excludes rules skipped by catch-all inertness).
    let evaluatedCount = 0
    // E12 fail-close: any evaluation error across the rule set folds the final decision to DENY.
    let anyErrored = false
    // E3 求值警告（eval_warnings）汇聚
    const evalWarnings: EvalWarning[] = []
    // E6 树即证据：命中规则的 canonical 树快照哈希
    const canonicalTrees: Array<{ ruleId: string; tree: unknown; hash: string }> = []

    for (const rule of [...explicitRules, ...catchAllRules]) {
      const ring = ringOf(rule)

      // §7.1 item 6: catch-all rules are inert once any explicit rule matched.
      if (isCatchAllRule(rule) && anyExplicitMatched) continue
        // Sec. 7.4: unless exemption - evaluated BEFORE when
        evaluatedCount += 1
        if (rule.unless?.conditions && rule.unless.conditions.length > 0) {
          const unlessLogic = rule.unless.logic ?? 'AND'
          const unlessResults = rule.unless.conditions.map((cond) => this.evaluateLeaf(cond, context))
          if (unlessResults.some((r) => r.errored)) anyErrored = true
          for (const r of unlessResults) evalWarnings.push(...r.warnings)
          const unlessExempt = unlessLogic === 'OR'
            ? unlessResults.some((r) => r.matched)
            : unlessResults.every((r) => r.matched)
          if (unlessExempt) {
            unlessExemptions.push({
              ruleId: rule.name,
              ruleName: `${rule.name}/unless`,
              decision: 'ALLOW',
              reason: `unless condition matched - rule exempt`,
              priority: rule.priority,
              ring: (rule.action.ring ?? 3) as RingLevel,
            })
            // §7.4: an unless exemption is a *skip*, not a decision — record it and continue
            // without setting finalDecision (the fallback chain still applies).
            continue
          }
        }

        const condResults = rule.conditions.map((cond) => this.evaluateLeaf(cond, context))
        if (condResults.some((r) => r.errored)) anyErrored = true
        for (const r of condResults) evalWarnings.push(...r.warnings)
        const matched = rule.conditions.length === 0 ||
          (rule.conditionLogic === 'OR'
            ? condResults.some((r) => r.matched)
            : condResults.every((r) => r.matched))
        if (!matched) continue

        if (!isCatchAllRule(rule)) anyExplicitMatched = true

        // E6 树即证据：命中规则的 canonical 树快照哈希（进哈希的派生产物）
        const matchedTree = this.ruleToTree(rule)
        if (matchedTree !== null) {
          canonicalTrees.push({ ruleId: rule.id, tree: toSExpr(matchedTree), hash: hashTreeWithPrefix(matchedTree) })
        }

        const match = this.makeMatch(rule, ring as RingLevel)
        allMatched.push(match)
        // Collect window-count snapshots of stateful operators (within/rate) into the DO temporal_state
        this.collectTemporalState(rule, temporalState)

        // WORKFLOW - §7.0.2: record pending; it starts only when no restrictive decision matched.
        if (match.decision === 'WORKFLOW' && rule.workflow) {
          pendingWorkflow = { rule, match }
          continue
        }

        // EMERGENCY_HALT - §7.0.2 full short-circuit on hit, any ring.
        if (match.decision === 'EMERGENCY_HALT') {
          finalDecision = 'EMERGENCY_HALT'
          finalReason = match.reason
          finalInstruction = match.instruction
          finalExplanation = match.explanation
          finalAlternative = match.alternative
          return {
            decision: finalDecision,
            matchedRules: allMatched,
            unlessExemptions: unlessExemptions.length > 0 ? unlessExemptions : undefined,
            primaryReason: finalReason ?? `${finalDecision} triggered by Ring ${ring} rule`,
            primaryInstruction: finalInstruction,
            primaryCorrection: finalCorrection,
            primaryExplanation: finalExplanation,
            primaryAlternative: finalAlternative,
            totalEvaluated: evaluatedCount,
            totalMatched: allMatched.length,
            temporalState: temporalState.length > 0 ? temporalState : undefined,
            ruleSetHash,
            evalProfile,
          }
        }

        // NOTIFY - §7.1a: side action, recorded in matched_rules but does NOT change the decision.
        if (match.decision === 'NOTIFY') {
          continue
        }

        // §7.1a: fold decision merge (decision-strength partial order).
        // - Restrictive (DENY/ROLLBACK/QUARANTINE) tightens freely (no override needed).
        // - Relaxing (restrictive → non-restrictive) requires override critical/high.
        // - Same direction takes the stronger (smaller strength number).
        // - EMERGENCY_HALT / WORKFLOW are terminal (handled before the fold).
        // - NOTIFY is a side action (handled before the fold).
        const prevDecision = finalDecision
        finalDecision = foldDecision(prevDecision, match.decision, overrideEnables(rule))
        const adopted = finalDecision !== prevDecision

        // Update primary fields on adoption; accumulate instructions on ALLOW-on-ALLOW.
        if (adopted) {
          if (match.instruction !== undefined) finalInstruction = match.instruction
          if (match.reason !== undefined) finalReason = match.reason
          if (match.correction !== undefined) finalCorrection = match.correction
          if (match.explanation !== undefined) finalExplanation = match.explanation
          if (match.alternative !== undefined) finalAlternative = match.alternative
        } else if (finalDecision === 'ALLOW' && match.decision === 'ALLOW') {
          // Sec. 7.1: accumulate instructions even when finalDecision is already ALLOW
          if (match.instruction) {
            finalInstruction = finalInstruction
              ? `${finalInstruction}; ${match.instruction}`
              : match.instruction
          }
        }

        // A matched-but-overridden non-ALLOW rule is dropped from matched_rules.
        const isAllowAccumulation = match.decision === 'ALLOW' && finalDecision === 'ALLOW'
        if (!adopted && !isAllowAccumulation) {
          allMatched.pop()
        }
        continue // keep evaluating
    }

    // §7.0.2: WORKFLOW starts only when no restrictive decision / EMERGENCY_HALT matched.
    if (pendingWorkflow && finalDecision !== 'EMERGENCY_HALT' && !(finalDecision !== undefined && isRestrictive(finalDecision))) {
      const wf = pendingWorkflow
      context['workflow.active'] = {
        rule_name: wf.rule.name,
        rule_id: wf.rule.id,
        steps: wf.rule.workflow!.steps,
        current_step: 0,
        started_at: new Date(this.clock.now()),
      }
      return this.evaluateWorkflowStep(context)
    }

    // E12 fail-close: an evaluation error (not a normal "condition not satisfied") must fold
    // to the blocking side — never silently fall through to the fallback (fail-open).
    if (anyErrored) {
      finalDecision = 'DENY'
      finalReason = 'evaluation error (fail-close)'
    }

    // E3/E6/E9 求值证据（canonical 树哈希 / 警告 / 错误标志 / 时间基准）
    const evidence = {
      canonicalTrees: canonicalTrees.length > 0 ? canonicalTrees : undefined,
      ruleSetHash,
      evalProfile,
      evalWarnings: evalWarnings.length > 0 ? evalWarnings : undefined,
      errored: anyErrored ? true : undefined,
      asOf: this.asOf ? this.asOf.toISOString() : undefined,
    }

    // §6a.5.1: on-demand state snapshot (only the variables actually read).
    const stateSnapshot = this.stateMachine && this.stateVarsRead.size > 0
      ? this.stateMachine.snapshot([...this.stateVarsRead])
      : undefined

    if (allMatched.length === 0) {
      // Sec. 2.2 metadata: priority chain - rules[].then > metadata.decision > default
      const metadataDecision = options?.fallbackDecision
      if (metadataDecision && !anyErrored) {
        return {
          decision: metadataDecision,
          matchedRules: [],
          unlessExemptions: unlessExemptions.length > 0 ? unlessExemptions : undefined,
          totalEvaluated: evaluatedCount,
          totalMatched: 0,
          primaryReason: `No rules matched; metadata.decision fallback: ${metadataDecision}`,
          stateSnapshot,
          ...evidence,
        }
      }
      // No rule matched: fall back to the default (metadata.decision already handled above).
      if (finalDecision === undefined) finalDecision = 'ALLOW'
      return { decision: finalDecision as Decision, matchedRules: [], unlessExemptions: unlessExemptions.length > 0 ? unlessExemptions : undefined, totalEvaluated: evaluatedCount, totalMatched: 0, stateSnapshot, ...evidence }
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
      totalEvaluated: evaluatedCount,
      totalMatched: allMatched.length,
      temporalState: temporalState.length > 0 ? temporalState : undefined,
      stateSnapshot,
      ...evidence,
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
    const matched = rule.conditions.length === 0 || rule.conditions.every((cond) => this.evaluateLeaf(cond, ctx).matched)
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
        const rateKey = this.rateKey(cond.field, cond.operator ?? '', cond.value, cond.rate, cond.scope)
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
        const trackerKey = this.withinKey(cond.field, cond.operator ?? '', cond.value, cond.scope)
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
  private rateKey(field: string, operator: string, value: unknown, rate: string, scope?: string): string {
    const op = normalizeOperator(operator) ?? operator
    return `rate:${field}:${op}:${this.serializeValue(value)}:${rate}:${scope ?? ''}`
  }

  /**
   * within counter key: includes field + operator + value + scope, so different operations are deduplicated independently per subject scope.
   */
  private withinKey(field: string, operator: string, value: unknown, scope?: string): string {
    const op = normalizeOperator(operator) ?? operator
    return `within:${field}:${op}:${this.serializeValue(value)}:${scope ?? ''}`
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
  private buildTreeContext(context: Record<string, unknown>): { resolveField: (f: string) => unknown; resolveVar: (v: string) => unknown; asOf?: Date; fieldContracts?: Record<string, { type?: string; default_value?: unknown; optional?: boolean }> } {
    return {
      resolveField: (f: string) => this.resolveField(f, context),
      resolveVar: (v: string) => {
        if (v === '$') return context
        const p = v.startsWith('$.') ? v.slice(2) : v
        return this.resolveField(p, context)
      },
      asOf: this.asOf ?? undefined,
      fieldContracts: this.fieldContracts,
    }
  }

  /** E6 树即证据：把命中规则编译为表达式树（canonical ruleToExpr）。 */
  private ruleToTree(rule: RuleDefinition): ExprNode | null {
    return ruleToExpr(rule)
  }

  private evaluateLeaf(cond: RuleCondition, context: Record<string, unknown>): { matched: boolean; errored: boolean; warnings: EvalWarning[] } {
    // Expression projection: a structured expression tree (S-expression) takes priority and is evaluated directly by the tree kernel
    if (cond.expr !== undefined && cond.expr !== null) {
      try {
        const tree = fromSExpr(cond.expr)
        const evalCtx = this.buildTreeContext(context)
        const result = this.treeEvaluator.evaluate(tree, evalCtx)
        return { matched: result.value === true, errored: result.errored === true, warnings: result.warnings }
      } catch (e) {
        // Split by exception type - resource-limit breaches (ExprLimitError) are attack signals and must be observable;
        // structural errors such as parse failures fail close silently
        if (e instanceof ExprLimitError) {
          console.warn(`[Evaluator] expression resource limit exceeded (fail-close): ${e.message}`)
        }
        // S-expression parse failure -> evaluation error (fail-close)
        return { matched: false, errored: true, warnings: [] }
      }
    }

    const { field, operator } = cond
    if (!field) return { matched: false, errored: false, warnings: [] }

    if (!operator) return { matched: false, errored: false, warnings: [] }

    const raw = this.resolveField(field, context)

    // Null propagation: when the field is absent, all comparisons return false except ==null/!=null/exists.
    // Semantics: "field does not exist" is uniformly treated as "condition not satisfied", not as an evaluation error.
    // Only exists/not_exists and ==null/!=null can sense field presence.
    const isAbsent = raw === undefined || raw === null
    if (isAbsent) {
      if (operator === 'exists') return { matched: false, errored: false, warnings: [] }
      if (operator === 'not_exists') return { matched: true, errored: false, warnings: [] }
      if (operator === 'eq' && (cond.value === null || cond.value === undefined)) return { matched: true, errored: false, warnings: [] }
      if (operator === 'ne' && (cond.value === null || cond.value === undefined)) return { matched: false, errored: false, warnings: [] }
      // All other comparisons with absent field -> false
      return { matched: false, errored: false, warnings: [] }
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
          const rateKey = this.rateKey(field, operator, cond.value, cond.rate, cond.scope)
          const windowMs = this.parseWindow(cond.rate.split('/')[1] ?? '1m')
          const maxCount = parseInt(cond.rate.split('/')[0] ?? '10', 10)
          if (this.stateManager.checkRate(rateKey, maxCount, windowMs)) {
            // Under the limit: record this operation (allow); the condition does not hold
            this.stateManager.recordRate(rateKey, windowMs)
            return { matched: false, errored: false, warnings: result.warnings }
          }
          // Over the limit: the condition holds (triggers the block)
        }

        // within deduplication (post-check: only counted when the field matches; value-isolated).
        // Correct semantics: first trigger (no history) -> record + allow; subsequent triggers inside the window (has history) -> block.
        if (matched && cond.within) {
          const trackerKey = this.withinKey(field, operator, cond.value, cond.scope)
          const windowMs = this.parseWindow(cond.within)
          if (!this.stateManager.checkWithin(trackerKey, windowMs)) {
            // No history in the window (first trigger): record this; the condition does not hold (allow)
            this.stateManager.recordWithin(trackerKey)
            return { matched: false, errored: false, warnings: result.warnings }
          }
          // History exists in the window: the condition holds (triggers the block)
        }

        return { matched, errored: result.errored === true, warnings: result.warnings }
      } catch {
        return { matched: false, errored: true, warnings: [] }
      }
    }

    // normalizeOperator covers all 28 pure condition operators; reaching here means the
    // operator is impure (within/rate are handled earlier in the main loop; pattern/keywords are impure).
    // The single evaluation core is the expression-tree kernel; there is no parallel switch-based evaluator.
    return { matched: false, errored: false, warnings: [] }
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
    // §6a.3: `state.<name>` resolves from the state machine (controlled read-only
    // injection), never from free fact. Record the read for the on-demand snapshot.
    if (field.startsWith('state.')) {
      if (this.stateMachine) {
        const name = field.slice('state.'.length)
        this.stateVarsRead.add(name)
        return this.stateMachine.getValue(name)
      }
      // No state machine: a state.* reference cannot resolve (load-time validation
      // already rejects undeclared state refs; this is a defensive E11 miss).
      return undefined
    }
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
      currentStep.verify.every((cond) => this.evaluateLeaf(cond, context).matched)

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
