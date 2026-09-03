/**
 * Rule Template Engine - 12 templates that produce deterministic Sec. 2.1 YAML.
 *
 * Each template is a pure function with strictly-typed parameters.
 * Template functions are the ONLY way to produce Sec. 2.1 YAML from user input.
 * The engine guarantees 100% output correctness through type checking + validation.
 *
 * Design invariant: YAML output is always valid because the template functions
 * construct the object graph; yaml.dump is deterministic given the same input.
 *
 * Context fields: Templates accept any valid Sec. 3 Entity context field name
 * (tool.name, sem.code, sem.sub_code, project.*, task.*, etc.) as the `field` parameter.
 *
 */

import { RuleYamlSerializer, type ExtractedSpec5 } from './rule-yaml-serializer.js'

// ============================================
// Types
// ============================================

export type TemplateId =
  | 'toolInList'          // T1: tool.name in [A, B, C]
  | 'toolInAndMatch'      // T2: tool.name in [...] AND content ~= /pat/
  | 'toolEqAndCmd'        // T3: tool.name = X AND args.command ~= /pat/
  | 'toolEq'              // T4: tool.name = X
  | 'fieldCompare'        // T5: field {=,!=,>,<,>=,<=} value
  | 'fieldInList'         // T6: field in [A, B]
  | 'twoFieldAnd'         // T7: f1 op1 v1 AND f2 op2 v2
  | 'twoFieldOr'          // T8: f1 op1 v1 OR f2 op2 v2
  | 'fieldInAndCompare'   // T9: f1 in [...] AND f2 op v
  | 'fieldExists'         // T10: field EXISTS / NOT EXISTS
  | 'fieldMatch'          // T11: field ~= /pattern/
  | 'fieldContains'       // T12: field contains substring

export type TemplateParamType = 'toolNames' | 'field' | 'operator' | 'value' | 'pattern' | 'list' | 'boolean' | 'decision'

export interface TemplateParam {
  key: string
  label: string
  labelEn: string
  type: TemplateParamType
  required: boolean
  placeholder?: string
  description?: string
}

export interface TemplateDef {
  id: TemplateId
  name: string
  nameEn: string
  description: string
  descriptionEn: string
  icon: string
  params: TemplateParam[]
  /** Human-language example sentence */
  sentence: string
  sentenceEn: string
}

export type OperatorComparison = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
export type OperatorSet = 'in' | 'not_in'
export type OperatorText = 'contains' | 'not_contains'
export type OperatorMatch = 'match'
export type OperatorExist = 'exists' | 'not_exists'
export type AllOperators = OperatorComparison | OperatorSet | OperatorText | OperatorMatch | OperatorExist

export type Decision = 'ALLOW' | 'DENY' | 'CORRECT' | 'REQUEST_HUMAN' | 'EMERGENCY_HALT'

export interface TemplateInput {
  templateId: TemplateId
  ruleName: string
  decision: Decision
  message: string
  priority: number
  category: string
  /** Template-specific parameters */
  params: Record<string, unknown>
  /** Optional bilingual explanation */
  explanation?: string | { zh: string; en: string }
  /** Optional alternative suggestion */
  alternative?: string | { zh: string; en: string }
}

export interface TemplateOutput {
  yaml: string
  ruleObject: Record<string, unknown>
  success: boolean
  error?: string
}

// ============================================
// Template Registry
// ============================================

// Previously only 13 labels, so the UI dropdown could only pick 13 of the 28 core operators.
// Now covers all 28 condition operators + 2 modifiers; erdl-schema asserts every operator has a label.
import { CONDITION_OPERATORS, CONDITION_MODIFIERS, OP_COMPARE, OP_VALUE_SCALAR } from './erdl-schema.js'

