// ERDL - Entity-Rule Definition Language
// Public API entry point

// -- Core types and decision/operator enums ---------------------
export * from './rule-definition.js'
export * from './erdl-schema.js'
// Disambiguation: the three names below are exported by both modules;
// erdl-schema (the single source of truth for these constants) takes precedence.
export { type Decision, type ConditionOperator, type RuleCategory } from './erdl-schema.js'

// -- Top-level evaluation engine -------------------------------------
export * from './evaluator.js'

// -- Document loader (YAML -> RuleDefinition[]) -----------------------
export * from './erdl-loader.js'

// -- Expression tree kernel (34 node kinds) ------------------------
export * from './expr-tree/node-types.js'
export * from './expr-tree/simple-compiler.js'
export * from './expr-tree/rule-to-expr.js'
export * from './expr-tree/canonical.js'
export * from './expr-tree/s-expression.js'
export * from './expr-tree/evaluator.js'
export * from './expr-tree/gloss.js'
export * from './expr-tree/fixed-point.js'
export * from './expr-tree/limits.js'
export * from './expr-tree/normalize.js'
export * from './expr-tree/decision-table.js'
export * from './expr-tree/eval-trace.js'
export * from './expr-tree/eval-warning.js'
export * from './expr-tree/grade.js'

// -- Rule validation / serialization / templates -----------------------
export { ruleValidator, RuleValidator, type ValidationError, type ValidationResult } from './rule-validator.js'
export { RuleYamlSerializer } from './rule-yaml-serializer.js'
export {
  templateEngine,
  TEMPLATES,
  TemplateEngine,
  type TemplateId,
  type TemplateDef,
  type TemplateInput,
  type TemplateOutput,
} from './template-engine.js'
export * from './rule-quality-gate.js'

// -- Function delegation / state / operator semantics / field contracts / safe regex / time --
export * from './fn-registry.js'
export * from './guard-state-manager.js'
export * from './op-sem-registry.js'
export * from './field-contracts.js'
export * from './safe-regex.js'
export * from './date-utils.js'
export * from './clock.js'
