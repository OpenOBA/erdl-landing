/**
 * ERDL - Document Loader (YAML -> RuleDefinition[]).
 *
 * Parses an `*.erdl.yaml` document (Sec. 2.1 top-level format) and maps it to
 * `RuleDefinition[]` objects ready for evaluation. This is the missing forward
 * half of the parse/evaluate pipeline: `RuleYamlSerializer` emits YAML, this
 * loader reads it back.
 *
 * Supported `when` forms:
 *   - Simple:        `{ logic: "AND"|"OR", conditions: [...] }`
 *   - Expression:    `{ expr: {...} }`  (S-expression JSON shape)
 *   - Catch-all:     `"true"` (empty conditions)
 *   - Decision table: NOT yet supported (throws).
 *
 * @license MIT
 */

import * as fs from 'node:fs'
import * as yaml from 'yaml'
import { ruleQualityGate } from './rule-quality-gate.js'
import { compileDecisionTable } from './expr-tree/decision-table.js'
import { toSExpr } from './expr-tree/s-expression.js'
import { ruleToExpr } from './expr-tree/rule-to-expr.js'
import { renderGloss } from './expr-tree/gloss.js'
import type { ExprNode } from './expr-tree/node-types.js'
import type {
  Decision,
  OverrideLevel,
  RingLevel,
  RuleCategory,
  RuleCondition,
  RuleDefinition,
  RuleTier,
} from './rule-definition.js'

/** Document-level metadata (Sec. 2.2). */
export interface ErdlMetadata {
  name: string
  description?: string
  category?: RuleCategory
  /** Fallback decision used when no rule matches. */
  decision?: Decision
  tags?: string[]
}

/** A parsed ERDL document (Sec. 2.1 top-level structure). */
export interface ErdlDocument {
  protocol: string
  version: string
  metadata: ErdlMetadata
  rules: RuleDefinition[]
}

// ============================================
// Raw YAML shapes (pre-mapping)
// ============================================

interface RawCondition {
  field?: string
  operator?: string
  value?: unknown
  within?: string
  rate?: string
  pattern?: string
  keywords?: string[]
  expr?: unknown
}

interface RawWhen {
  logic?: string
  conditions?: RawCondition[]
  expr?: unknown
  kind?: string
  columns?: Array<{ field: string; label?: string }>
  rows?: Array<{ when?: Array<[string, unknown]>; then: string; priority?: number }>
}

interface RawRule {
  name: string
  description?: string
  category?: string
  priority?: number
  override?: string
  ring?: number
  tier?: number
  when?: RawWhen | string
  then: string
  message?: string
  instruction?: string
  /** Correction target text (CORRECT decision, §4.1) */
  correction?: string
  unless?: RawWhen | string | null
  explanation?: string | { zh: string; en: string }
  alternative?: string | { zh: string; en: string }
  legal_basis?: string
  source_text?: string
  enabled?: boolean
}

interface RawDocument {
  protocol?: string
  version?: string
  metadata?: {
    name?: string
    description?: string
    category?: string
    decision?: string
    tags?: unknown[]
  }
  rules?: RawRule[]
}

// ============================================
// Mapping helpers
// ============================================

/** Derive a machine-friendly rule id from its name (e.g. "SEC-001-refund-limit" -> "sec_001_refund_limit"). */
function deriveId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
}

function mapCondition(c: RawCondition): RuleCondition {
  const cond: RuleCondition = {}
  if (c.field !== undefined) cond.field = c.field
  if (c.operator !== undefined) cond.operator = c.operator as RuleCondition['operator']
  if (c.value !== undefined) cond.value = c.value
  if (c.within !== undefined) cond.within = c.within
  if (c.rate !== undefined) cond.rate = c.rate
  if (c.pattern !== undefined) cond.pattern = c.pattern
  if (c.keywords !== undefined) cond.keywords = c.keywords
  if (c.expr !== undefined) cond.expr = c.expr
  return cond
}

interface MappedWhen {
  conditions: RuleCondition[]
  conditionLogic?: 'AND' | 'OR'
}