const COMPARISON_OP_LABELS: Record<string, { zh: string; en: string }> = {
  // comparison 6
  'eq': { zh: '等于 (=)', en: 'equals (=)' },
  'ne': { zh: '不等于 (!=)', en: 'not equals (!=)' },
  'gt': { zh: '大于 (>)', en: 'greater than (>)' },
  'gte': { zh: '大于等于 (>=)', en: 'greater than or equal (>=)' },
  'lt': { zh: '小于 (<)', en: 'less than (<)' },
  'lte': { zh: '小于等于 (<=)', en: 'less than or equal (<=)' },
  'in': { zh: '在列表中 (in)', en: 'in list (in)' },
  'not_in': { zh: '不在列表中 (not in)', en: 'not in list (not in)' },
  'contains': { zh: '包含', en: 'contains' },
  'not_contains': { zh: '不包含', en: 'not contains' },
  'match': { zh: '匹配正则', en: 'matches regex' },
  'exists': { zh: '存在', en: 'exists' },
  'not_exists': { zh: '不存在', en: 'not exists' },
  // boundary negation 2
  'starts_with': { zh: '以...开头', en: 'starts with' },
  'ends_with': { zh: '以...结尾', en: 'ends with' },
  'not_starts_with': { zh: '不以...开头', en: 'not starts with' },
  'not_ends_with': { zh: '不以...结尾', en: 'not ends with' },
  // length 5 (Unicode code-point count)
  'length_gt': { zh: '长度大于', en: 'length >' },
  'length_gte': { zh: '长度大于等于', en: 'length >=' },
  'length_lt': { zh: '长度小于', en: 'length <' },
  'length_lte': { zh: '长度小于等于', en: 'length <=' },
  'length_eq': { zh: '长度等于', en: 'length =' },
  // range 2 (closed interval, numeric only)
  'between': { zh: '在区间内 [min,max]', en: 'between [min,max]' },
  'not_between': { zh: '不在区间内', en: 'not between' },
  // count 4 (array element count)
  'count_gt': { zh: '元素数大于', en: 'count >' },
  'count_gte': { zh: '元素数大于等于', en: 'count >=' },
  'count_lt': { zh: '元素数小于', en: 'count <' },
  'count_lte': { zh: '元素数小于等于', en: 'count <=' },
  // modifiers 2 (stateful operators, written in the condition's within/rate fields, not as operator values)
  'within': { zh: '时间窗口内去重（修饰符）', en: 'within window (modifier)' },
  'rate': { zh: '速率限制（修饰符）', en: 'rate limit (modifier)' },
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'toolInList',
    name: '工具名在列表中',
    nameEn: 'Tool name in list',
    icon: '',
    description: '当 Agent 调用的工具名在指定列表时触发',
    descriptionEn: 'Fires when the tool name is in a specified list',
    sentence: '当(when) Agent 调用的工具 在 [列表] 中 -> 应当(then) [执行动作]',
    sentenceEn: 'when tool name in [list] -> then [action]',
    params: [
      { key: 'toolNames', label: '工具名称', labelEn: 'Tool Names', type: 'toolNames', required: true, placeholder: '选择工具...', description: '选择要拦截/放行的工具名' },
    ],
  },
  {
    id: 'toolInAndMatch',
    name: '工具名在列表中 + 内容匹配',
    nameEn: 'Tool in list + content match',
    icon: '',
    description: '当工具名在列表中 且 内容匹配正则时触发',
    descriptionEn: 'Fires when tool name is in list AND content matches pattern',
    sentence: '当(when) 工具 在 [列表] 中 且 内容 匹配 /正则/ -> 应当(then) [执行动作]',
    sentenceEn: 'when tool in [list] AND content ~= /pattern/ -> then [action]',
    params: [
      { key: 'toolNames', label: '工具名称', labelEn: 'Tool Names', type: 'toolNames', required: true },
      { key: 'matchPattern', label: '匹配正则', labelEn: 'Match Pattern', type: 'pattern', required: true, placeholder: '例如: \\bany\\b 或 eval\\(', description: '正则表达式，用于匹配工具参数内容' },
    ],
  },
  {
    id: 'toolEqAndCmd',
    name: '工具名等于 + 命令匹配',
    nameEn: 'Tool equals + command match',
    icon: '',
    description: '当具体的工具 且 命令参数匹配正则时触发',
    descriptionEn: 'Fires when a specific tool AND its command args match',
    sentence: '当(when) 工具 = [名称] 且 命令 匹配 /正则/ -> 应当(then) [执行动作]',
    sentenceEn: 'when tool = [name] AND command ~= /pattern/ -> then [action]',
    params: [
      { key: 'toolName', label: '工具名称', labelEn: 'Tool Name', type: 'field', required: true, placeholder: '例如: exec' },
      { key: 'matchPattern', label: '命令正则', labelEn: 'Command Pattern', type: 'pattern', required: true, placeholder: '例如: git stash' },
    ],
  },
  {
    id: 'toolEq',
    name: '工具名等于',
    nameEn: 'Tool name equals',
    icon: '',
    description: '当 Agent 调用指定的工具时触发',
    descriptionEn: 'Fires when the tool name equals a specific value',
    sentence: '当(when) 工具 = [名称] -> 应当(then) [执行动作]',
    sentenceEn: 'when tool = [name] -> then [action]',
    params: [
      { key: 'toolName', label: '工具名称', labelEn: 'Tool Name', type: 'field', required: true, placeholder: '例如: exec' },
    ],
  },
  {
    id: 'fieldCompare',
    name: '字段比较',
    nameEn: 'Field comparison',
    icon: '',
    description: '当指定字段的值满足比较条件时触发',
    descriptionEn: 'Fires when a field value satisfies comparison',
    sentence: '当(when) [字段] [比较符] [值] -> 应当(then) [执行动作]',
    sentenceEn: 'when [field] [operator] [value] -> then [action]',
    params: [
      { key: 'field', label: '字段名', labelEn: 'Field', type: 'field', required: true, placeholder: '例如: amount 或 sem.code', description: 'Sec. 3 Entity 上下文字段。例如: tool.name, sem.code, amount' },
      { key: 'operator', label: '比较符', labelEn: 'Operator', type: 'operator', required: true },
      { key: 'value', label: '值', labelEn: 'Value', type: 'value', required: true, placeholder: '例如: 100' },
    ],
  },
  {
    id: 'fieldInList',
    name: '字段在列表中',
    nameEn: 'Field in list',
    icon: '',
    description: '当字段值在指定列表中时触发',
    descriptionEn: 'Fires when a field value is in a list',
    sentence: '当(when) [字段] in [列表] -> 应当(then) [执行动作]',
    sentenceEn: 'when [field] in [list] -> then [action]',
    params: [
      { key: 'field', label: '字段名', labelEn: 'Field', type: 'field', required: true, placeholder: '例如: status 或 sem.code', description: 'Sec. 3 Entity 上下文字段' },
      { key: 'values', label: '值列表', labelEn: 'Values', type: 'list', required: true, placeholder: '一行一个值...', description: '每行一个值' },
    ],
  },
  {
    id: 'twoFieldAnd',
    name: '两个字段组合 (AND)',
    nameEn: 'Two fields combined (AND)',
    icon: '',
    description: '当两个字段都满足各自的条件时触发',
    descriptionEn: 'Fires when BOTH fields satisfy their conditions',
    sentence: '当(when) [字段1] [比较符1] [值1] 且 [字段2] [比较符2] [值2] -> 应当(then) [执行动作]',
    sentenceEn: 'when [field1] [op1] [val1] AND [field2] [op2] [val2] -> then [action]',
    params: [
      { key: 'field1', label: '字段 1', labelEn: 'Field 1', type: 'field', required: true, description: 'Sec. 3 Entity field' },
      { key: 'operator1', label: '比较符 1', labelEn: 'Operator 1', type: 'operator', required: true },
      { key: 'value1', label: '值 1', labelEn: 'Value 1', type: 'value', required: true },
      { key: 'field2', label: '字段 2', labelEn: 'Field 2', type: 'field', required: true, description: 'Sec. 3 Entity field' },
      { key: 'operator2', label: '比较符 2', labelEn: 'Operator 2', type: 'operator', required: true },
      { key: 'value2', label: '值 2', labelEn: 'Value 2', type: 'value', required: true },
    ],
  },
  {
    id: 'twoFieldOr',
    name: '两个字段组合 (OR)',
    nameEn: 'Two fields combined (OR)',
    icon: '',
    description: '当两个字段中任意一个满足条件时触发',
    descriptionEn: 'Fires when EITHER field satisfies its condition',
    sentence: '当(when) [字段1] [比较符1] [值1] 或 [字段2] [比较符2] [值2] -> 应当(then) [执行动作]',
    sentenceEn: 'when [field1] [op1] [val1] OR [field2] [op2] [val2] -> then [action]',
    params: [
      { key: 'field1', label: '字段 1', labelEn: 'Field 1', type: 'field', required: true, description: 'Sec. 3 Entity field' },
      { key: 'operator1', label: '比较符 1', labelEn: 'Operator 1', type: 'operator', required: true },
      { key: 'value1', label: '值 1', labelEn: 'Value 1', type: 'value', required: true },
      { key: 'field2', label: '字段 2', labelEn: 'Field 2', type: 'field', required: true, description: 'Sec. 3 Entity field' },
      { key: 'operator2', label: '比较符 2', labelEn: 'Operator 2', type: 'operator', required: true },
      { key: 'value2', label: '值 2', labelEn: 'Value 2', type: 'value', required: true },
    ],
  },
  {
    id: 'fieldInAndCompare',
    name: '字段在列表中 + 比较',
    nameEn: 'Field in list + comparison',
    icon: '',
    description: '当字段值在列表中 且 另一个字段满足比较条件时触发',
    descriptionEn: 'Fires when one field is in a list AND another satisfies comparison',
    sentence: '当(when) [字段1] in [列表] 且 [字段2] [比较符] [值] -> 应当(then) [执行动作]',
    sentenceEn: 'when [field1] in [list] AND [field2] [op] [val] -> then [action]',
    params: [
      { key: 'field1', label: '列表字段', labelEn: 'List Field', type: 'field', required: true, description: 'Sec. 3 Entity field' },
      { key: 'values', label: '值列表', labelEn: 'Values', type: 'list', required: true },
      { key: 'field2', label: '比较字段', labelEn: 'Compare Field', type: 'field', required: true, description: 'Sec. 3 Entity field' },
      { key: 'operator', label: '比较符', labelEn: 'Operator', type: 'operator', required: true },
      { key: 'value', label: '值', labelEn: 'Value', type: 'value', required: true },
    ],
  },
  {
    id: 'fieldExists',
    name: '字段是否存在',
    nameEn: 'Field exists',
    icon: '',
    description: '当字段存在（或不存在）时触发',
    descriptionEn: 'Fires when a field exists (or does not exist)',
    sentence: '当(when) [字段] 存在/不存在 时 -> 应当(then) [执行动作]',
    sentenceEn: 'when [field] exists / not exists -> then [action]',
    params: [
      { key: 'field', label: '字段名', labelEn: 'Field', type: 'field', required: true, placeholder: '例如: approval_id' },
      { key: 'exists', label: '存在/不存在', labelEn: 'Exists?', type: 'boolean', required: true },
    ],
  },
  {
    id: 'fieldMatch',
    name: '字段匹配正则',
    nameEn: 'Field matches regex',
    icon: '',
    description: '当字段值匹配正则表达式时触发',
    descriptionEn: 'Fires when field value matches a regex pattern',
    sentence: '当(when) [字段] 匹配 /正则/ -> 应当(then) [执行动作]',
    sentenceEn: 'when [field] ~= /pattern/ -> then [action]',
    params: [
      { key: 'field', label: '字段名', labelEn: 'Field', type: 'field', required: true, placeholder: '例如: code' },
      { key: 'pattern', label: '正则', labelEn: 'Pattern', type: 'pattern', required: true, placeholder: '^[A-Z]{2}-\\d{4}$' },
    ],
  },
  {
    id: 'fieldContains',
    name: '字段包含子串',
    nameEn: 'Field contains substring',
    icon: '',
    description: '当字段值包含指定子串时触发',
    descriptionEn: 'Fires when a field value contains a substring',
    sentence: '当(when) [字段] 包含 [子串] -> 应当(then) [执行动作]',
    sentenceEn: 'when [field] contains [substring] -> then [action]',
    params: [
      { key: 'field', label: '字段名', labelEn: 'Field', type: 'field', required: true, placeholder: '例如: title' },
      { key: 'value', label: '子串', labelEn: 'Substring', type: 'value', required: true, placeholder: '例如: 紧急' },
    ],
  },
]

