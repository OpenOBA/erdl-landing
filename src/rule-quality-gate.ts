/**
 * Rule Quality Gate - Sec. 7.4 quality gates
 *
 * Aggregates all validation checks and produces a quality report
 * when rules are loaded.
 *
 * This is the entry point for rule quality enforcement.
 */

import { ruleValidator } from './rule-validator.js'
import type { ValidationError } from './rule-validator.js'
import type { RuleDefinition } from './rule-definition.js'

const logQg = console

export interface QualityGateReport {
  /** Total rules checked */
  total: number
  /** Rules that passed all checks */
  passed: number
  /** Rules with errors (action blocked at load time) */
  errors: number
  /** Rules with warnings (action allowed with advisory) */
  warnings: number
  /** Per-rule issue details */
  details: QualityGateRuleDetail[]
}

export interface QualityGateRuleDetail {
  ruleId: string
  ruleName: string
  issues: ValidationError[]
}

export class RuleQualityGate {
  /**
   * Check all loaded rules against the Sec. 7.4 quality gates.
   *
   * Gates (11 total):
   *   Error (reject on load):
   *     1. wild-when-with-blocking-then
   *     2. no-condition-on-security-rule
   *     3. guard-with-unless
   *     4. unless-with-temporal
   *     5. regex-redos-risk
   *     6. ast-complexity-exceeded
   *   Warning (record log):
   *     7. empty-message-on-blocking-rule
   *     8. non-standard-name
   *     9. non-standard-name-full
   *     10. no-tool-constraint
   *   Info (record hint):
   *     11. no-path-constraint
   */
  check(rules: RuleDefinition[]): QualityGateReport {
    const details: QualityGateRuleDetail[] = []

    for (const rule of rules) {
      const issues: ValidationError[] = []

      // Sec. 7.4: when completeness
      const when = (rule as unknown as Record<string, unknown>).when as string | undefined
      const rawWhen = when ?? extractRawWhen(rule)
      const whenResult = ruleValidator.validateWhenCompleteness(
        { when: rawWhen },
        rule.action?.decision ?? 'ALLOW',
      )
      issues.push(...whenResult.errors)

      // Sec. 7.4: blocking message mandatory
      // CORRECT decision stores its message in `correction`, not `reason` -
      // check the appropriate field based on decision type (see parseThenAction)
      const decision = rule.action?.decision ?? 'ALLOW'
      const messageField = decision === 'CORRECT'
        ? rule.action?.correction
        : rule.action?.reason
      const msgErr = ruleValidator.checkBlockingMessageEmpty(
        decision,
        messageField ?? '',
      )
      if (msgErr) issues.push(msgErr)

      // Sec. 4.1: naming convention
      const nameErr = ruleValidator.checkNamingConvention(rule.name)
      if (nameErr) issues.push(nameErr)

      // Sec. 6: decision consistency
      // RuleDefinition.action.decision is metadata level
      // content.then is not directly available in RuleDefinition
      // Skip for now - template generation handles this on the write path

      // Sec. 7.4: Guard rules MUST NOT have unless
      const guardErr = ruleValidator.checkGuardWithUnless(rule)
      if (guardErr) issues.push(guardErr)

      // Sec. 7.4: unless MUST NOT contain within/rate
      const temporalErr = ruleValidator.checkUnlessWithTemporal(rule)
      if (temporalErr) issues.push(temporalErr)

      // Sec. 7.4: security rules MUST have at least 1 condition
      const secErr = ruleValidator.checkSecurityRuleHasCondition(rule)
      if (secErr) issues.push(secErr)

      // Sec. 7.3(d): dangerous regex (ReDoS) detection
      const regexErr = ruleValidator.checkRegexRedosRisk(rule)
      if (regexErr) issues.push(regexErr)

      // Sec. 7.2 E4: AST complexity limits
      const astErr = ruleValidator.checkASTComplexity(rule)
      if (astErr) issues.push(astErr)

      // Full naming-format validation (error, binary verdict)
      const nameFullErr = ruleValidator.checkNamingConventionFull(rule)
      if (nameFullErr) issues.push(nameFullErr)

      // Sec. 7.4: no-tool-constraint (warning) - coding/security rules should specify tool.name
      const toolErr = ruleValidator.checkToolConstraint(rule)
      if (toolErr) issues.push(toolErr)

      // Sec. 6: Guard then restriction - Guard rules only allow Ring 0-2 + CORRECT/ALLOW
      const guardThenErr = ruleValidator.checkGuardThenRestriction(rule)
      if (guardThenErr) issues.push(guardThenErr)

      if (issues.length > 0) {
        details.push({ ruleId: rule.id, ruleName: rule.name, issues })
      }
    }

    const total = rules.length
    const passed = total - details.length
    const errCount = details.filter(d => d.issues.some(i => i.level === 'error')).length
    const warnCount = details.filter(d => d.issues.some(i => i.level === 'warning') && d.issues.every(i => i.level !== 'error')).length
    const infoCount = details.filter(d => d.issues.every(i => i.level === 'info')).length

    if (errCount > 0) {
      logQg.error(` ${errCount} error(s), ${warnCount} warning(s), ${infoCount} info in ${total} rules`)
      for (const d of details) {
        const errs = d.issues.filter(i => i.level === 'error')
        if (errs.length > 0) {
          logQg.error(`   ${d.ruleName}: ${errs.map(e => e.code).join(', ')}`)
        }
      }
    } else if (warnCount > 0) {
      logQg.warn(` ${warnCount} warning(s)${infoCount > 0 ? `, ${infoCount} info` : ''} in ${total} rules`)
    } else if (infoCount > 0) {
      logQg.log(` ${infoCount} naming suggestion(s) in ${total} rules (SHOULD level - non-blocking)`)
    } else if (total > 0) {
      logQg.log(` ${total} rules passed (0 error, 0 warning)`)
    }

    return { total, passed, errors: errCount, warnings: warnCount, details }
  }
}

/**
 * Extract raw when string from a RuleDefinition's conditions.
 * Only returns a value for simple string-when rules;
 * structured conditions (field/operator/value) return undefined.
 */
function extractRawWhen(rule: RuleDefinition): string | undefined {
  // Check if rule has a raw when string stored as a property
  const raw = (rule as unknown as Record<string, unknown>).when as string | undefined
  if (typeof raw === 'string') return raw

  // If rule has structured conditions but no explicit when, return undefined
  // (structured templates generate their own when - they're fine)
  return undefined
}

export const ruleQualityGate = new RuleQualityGate()
