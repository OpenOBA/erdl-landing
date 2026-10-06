/**
 * evaluation-object — language-layer "evaluation result DO" serialization + hash.
 *
 * Implements SPEC §8.2a.1: the language-layer Decision-Object preimage. This is
 * a DIFFERENT preimage from the RFC-002 governance-layer `decision-object`
 * (erdl-vectors): the language layer serializes the raw evaluation result
 * (context → decision → matched_rules → … → as_of), while RFC-002 carries the
 * full CORE-14 governance envelope. The two MUST NOT be conflated (§8.2a.1).
 *
 * S1: defines the key set + key order + absence encoding of every sub-structure
 *     (matched_rules / unless_exemptions / canonical_trees / eval_warnings /
 *     temporal_state), so the preimage is byte-deterministic across implementations.
 * S4: `engine_id` is deliberately EXCLUDED from `eval_profile` in this preimage —
 *     it is an implementation identifier and would break cross-implementation
 *     byte-identity; `spec_version` is retained as the schema selector.
 *
 * @license MIT
 */

import { createHash } from 'node:crypto'
import { canonicalize } from 'json-canonicalize'
import { normalizeNfc } from './expr-tree/normalize.js'
import type { EvaluationResult, RuleMatch, EvalProfile } from './rule-definition.js'
import type { EvalWarning } from './expr-tree/eval-warning.js'

/** Versioned domain-separation prefix for the language-layer evaluation-result DO. */
export const EVAL_DO_DOMAIN = 'erdl-eval-do-v3:'

/**
 * Canonicalize a matched rule into its DO sub-structure (S1).
 *
 * Fixed key order (MUST): rule_id → rule_name → decision → priority → ring →
 * instruction → reason → correction → explanation → alternative → corrected_args.
 * Absent optional fields encode as null (key NOT omitted).
 */
function ruleMatchCanonical(m: RuleMatch): Record<string, unknown> {
  return {
    rule_id: m.ruleId,
    rule_name: m.ruleName,
    decision: m.decision,
    priority: m.priority,
    ring: m.ring ?? null,
    instruction: m.instruction ?? null,
    reason: m.reason ?? null,
    correction: m.correction ?? null,
    explanation: normalizeBilingual(m.explanation),
    alternative: normalizeBilingual(m.alternative),
    corrected_args: m.correctedArgs ?? null,
  }
}

/** Normalize a bilingual text field ({ zh, en } | string) to its canonical form. */
function normalizeBilingual(v: string | { zh: string; en: string } | undefined): unknown {
  if (v === undefined) return null
  if (typeof v === 'string') return normalizeNfc(v)
  return {
    zh: normalizeNfc(v.zh),
    en: normalizeNfc(v.en),
  }
}

/**
 * Canonicalize an eval_warning into its DO sub-structure (S1).
 *
 * `code` is a CLOSED enum (the EvalWarningKind); the free-text `message` is
 * deliberately EXCLUDED — it is a diagnostic detail whose wording would break
 * cross-implementation byte-identity. Fixed key order: code → node_type.
 */
function warningCanonical(w: EvalWarning): Record<string, unknown> {
  return {
    code: w.kind,
    node_type: w.nodeType ?? null,
  }
}

/**
 * Canonicalize `eval_profile` (S4): engine_id is EXCLUDED from the preimage.
 * Fixed key order: strict → context → contract_hash → spec_version.
 */
function evalProfileCanonical(p: EvalProfile | undefined): Record<string, unknown> | null {
  if (!p) return null
  return {
    strict: p.strict,
    context: p.context,
    contract_hash: p.contract_hash ?? null,
    spec_version: p.spec_version,
  }
}

/** Recursively NFC-normalize all strings in the input fact object (context). */
function normalizeContextStrings(value: unknown): unknown {
  if (typeof value === 'string') return normalizeNfc(value)
  if (Array.isArray(value)) return value.map(normalizeContextStrings)
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeContextStrings(v)
    }
    return out
  }
  return value
}

/**
 * Serialize the language-layer evaluation-result DO preimage (SPEC §8.2a.1).
 *
 * Field order (MUST, fixed):
 * context → decision → matched_rules → unless_exemptions → primary_instruction
 * → primary_reason → primary_explanation → primary_correction → total_evaluated
 * → total_matched → temporal_state → state_snapshot → canonical_trees
 * → rule_set_hash → eval_profile → eval_warnings → errored → as_of
 *
 * Absence encoding (§8.2a.1): list fields encode [] when empty; object-nullable
 * fields encode null (key NOT omitted). `errored` is always boolean (false when
 * not errored).
 */
export function evaluationObjectPreimage(
  context: Record<string, unknown>,
  result: EvaluationResult,
): Record<string, unknown> {
  return {
    context: normalizeContextStrings(context),
    decision: result.decision,
    matched_rules: result.matchedRules.map(ruleMatchCanonical),
    unless_exemptions: (result.unlessExemptions ?? []).map(ruleMatchCanonical),
    primary_instruction: result.primaryInstruction ?? null,
    primary_reason: result.primaryReason ?? null,
    primary_explanation: normalizeBilingual(result.primaryExplanation),
    primary_correction: result.primaryCorrection ?? null,
    total_evaluated: result.totalEvaluated,
    total_matched: result.totalMatched,
    temporal_state: result.temporalState ?? null,
    state_snapshot: result.stateSnapshot ?? null,
    canonical_trees: (result.canonicalTrees ?? []).map((t) => ({
      rule_id: t.ruleId,
      tree: t.tree,
      hash: t.hash,
    })),
    rule_set_hash: result.ruleSetHash ?? null,
    eval_profile: evalProfileCanonical(result.evalProfile),
    eval_warnings: (result.evalWarnings ?? []).map(warningCanonical),
    errored: result.errored ?? false,
    as_of: result.asOf ?? null,
  }
}

/**
 * Hash the language-layer evaluation-result DO (SPEC §8.2a.1).
 * Returns a `sha256:`-prefixed hex string.
 */
export function evaluationObjectHash(
  context: Record<string, unknown>,
  result: EvaluationResult,
): string {
  const preimage = evaluationObjectPreimage(context, result)
  const canonical = canonicalize(preimage as Record<string, unknown>)
  return 'sha256:' + createHash('sha256').update(EVAL_DO_DOMAIN + canonical).digest('hex')
}