// ============================================
// Template Engine
// ============================================

export class TemplateEngine {
  /** Get all template definitions (for building the UI) */
  getTemplates(): TemplateDef[] {
    return TEMPLATES
  }

  /** Get a specific template by ID */
  getTemplate(id: TemplateId): TemplateDef | undefined {
    return TEMPLATES.find((t) => t.id === id)
  }

  /**
   * Operator labels (data source for the UI operator dropdown).
   *
   * This method previously returned COMPARISON_OP_LABELS as-is (30 keys including within/rate),
   * causing the UI to offer "modifiers" as operators while the validator's VALID_ALL_OPS only allows 28 condition operators,
   * -> any selection would be rejected. It now exposes only the 28 condition operators, strictly matching the validator's allowed set.
   */
  getOperatorLabels(): Record<string, { zh: string; en: string }> {
    const out: Record<string, { zh: string; en: string }> = {}
    for (const op of CONDITION_OPERATORS) {
      const l = COMPARISON_OP_LABELS[op]
      if (l) out[op] = l
    }
    return out
  }

  /**
   * Each template's **operator allowed set**.
   *
   * Background: the UI rendered the full operator dropdown for all templates, but the validator for fieldCompare /
   * fieldInAndCompare only allows 6 comparison operators -> selecting the rest was rejected; twoFieldAnd/Or allows 28,
   * but its value is scalar input, so selecting in/between fails at compile time.
   * Therefore allowed set = validator's allowed set intersect operators expressible by the template's value form.
   */
  getTemplateOperatorDomains(): Record<string, readonly string[]> {
    return {
      // validator: checkComparisonOp -> only 6 comparison operators
      fieldCompare: OP_COMPARE,
      fieldInAndCompare: OP_COMPARE,
      // validator: checkAllOp -> full 28; but template value is scalar -> take the scalar-form subset
      twoFieldAnd: OP_VALUE_SCALAR,
      twoFieldOr: OP_VALUE_SCALAR,
    }
  }