function mapWhen(when: RawWhen | string | undefined): MappedWhen {
  if (when === undefined || when === null) return { conditions: [] }
  if (typeof when === 'string') {
    // §2.3: only the literal "true" is a valid catch-all; any other string
    // (e.g. "false" or a typo like "ture") MUST be rejected at load time.
    if (when !== 'true') {
      throw new Error(`Invalid when string "${when}": only "true" is allowed (catch-all)`)
    }
    return { conditions: [] }
  }
  if (when.expr !== undefined) {
    // E5: when.expr and when.conditions are mutually exclusive
    if (when.conditions !== undefined) {
      throw new Error('A when clause cannot contain both "expr" and "conditions" (E5)')
    }
    return { conditions: [{ expr: when.expr }] }
  }
  if (Array.isArray(when.conditions)) {
    return {
      conditions: when.conditions.map(mapCondition),
      conditionLogic: when.logic === 'OR' ? 'OR' : 'AND',
    }
  }
  return { conditions: [] }
}

function mapUnless(unless: RawWhen | string | null | undefined): RuleDefinition['unless'] {
  if (unless === undefined || unless === null) return undefined
  if (typeof unless === 'string') return { conditions: [] }
  const mapped = mapWhen(unless)
  return { logic: mapped.conditionLogic, conditions: mapped.conditions }
}

function mapRule(raw: RawRule, defaultCategory: RuleCategory): RuleDefinition[] {
  if (typeof raw.name !== 'string' || raw.name.length === 0) {
    throw new Error('A rule is missing a non-empty "name" field')
  }
  // Decision table: expand one rule per row (SPEC §5.4)
  if (typeof raw.when === 'object' && raw.when !== null && raw.when.kind === 'decision_table') {
    return mapDecisionTableRules(raw, defaultCategory)
  }
  if (typeof raw.then !== 'string' || raw.then.length === 0) {
    throw new Error(`Rule "${raw.name}" is missing a non-empty "then" field`)
  }
  const when = mapWhen(raw.when)
  const category = (raw.category ?? defaultCategory ?? 'custom') as RuleCategory
  return [{
    id: deriveId(raw.name),
    name: raw.name,
    description: raw.description ?? '',
    category,
    conditions: when.conditions,
    conditionLogic: when.conditionLogic,
    rawWhen: typeof raw.when === 'string' ? raw.when : undefined,
    action: {
      decision: raw.then as Decision,
      instruction: raw.instruction,
      reason: raw.message,
      ring: (raw.ring as RingLevel) ?? undefined,
      explanation: raw.explanation,
      alternative: raw.alternative,
      correction: raw.correction,
    },
    priority: raw.priority ?? 100,
    enabled: raw.enabled ?? true,
    override: (raw.override as OverrideLevel) ?? undefined,
    tier: (raw.tier as RuleTier) ?? undefined,
    legal_basis: raw.legal_basis ?? null,
    source_text: raw.source_text ?? null,
    unless: mapUnless(raw.unless),
  }]
}

/** Expand a decision-table rule into one RuleDefinition per row (SPEC §5.4). */
function mapDecisionTableRules(raw: RawRule, defaultCategory: RuleCategory): RuleDefinition[] {
  const dt = raw.when as { columns?: Array<{ field: string; label?: string }>; rows?: Array<{ when?: Array<[string, unknown]>; then: string; priority?: number }> }
  const columns = dt.columns?.map((c) => c.field) ?? []
  const rows = dt.rows ?? []
  const category = (raw.category ?? defaultCategory ?? 'custom') as RuleCategory
  const compiled = compileDecisionTable({
    columns,
    rows: rows.map((r) => ({
      conditions: buildRowConditions(columns, r.when ?? []),
      decision: r.then,
      priority: r.priority,
    })),
  })
  return compiled.map((row, i) => ({
    id: deriveId(`${raw.name}-row-${i + 1}`),
    name: `${raw.name}-row-${i + 1}`,
    description: raw.description ?? '',
    category,
    conditions: [{ expr: toSExpr(row.expr) }],
    conditionLogic: 'AND',
    action: {
      decision: row.decision as Decision,
      reason: raw.message,
      ring: (raw.ring as RingLevel) ?? undefined,
    },
    priority: i + 1,
    enabled: raw.enabled ?? true,
    override: (raw.override as OverrideLevel) ?? undefined,
    legal_basis: raw.legal_basis ?? null,
    source_text: raw.source_text ?? null,
  }))
}

