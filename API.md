# ERDL™ API Reference

This document describes the public API of the ERDL reference implementation
(`@erdl-lang/erdl`). It is the implementation's interface — the language itself
is defined by the specification ([erdl-spec.md](./erdl-spec.md) /
[erdl-spec.en.md](./erdl-spec.en.md)), which is the single source of truth for
format and semantics.

## Install

```bash
npm install @erdl-lang/erdl
```

## Core Types

```ts
type Decision =
  | 'ALLOW' | 'DENY' | 'CORRECT' | 'NOTIFY'
  | 'EMERGENCY_HALT' | 'ROLLBACK' | 'QUARANTINE'
  | 'REQUEST_HUMAN' | 'ESCALATE' | 'DELEGATE' | 'DEFER'
  | 'WORKFLOW' | 'GUIDE'
  | 'WORKFLOW_WAITING' | 'WORKFLOW_PROGRESS'  // WORKFLOW substates

type OverrideLevel = 'critical' | 'high' | 'normal' | 'low'
type RingLevel = 0 | 1 | 2 | 3
type RuleCategory =
  | 'coding' | 'engineering' | 'security' | 'writing' | 'design'
  | 'performance' | 'testing' | 'compliance' | 'accessibility'
  | 'observability' | 'custom'

type ConditionOperator =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'not_in'
  | 'contains' | 'not_contains' | 'match' | 'starts_with' | 'ends_with'
  | 'not_starts_with' | 'not_ends_with'
  | 'exists' | 'not_exists'
  | 'length_gt' | 'length_gte' | 'length_lt' | 'length_lte' | 'length_eq'
  | 'between' | 'not_between'
  | 'count_gt' | 'count_gte' | 'count_lt' | 'count_lte'
```

## Document Loading

```ts
interface ErdlMetadata {
  name: string
  description?: string
  category?: RuleCategory
  /** Fallback decision when no rule matches. */
  decision?: Decision
  tags?: string[]
}

interface ErdlDocument {
  protocol: string          // "erdl/v2"
  version: string
  metadata: ErdlMetadata
  rules: RuleDefinition[]
}

function parseErdlDocument(yamlText: string): ErdlDocument
function loadErdlFile(filePath: string): ErdlDocument
```

- `parseErdlDocument` parses an ERDL YAML string into `RuleDefinition[]`.
  Throws on an unsupported protocol, a missing `version`, or a rule missing
  `name`/`then`. The §5.4 decision-table form is not yet supported (throws).
- `loadErdlFile` reads a file and delegates to `parseErdlDocument`.

```ts
import { loadErdlFile } from '@erdl-lang/erdl'
const { rules, metadata } = loadErdlFile('refund.erdl.yaml')
```

## Evaluation

```ts
interface RuleDefinition {
  id: string
  name: string
  description: string
  category: RuleCategory
  conditions: RuleCondition[]
  conditionLogic?: 'AND' | 'OR'
  action: RuleAction
  priority: number
  enabled: boolean
  override?: OverrideLevel
  version?: number
  legal_basis?: string | null
  source_text?: string | null
  unless?: { logic?: 'AND' | 'OR'; conditions: RuleCondition[] }
  workflow?: WorkflowDefinition
  scopeLevel?: 1 | 2 | 3 | 4 | 5
  hitCount?: number
}

interface RuleCondition {
  field?: string
  operator?: ConditionOperator
  value?: unknown
  within?: string
  rate?: string
  pattern?: string
  keywords?: string[]
  expr?: unknown
}

interface RuleAction {
  decision: Decision
  instruction?: string
  reason?: string
  explanation?: string | { zh: string; en: string }
  alternative?: string | { zh: string; en: string }
  ring?: RingLevel
  correction?: string
}

interface RuleMatch {
  ruleId: string
  ruleName: string
  decision: Decision
  instruction?: string
  reason?: string
  ring?: RingLevel
  correction?: string
  priority: number
}

interface EvaluationResult {
  decision: Decision
  matchedRules: RuleMatch[]
  unlessExemptions?: RuleMatch[]
  primaryInstruction?: string
  primaryReason?: string
  primaryExplanation?: string | { zh: string; en: string }
  primaryAlternative?: string | { zh: string; en: string }
  primaryCorrection?: string
  totalEvaluated: number
  totalMatched: number
  temporalState?: TemporalStateEntry[]
}

class Evaluator {
  evaluate(rules: RuleDefinition[], context: Record<string, unknown>): EvaluationResult
}
```