  /**
   * Modifier labels (within/rate). These are **not operator values** but independent condition fields;
   * the UI should use this table at the condition's within/rate field position, not mix them into the operator dropdown.
   */
  getModifierLabels(): Record<string, { zh: string; en: string }> {
    const out: Record<string, { zh: string; en: string }> = {}
    for (const m of CONDITION_MODIFIERS) {
      const l = COMPARISON_OP_LABELS[m]
      if (l) out[m] = l
    }
    return out
  }

  /**
   * Generate Sec. 2.1 YAML from template parameters.
   *
   * Uses RuleYamlSerializer for deterministic Sec. 2.1 F1-F8 output
   * (template assembly, not yaml.dump).
   */
  generate(input: TemplateInput): TemplateOutput {
    const tpl = this.getTemplate(input.templateId)
    if (!tpl) {
      return { yaml: '', ruleObject: {}, success: false, error: `Unknown template: ${input.templateId}` }
    }

    try {
      const data = this.buildSpec5(input)

      // Use RuleYamlSerializer for deterministic Sec. 2.1 F1-F8 output
      const serializer = new RuleYamlSerializer('.') // dir unused by serializeSpec5
      const yamlStr = serializer.serializeSpec5(data)

      return { yaml: yamlStr, ruleObject: data as unknown as Record<string, unknown>, success: true }
    } catch (err) {
      return {
        yaml: '', ruleObject: {}, success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  // ============================================
  // Private: Build Sec. 2.1 data structure (delegates YAML to RuleYamlSerializer)
  // ============================================

  private buildSpec5(input: TemplateInput): ExtractedSpec5 {
    const conditions = this.buildConditions(input.templateId, input.params)

    const rule: Record<string, unknown> = {
      name: input.ruleName,
      description: `Rule generated from template: ${input.templateId}`,
      priority: input.priority,
      ring: this.ringForPriority(input.priority),
      when: conditions.length === 0 ? 'true' : {
        logic: this.isOrTemplate(input.templateId) ? 'OR' : 'AND',
        conditions,
      },
      then: input.decision,
      message: input.message,
    }

    // Computed override from priority (Ring 0 = critical, Ring 1 = high)
    if (input.priority <= 2) rule.override = 'critical'
    else if (input.priority <= 5) rule.override = 'high'

    if (input.explanation) rule.explanation = input.explanation
    if (input.alternative) rule.alternative = input.alternative

    return {
      protocol: 'erdl/v2',
      version: '2.1.0',
      metadata: {
        name: input.ruleName,
        description: `Rule generated from template: ${input.templateId}`,
        category: input.category,
        decision: input.decision,
        tags: [input.category],
      },
      rules: [rule],
    }
  }

  private ringForPriority(priority: number): number {
    if (priority <= 2) return 0
    if (priority <= 5) return 1
    if (priority <= 20) return 2
    return 3
  }

  private isOrTemplate(id: TemplateId): boolean {
    return id === 'twoFieldOr'
  }

  private buildConditions(
    id: TemplateId,
    params: Record<string, unknown>,
  ): Array<Record<string, unknown>> {
    const p = params

    switch (id) {
      case 'toolInList':
        return [{ field: 'tool.name', operator: 'in', value: p.toolNames }]

      case 'toolInAndMatch':
        return [
          { field: 'tool.name', operator: 'in', value: p.toolNames },
          { field: 'tool.args', operator: 'match', value: p.matchPattern },
        ]

      case 'toolEqAndCmd':
        return [
          { field: 'tool.name', operator: 'eq', value: p.toolName },
          { field: 'tool.args.command', operator: 'match', value: p.matchPattern },
        ]

      case 'toolEq':
        return [{ field: 'tool.name', operator: 'eq', value: p.toolName }]

      case 'fieldCompare':
        return [{ field: p.field, operator: p.operator, value: p.value }]

      case 'fieldInList':
        return [{ field: p.field, operator: 'in', value: p.values }]

      case 'twoFieldAnd':
        return [
          { field: p.field1, operator: p.operator1, value: p.value1 },
          { field: p.field2, operator: p.operator2, value: p.value2 },
        ]

      case 'twoFieldOr':
        return [
          { field: p.field1, operator: p.operator1, value: p.value1 },
          { field: p.field2, operator: p.operator2, value: p.value2 },
        ]

      case 'fieldInAndCompare':
        return [
          { field: p.field1, operator: 'in', value: p.values },
          { field: p.field2, operator: p.operator, value: p.value },
        ]

      case 'fieldExists':
        return [{ field: p.field, operator: p.exists ? 'exists' : 'not_exists' }]

      case 'fieldMatch':
        return [{ field: p.field, operator: 'match', value: p.pattern }]

      case 'fieldContains':
        return [{ field: p.field, operator: 'contains', value: p.value }]

      default:
        return []
    }
  }
}

/** Singleton */
export const templateEngine = new TemplateEngine()