/** Map SPEC §5.4 `when: [[op, value], ...]` tuples to a column-keyed conditions record. */
function buildRowConditions(columns: string[], whenTuples: Array<[string, unknown]>): Record<string, unknown | [string, unknown]> {
  const conditions: Record<string, unknown | [string, unknown]> = {}
  whenTuples.forEach((tuple, i) => {
    const col = columns[i]
    if (col !== undefined && Array.isArray(tuple)) {
      conditions[col] = tuple as [string, unknown]
    }
  })
  return conditions
}

/** Build the expression tree for a rule (canonical single entry in rule-to-expr). */
function ruleTreeForGloss(rule: RuleDefinition): ExprNode | null {
  return ruleToExpr(rule)
}

// ============================================
// Public API
// ============================================

/** Parse an ERDL YAML document string into `RuleDefinition[]`. */
export function parseErdlDocument(yamlText: string): ErdlDocument {
  const raw = yaml.parse(yamlText) as RawDocument | null
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    throw new Error('ERDL document is empty or not a YAML mapping')
  }
  // §2.1: top-level format — only the four known fields are allowed
  const topKeys = Object.keys(raw)
  for (const k of topKeys) {
    if (!['protocol', 'version', 'metadata', 'rules'].includes(k)) {
      throw new Error(`Unknown top-level field "${k}"`)
    }
  }
  if (raw.protocol !== 'erdl/v2') {
    throw new Error(`Unsupported protocol "${String(raw.protocol)}"; expected "erdl/v2"`)
  }
  if (typeof raw.version !== 'string' || raw.version.length === 0) {
    throw new Error('Missing or invalid version field')
  }

  // §2.1/§2.2 MUST fields: metadata.name is required and non-empty; rules MUST be an array
  if (raw.metadata === undefined || raw.metadata === null || typeof raw.metadata.name !== 'string' || raw.metadata.name.length === 0) {
    throw new Error('Missing or empty metadata.name (required field)')
  }
  if (raw.rules !== undefined && !Array.isArray(raw.rules)) {
    throw new Error('rules must be an array')
  }

  const metadata: ErdlMetadata = {
    name: raw.metadata.name,
    description: raw.metadata.description,
    category: (raw.metadata.category as RuleCategory) ?? undefined,
    decision: (raw.metadata.decision as Decision) ?? undefined,
    tags: raw.metadata.tags?.map((t) => String(t)),
  }

  const rules = (raw.rules ?? []).flatMap((r) => mapRule(r, metadata.category ?? 'custom'))

  // N5: rule ids must be unique (a deriveId collision would silently merge rules)
  const seenIds = new Set<string>()
  for (const rule of rules) {
    if (seenIds.has(rule.id)) {
      throw new Error(`Duplicate rule id "${rule.id}" (name collision)`)
    }
    seenIds.add(rule.id)
  }

  // G1/G2/G5: generate the canonical English gloss for each rule (deterministic, from the tree)
  for (const rule of rules) {
    const tree = ruleTreeForGloss(rule)
    if (tree !== null) {
      rule.gloss = renderGloss(tree, rule.action.decision, 'en')
    }
  }

  // §7.4: run the quality gate; error-level violations reject the document
  const report = ruleQualityGate.check(rules)
  if (report.errors > 0) {
    throw new Error(`ERDL document failed quality gate: ${report.errors} error(s)`)
  }

  return { protocol: raw.protocol, version: raw.version, metadata, rules }
}

/** Read an ERDL document from a file path. */
export function loadErdlFile(filePath: string): ErdlDocument {
  return parseErdlDocument(fs.readFileSync(filePath, 'utf-8'))
}
