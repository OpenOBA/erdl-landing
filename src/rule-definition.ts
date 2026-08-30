/**
 * ERDL - Rule Definition Types
 *
 * Core type definitions for ERDL rules.
 * Supports personal rules, team standards, enterprise policies, and compliance mandates.
 *
 * @license MIT
 */

// ============================================
// Rule Condition
// ============================================

/**
 * Condition kind - ERDL defines a single kind: context_matches.
 * All conditions evaluate field + operator + value against the execution context.
 */
import type { ConditionOperator as SchemaConditionOperator } from './erdl-schema.js'

export type ConditionKind = 'context_matches'

/** Comparison operators - derived from the single source of truth (erdl-schema).
 * Do not re-enumerate operators in this file. */
export type ConditionOperator = SchemaConditionOperator

export interface RuleCondition {
  /** Condition kind (legacy, deprecated; kept optional for compatibility with old data - evaluation logic never reads it). */
  kind?: ConditionKind

  /** Keywords to match against agent intent (intent_contains) */
  keywords?: string[]

  /** Regex pattern to match (intent_matches / context_matches) */
  pattern?: string

  /** Context field path for context_matches or Spec mode (e.g., "file", "language") */
  field?: string

  /** Expected value for context_matches comparison */
  value?: unknown

  /** Comparison operator (when using field/operator/value mode) */
  operator?: ConditionOperator

  /** Time window constraint (e.g., "5m") */
  within?: string

  /** Rate limit constraint (e.g., "10/1m") */
  rate?: string

  /**
   * Structured expression tree (S-expression JSON shape, the external form).
   * Carries complex conditions that field/operator/value cannot express
   * (temporal arithmetic / arithmetic / function delegation, etc.).
   * Converted to a tree via fromSExpr at evaluation time; mutually exclusive
   * with field/operator/value.
   */
  expr?: unknown
}

// ============================================
// Rule Action / Decision
// ============================================

/** Decision types (13 base + 2 WORKFLOW substates). */
export type Decision =
  // 13 externally visible
  | 'ALLOW' | 'DENY' | 'CORRECT' | 'NOTIFY'
  | 'EMERGENCY_HALT' | 'ROLLBACK' | 'QUARANTINE'
  | 'REQUEST_HUMAN' | 'ESCALATE' | 'DELEGATE' | 'DEFER'
  | 'WORKFLOW' | 'WORKFLOW_PROGRESS' | 'WORKFLOW_WAITING'
  | 'GUIDE'

/** Override level enum (critical > high > normal > low) */
export type OverrideLevel = 'critical' | 'high' | 'normal' | 'low'

/** Execution Ring level */
export type RingLevel = 0 | 1 | 2 | 3

/** Agent role in the ERDL Protocol */
export type AgentRole = 'guardian' | 'operator' | 'observed'

export interface RuleAction {
  /** What should happen when this rule matches */
  decision: Decision
  /** Instruction for the LLM to follow */
  instruction?: string
  /**
   * List of associated knowledge-entry ids (references to full SOPs / best
   * practices / original regulation text). When a guidance decision (GUIDE,
   * etc.) matches, the LLM uses these to retrieve the full knowledge detail.
   * Rules stay lightweight; knowledge stays heavyweight; each does its own job.
   */
  knowledge_refs?: string[]
  /** Reason shown to user when blocked or halted */
  reason?: string
  /**
   * Human-friendly bilingual explanation of WHY this rule exists and WHAT harm it prevents.
   * Shown in agent chat feedback, not just on DENY  - also on ALLOW as context.
   */
  explanation?: string | { zh: string; en: string }
  /**
   * Suggested alternative action when the operation is blocked.
   * Shown as a localized "Alternative: ..." line.
   */
  alternative?: string | { zh: string; en: string }
  /** Execution Ring level (0-3). Guardian rules default Ring 0. */
  ring?: RingLevel
  /** Correction target text (CORRECT decision) */
  correction?: string
}

// ============================================
// Rule Definition
// ============================================

/**
 * Rule category for organization.
 *
 * coding  - code standards and patterns
 * engineering  - engineering discipline and workflow
 * security  - security rules and vulnerability prevention
 * writing  - content and documentation standards
 * design  - UI/UX and visual design constraints
 * performance  - runtime efficiency and optimization
 * testing  - test coverage and quality gates
 * compliance  - regulatory and legal mandates
 * accessibility  - a11y and inclusive design
 * custom  - user-defined / uncategorized
 */
export type RuleCategory =
  | 'coding'
  | 'engineering'
  | 'security'
  | 'writing'
  | 'design'
  | 'performance'
  | 'testing'
  | 'compliance'
  | 'accessibility'
  | 'observability'
  | 'custom'


/**
 * Six-tier rule hierarchy (legacy).
 * Tier 0 (Moral), 1 (Compliance), 2 (Security), 3 (Policy), 4 (Role), 5 (Convention).
 */
export type RuleTier = 0 | 1 | 2 | 3 | 4 | 5

export const TIER_LABELS: Record<RuleTier, string> = {
  0: "Moral", 1: "Compliance", 2: "Security",
  3: "Policy", 4: "Role", 5: "Convention",
};

/** Tier override semantics (legacy). */
export type TierOverride = "none" | "human_approval" | "emergency_override" | "always";

export const TIER_RING_COMPAT: Record<RuleTier, number[]> = {
  0: [0], 1: [0, 1], 2: [0, 1, 2],
  3: [1, 2, 3], 4: [2, 3], 5: [3],
};

export interface RuleDefinition {
  /** Unique rule ID (derived from name, e.g., "dangerous_command_intercept") */
  id: string

  /** Human-readable rule name */
  name: string

