/**
 * field-contracts - field contracts (structured definitions + utilities).
 *
 * Field contract = field name (English snake_case, enters the kernel/hash) +
 * display_name (human-readable, enters the gloss) + type + meaning.
 *
 * Uses:
 * 1. Generating LLM prompts: constrain the LLM to use only contracted field names (no inventing)
 * 2. Generating the FieldNameMap for gloss rendering: gloss shows the display_name
 *
 * The default batch below is [sample/placeholder data]; replace it with a
 * deterministic source when integrating an industry blueprint.
 *
 * Two categories:
 * - Business field contracts (generic sample batch): DEFAULT_FIELD_CONTRACTS
 * - Agent runtime field contracts (generic, cross-industry): AGENT_RUNTIME_FIELD_CONTRACTS
 *
 * @license MIT
 */

/** Structured definition of a field contract. */
export interface EntityFieldContract {
  field: string
  /** Human-readable display name (enters the gloss). */
  displayName: string
  type: 'number' | 'boolean' | 'string' | 'string[]' | 'date'
  description: string
  /**
   * Default value (parameterized: the value used when the field is absent;
   * aligned with OpenFisca Variable.default_value).
   * Legal parameters (tax rates, thresholds, etc.) may evolve over time; the
   * default value provides the baseline, and the evolution lives in Parameters.
   */
  default_value?: unknown
  /**
   * Definition period (aligned with OpenFisca Variable.definition_period):
   * the period over which the field is computed/evolves.
   * DAY / MONTH / YEAR / ETERNITY (permanent, e.g. date of birth).
   */
  definition_period?: 'DAY' | 'MONTH' | 'YEAR' | 'ETERNITY'
}

/** Structured field contracts -> field -> display_name mapping (the FieldNameMap for renderGloss). */
export function buildFieldNameMap(contracts: EntityFieldContract[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const c of contracts) {
    map[c.field] = c.displayName
  }
  return map
}

/** Structured field contracts -> LLM prompt text (constrains the LLM to only use these fields). */
export function buildEntityContractText(contracts: EntityFieldContract[]): string {
  const lines: string[] = ['## 业务字段契约（只能使用以下字段，禁止臆造字段名）', '']
  for (const c of contracts) {
    lines.push(`- ${c.field}: ${c.type} - ${c.description}`)
  }
  return lines.join('\n')
}

// ===========================================
// Business field contracts (generic sample batch)
// ===========================================

export const DEFAULT_FIELD_CONTRACTS: EntityFieldContract[] = [
  // Generic sample business fields - replace with your own industry field contracts.
  { field: 'amount', displayName: '金额', type: 'number', description: 'Amount involved in the decision (sample field)' },
  { field: 'date', displayName: '日期', type: 'date', description: 'Relevant date for the decision (sample field)' },
  { field: 'category', displayName: '类别', type: 'string', description: 'Category of the subject (sample field)' },
  { field: 'status', displayName: '状态', type: 'string', description: 'Current status of the subject (sample field)' },
  { field: 'is_approved', displayName: '是否通过', type: 'boolean', description: 'Whether the subject has been approved (sample field)' },
]

// ===========================================
// Agent runtime field contracts (generic . cross-industry)
// (fields used by agent behavior rules such as coding/security/compliance)
// ===========================================

export const AGENT_RUNTIME_FIELD_CONTRACTS: EntityFieldContract[] = [
  { field: 'tool.name', displayName: '工具名', type: 'string', description: '被调用的工具名' },
  { field: 'tool.args', displayName: '工具参数', type: 'string', description: '工具的参数字符串' },
  { field: 'tool.args.command', displayName: '命令', type: 'string', description: '工具参数中的命令' },
  { field: 'tool.args.path', displayName: '路径', type: 'string', description: '工具参数中的路径' },
  { field: 'tool.args.file', displayName: '文件', type: 'string', description: '工具参数中的文件' },
  { field: 'content', displayName: '内容', type: 'string', description: '待处理的内容' },
  { field: 'sem.code', displayName: '语义码', type: 'string', description: '语义代码' },
  { field: 'sem.sub_code', displayName: '语义子码', type: 'string', description: '语义子代码' },
  { field: 'context.cost', displayName: '成本', type: 'number', description: '上下文中的成本' },
  { field: 'context.role', displayName: '角色', type: 'string', description: '上下文中的角色' },
  { field: 'user.role', displayName: '用户角色', type: 'string', description: '用户角色' },
]

/** display_name mapping for the agent runtime fields (for gloss rendering of generic rules). */
export const AGENT_RUNTIME_FIELD_NAME_MAP: Record<string, string> = buildFieldNameMap(AGENT_RUNTIME_FIELD_CONTRACTS)