```ts
import { loadErdlFile, Evaluator } from '@erdl-lang/erdl'

const { rules, metadata } = loadErdlFile('refund.erdl.yaml')
const result = new Evaluator().evaluate(rules, {
  tool: { name: 'issue_refund', args: { amount: 8000 } },
  'metadata.decision': metadata.decision,
})
console.log(result.decision) // 'REQUEST_HUMAN'
```

## Readability (gloss)

```ts
type GlossLang = 'zh' | 'en'
type FieldNameMap = Record<string, string>

function renderNode(node: ExprNode, lang: GlossLang, fieldNames?: FieldNameMap): string
function renderGloss(root: ExprNode, decision: string, lang?: GlossLang, fieldNames?: FieldNameMap): string
function renderDecisionTableGloss(table: object, lang?: GlossLang, fieldNames?: FieldNameMap): string
```

gloss is the deterministic natural-language projection of an expression tree
(spec §5.5). `renderGloss` renders the full "when ... then ..." sentence.

## Expression-Tree Compilation

```ts
function jsonWhenToExpr(when: Record<string, unknown>): ExprNode | null
function ruleWhenToExpr(rule: RuleDefinition): ExprNode | null
function normalizeOperator(op: string | undefined): string | null
```

`jsonWhenToExpr` compiles a `when` object (Simple / Expression / decision-table
shape) into the 34-node expression tree (spec §5.3).

## Validation

```ts
interface ValidationError {
  field: string
  code: string
  message: string
  level?: 'error' | 'warning' | 'info'
}
interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}
class RuleValidator {
  validate(input: TemplateInput): ValidationResult
}
const ruleValidator: RuleValidator
```

## Serialization

```ts
class RuleYamlSerializer {
  constructor(rulesDir: string)
  toSpec5Yaml(rule: object): string          // -> Sec. 2.1 YAML string
  toSpec5Document(rule: object): object      // -> structured document
  writeRuleFile(rule: object): string        // -> writes <category>/<name>.erdl.yaml
  removeRuleFile(name: string, category: string): void
  syncAll(rules: object[]): number
}
```

## Templates

```ts
type TemplateId = 'toolInList' | 'toolInAndMatch' | 'toolEqAndCmd' | 'toolEq'
  | 'fieldCompare' | 'fieldInList' | 'fieldInAndCompare' | /* ... */ string

class TemplateEngine {
  getTemplates(): TemplateDef[]
  getTemplate(id: TemplateId): TemplateDef | undefined
  generate(input: TemplateInput): TemplateOutput
}
const templateEngine: TemplateEngine
const TEMPLATES: TemplateDef[]
```

The template engine produces deterministic §2.1 YAML from typed parameters.

## Operator Constants

```ts
const CONDITION_OPERATORS: readonly ConditionOperator[]  // the 28 condition operators
const CONDITION_MODIFIERS: readonly ['within', 'rate']   // the 2 modifiers
const ALL_OPERATORS: readonly string[]                    // 28 + 2 = 30
const OP_COMPARE / OP_LIST / OP_STRING / OP_LENGTH / OP_RANGE / OP_COUNT / ...
```

---

The expression-tree node types (the 34-node kernel: `ExprNode`, `CompareNode`,
`ArithNode`, `QuantifierNode`, ...) are re-exported from the `@erdl-lang/erdl`
root (via `index.ts`); there is no subpath export such as
`@erdl-lang/erdl/expr-tree`.