  /** One-line description */
  description: string

  /** Category for organization */
  category: RuleCategory

  /** Match conditions (field/operator/value) */
  conditions: RuleCondition[]

  /** Condition logic: AND = all must match, OR = any must match */
  conditionLogic?: 'AND' | 'OR'

  /** Action to take when matched */
  action: RuleAction

  /** Priority: lower number = higher priority (1-1000) */
  priority: number

  /** Whether this rule is currently active */
  enabled: boolean

  /**
   * Hard constraint that immediately terminates all other rule evaluations
   * upon match. Cannot be bypassed by LLMs.
   *
   * Levels: critical | high | normal | low
   * - critical/high: can override a prior DENY -> ALLOW (same Ring only)
   * - normal/low: do not enable override behavior (treated as non-override)
   * - undefined: no override
   */
  override?: OverrideLevel

  /** Rule version (for tracking changes) */
  version?: number

  /**
   * Legal basis (the citation of the regulation clause, e.g. "Regulation X,
   * Article 23, Paragraph 2"). Surfaced when rendering approval decisions.
   */
  legal_basis?: string | null

  /**
   * Excerpt of the original regulation text that the rule is based on.
   * Surfaced when rendering approval decisions.
   */
  source_text?: string | null

  /**
   * unless exemption conditions.
   * Evaluated BEFORE when conditions. If unless matches - ALLOW (exempt).
   * Same structure as conditions.
   */
  unless?: { logic?: 'AND' | 'OR'; conditions: RuleCondition[] }

  /** Workflow definition - multi-step checkpoint verification */
  workflow?: WorkflowDefinition

  /** Compliance scope level (1-5). 1=personal, 2=organizational, 3=national, 4=regional, 5=global */
  scopeLevel?: 1 | 2 | 3 | 4 | 5

  /** Hit count (runtime counter) */
  hitCount?: number
}

// ============================================
// Evaluation Result
// ============================================

export interface RuleMatch {
  ruleId: string
  ruleName: string
  decision: Decision
  instruction?: string
  reason?: string
  explanation?: string | { zh: string; en: string }
  alternative?: string | { zh: string; en: string }
  ring?: RingLevel
  correction?: string
  /** Corrected arguments carried by a CORRECT decision (argument override). */
  correctedArgs?: Record<string, unknown>
  priority: number
}

/**
 * Window-count snapshot of a stateful operator (within/rate).
 * Recorded into the DO's `evaluation.temporal_state`, making "why the rate
 * limit fired at this moment" verifiable by offline recomputation.
 * Field structure (frozen): { rule_id, operator, field, window_ms, count, limit? }.
 */
export interface TemporalStateEntry {
  rule_id: string
  operator: 'within' | 'rate'
  field: string
  window_ms: number
  count: number
  /** The limit of a rate operator (e.g. the 5 in "5/1m"); within has no limit and omits it. */
  limit?: number
}

export interface EvaluationResult {
  /** Overall decision: ALLOW if any matched, DENY if blocked, or the fallback decision if no rules fired */
  decision: Decision

  /** All matched rules, in evaluation order (excludes unless exemptions) */
  matchedRules: RuleMatch[]

  /** unless exemptions - rules exempted via unless, recorded separately.
   *  Not included in matchedRules (matched_rules stays empty when only unless fires). */
  unlessExemptions?: RuleMatch[]

  /** The highest-priority instruction (for ALLOW) or reason (for DENY) */
  primaryInstruction?: string
  primaryReason?: string
  primaryExplanation?: string | { zh: string; en: string }
  primaryAlternative?: string | { zh: string; en: string }
  /** Correction text (CORRECT decision) */
  primaryCorrection?: string

  /** Total rules evaluated */
  totalEvaluated: number

  /** Total rules matched */
  totalMatched: number

  /** Window-count snapshots of stateful operators (within/rate), recorded into the DO temporal_state; omitted/empty when nothing matched. */
  temporalState?: TemporalStateEntry[]
}

// ============================================
// Create Rule from NL
// ============================================

export interface RuleCreationRequest {
  naturalLanguage: string
  category: RuleCategory
  autoActivate?: boolean
}

export interface RuleCreationResult {
  ruleId: string
  name: string
  status: 'created' | 'updated'
  filePath: string
}

// ============================================
// Simulate
// ============================================

export interface SimulateScenario {
  /** Human description of the scenario */
  description: string
  /** Simulated agent intent */
  intent: string
  /** Simulated context */
  context: Record<string, unknown>
  /** Expected outcome */
  expectedDecision: Decision
}

export interface SimulateResult {
  scenario: SimulateScenario
  actualDecision: Decision
  matched: boolean
  matchedRules: RuleMatch[]
}

// ============================================
// Agent Identity (ERDL Protocol Spec)
// ============================================

export interface AgentIdentity {
  /** Agent role: guardian (enforces rules) or observed (subject to rules) */
  role: AgentRole
  /** IDs of agents this guardian observes */
  observes?: string[]
}

// ============================================
// Workflow Definition
// ============================================

/** Workflow step definition  - embedded in RuleDefinition */
export interface WorkflowDefinition {
  on_failure: 'DENY' | 'REQUEST_HUMAN'
  timeout_seconds: number
  max_steps: number
  steps: WorkflowStep[]
}

export interface WorkflowStep {
  id: string
  description: string
  verify: RuleCondition[]
  auto_pass_if?: string
  post_action?: string
}

/** Runtime workflow state  - maintained by the runtime per session */
export interface WorkflowState {
  ruleName: string
  ruleId: string
  steps: WorkflowStep[]
  current_step: number
  started_at: Date
  session_id: string
}
