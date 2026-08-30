/**
 * SafeRegExp - ReDoS-protected regex construction.
 *
 * All pattern-based rule conditions (match, matches operators) MUST use
 * safeRegExp() instead of bare `new RegExp()`. This prevents:
 *   1. ReDoS (exponential backtracking) via nested quantifier detection
 *   2. ReDoS (polynomial backtracking) via adjacent quantified-atom detection
 *   3. Pattern length overflow via max-length cap
 *   4. Invalid regex crash via try-catch wrapper
 *
 * Cost bound (engineering equivalent of a <=10000 regex-step limit):
 * JS RegExp has no step-counting primitive, so this module bounds the worst-case
 * execution cost via static pattern analysis + an input length cap.
 * safeTest() truncates over-limit input before matching, guaranteeing bounded
 * evaluation per rule.
 *
 * Note: static detection is a heuristic mitigation, not a complete ReDoS proof.
 */

const REGEX_MAX_LENGTH = 200;
/** Max input length for regex matching: bounds worst-case backtracking cost. */
export const REGEX_MAX_INPUT_LENGTH = 10_000;

// Detect nested quantifiers: (a+)+, (a+)*, (a+)+?, (a*)*, (a+){1,10}, etc.
// Matches: ) followed by optional whitespace then another quantifier
// Quantifier after ) means nested: )+, )*, )?, ){n,m}
// The { must be followed by a digit to be a regex quantifier -
// plain { } blocks (e.g. fork bomb :(){ :|:& };:) are not quantifiers.
const NESTED_QUANTIFIER = /\)\s*([+*?]|\{\d)/;

// Hardening: adjacent quantified-atom detection (multi-dimensional backtracking
// risk in patterns like a*a*, .*.*, \w+\w+, [a-z]+[a-z]+).
// Considered dangerous only when the two adjacent atoms are identical, or either
// one is the wildcard '.' (dissimilar adjacent atoms such as \w+\d+ are allowed).
const ADJACENT_QUANTIFIED_ATOMS =
  /(\\[wdsWDS]|\[[^\]]*\]|\.|[A-Za-z0-9])([+*]|\{\d+(?:,\d*)?\})(\\[wdsWDS]|\[[^\]]*\]|\.|[A-Za-z0-9])([+*]|\{\d)/g;

export class SafeRegExpError extends Error {
  constructor(message: string) {
    super(`SafeRegExp: ${message}`);
    this.name = 'SafeRegExpError';
  }
}

/**
 * Statically analyze the safety of a regex pattern. Returns null when it passes,
 * otherwise the rejection reason.
 * Single entry point shared by safeRegExp() and the rule-loading quality gate,
 * so the "blocked at load time" and "constructed at runtime" decisions stay consistent.
 */
export function analyzePattern(pattern: string): string | null {
  if (typeof pattern !== 'string') {
    return `pattern must be a string, got ${typeof pattern}`;
  }

  if (pattern.length > REGEX_MAX_LENGTH) {
    return `pattern exceeds ${REGEX_MAX_LENGTH} chars (got ${pattern.length})`;
  }

  if (NESTED_QUANTIFIER.test(pattern)) {
    return 'potential ReDoS pattern rejected: nested quantifiers detected';
  }

  ADJACENT_QUANTIFIED_ATOMS.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ADJACENT_QUANTIFIED_ATOMS.exec(pattern)) !== null) {
    const [, atom1, , atom2] = m;
    if (atom1 === atom2 || atom1 === '.' || atom2 === '.') {
      return `potential ReDoS pattern rejected: adjacent quantified atoms (${atom1}...${atom2})`;
    }
  }

  return null;
}

export function safeRegExp(pattern: string, flags?: string): RegExp {
  const rejection = analyzePattern(pattern);
  if (rejection) {
    throw new SafeRegExpError(rejection);
  }

  try {
    return new RegExp(pattern, flags);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new SafeRegExpError(`invalid pattern "${pattern}": ${msg}`);
  }
}

/**
 * Bounded regex match: when the input exceeds maxInputLength it is truncated
 * before matching (engineering equivalent of the cost cap).
 * Caller semantics are "does the condition match" - truncation only limits the
 * matching window and does not change the fail-close direction: an unmatched
 * pattern condition evaluates to false -> the rule does not fire, consistent
 * with the existing null-propagation semantics.
 */
export function safeTest(re: RegExp, input: string, maxInputLength: number = REGEX_MAX_INPUT_LENGTH): boolean {
  const bounded = input.length > maxInputLength ? input.slice(0, maxInputLength) : input;
  return re.test(bounded);
}
