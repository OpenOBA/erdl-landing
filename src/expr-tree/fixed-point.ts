/**
 * FixedPoint - strict fixed-point decimal arithmetic over rationals.
 *
 * Constraints (strict implementation, no hidden pitfalls):
 * - Intermediate computation uses [high-precision bounded rationals]
 *   (bigint numerator/denominator), with no rounding
 *   -> avoids accumulated rounding error across multi-step computation,
 *   keeping hashes byte-identical across implementations
 * - Only the [output node] rounds, using scale=14 + half-even
 *   (banker's rounding, IEEE 754-2019 ROUND_HALF_EVEN) when serializing to string
 *
 * Rational representation: { num: bigint, den: bigint }, den > 0, always
 * reduced to lowest terms (gcd reduction).
 * All operations return normalized rationals; `toDecimalString()` is the
 * single rounding exit.
 *
 * @license MIT
 */

export const DECIMAL_SCALE = 14

/** Rational (numerator/denominator; denominator always positive, always in lowest terms). */
export interface Rational {
  num: bigint
  den: bigint
}

export class FixedPointError extends Error {
  constructor(message: string) {
    super(`[FixedPoint] ${message}`)
    this.name = 'FixedPointError'
  }
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b !== 0n) {
    const t = a % b
    a = b
    b = t
  }
  return a
}

/** Normalize a rational: denominator always positive + gcd reduction. */
function normalize(num: bigint, den: bigint): Rational {
  if (den === 0n) throw new FixedPointError('Division by zero')
  if (den < 0n) {
    num = -num
    den = -den
  }
  const g = gcd(num, den)
  if (g > 1n) {
    num /= g
    den /= g
  }
  return { num, den }
}

/** Construct a rational from an integer. */
export function fromInt(n: number | bigint | string): Rational {
  const big = typeof n === 'bigint' ? n : BigInt(String(n))
  return { num: big, den: 1n }
}

/** Construct a rational from a decimal string (e.g. "0.15" -> 15/100 -> 3/20). */
export function fromDecimalString(s: string): Rational {
  const str = s.trim()
  if (!/^-?\d+(\.\d+)?$/.test(str)) throw new FixedPointError(`invalid decimal literal: ${s}`)
  const neg = str.startsWith('-')
  const abs = neg ? str.slice(1) : str
  const [intPart, fracPart = ''] = abs.split('.')
  const scale = fracPart.length
  const den = 10n ** BigInt(scale)
  const num = BigInt(intPart || '0') * den + BigInt(fracPart || '0')
  return normalize(neg ? -num : num, den)
}

/**
 * Expand exponential notation in the String() output of a JS number into a plain decimal string.
 * String(1e-7) === "1e-7" and String(1e21) === "1e+21"; fromDecimalString does not accept that format.
 * Expansion preserves the shortest round-trip decimal semantics of String(v) (deterministic, consistent across implementations).
 */
function expandExponential(s: string): string {
  if (!/[eE]/.test(s)) return s
  const [mantissa, expStr] = s.split(/[eE]/)
  const exp = parseInt(expStr, 10)
  if (!Number.isFinite(exp)) throw new FixedPointError(`invalid exponent: ${s}`)
  const neg = mantissa.startsWith('-')
  const m = neg ? mantissa.slice(1) : mantissa
  const [intPart, fracPart = ''] = m.split('.')
  const digits = intPart + fracPart
  const pointPos = intPart.length + exp
  let out: string
  if (pointPos <= 0) out = '0.' + '0'.repeat(-pointPos) + digits
  else if (pointPos >= digits.length) out = digits + '0'.repeat(pointPos - digits.length)
  else out = digits.slice(0, pointPos) + '.' + digits.slice(pointPos)
  return (neg ? '-' : '') + out
}

/**
 * Construct a rational from a JS number (runtime context entry point; fail-close semantics are handled by the caller).
 * Non-finite values (NaN/+/-Infinity) throw FixedPointError.
 */
export function fromNumber(v: number): Rational {
  if (!Number.isFinite(v)) throw new FixedPointError(`non-finite number: ${v}`)
  return fromDecimalString(expandExponential(String(v)))
}

export function add(a: Rational, b: Rational): Rational {
  return normalize(a.num * b.den + b.num * a.den, a.den * b.den)
}
export function sub(a: Rational, b: Rational): Rational {
  return normalize(a.num * b.den - b.num * a.den, a.den * b.den)
}
export function mul(a: Rational, b: Rational): Rational {
  return normalize(a.num * b.num, a.den * b.den)
}
export function div(a: Rational, b: Rational): Rational {
  return normalize(a.num * b.den, a.den * b.num)
}
export function neg(a: Rational): Rational {
  return { num: -a.num, den: a.den }
}

/** Compare: returns -1/0/1. */
export function compare(a: Rational, b: Rational): number {
  const lhs = a.num * b.den
  const rhs = b.num * a.den
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0
}

/**
 * Round to a decimal string with scale=14 + half-even.
 * This is the single rounding exit - intermediate computation stays rational and is never rounded before this point.
 */
export function toDecimalString(r: Rational, scale: number = DECIMAL_SCALE): string {
  const pow = 10n ** BigInt(scale)
  const { num, den } = r
  const neg = num < 0n
  const absNum = neg ? -num : num

  // Integer part + remainder
  const intPart = absNum / den
  const remainder = absNum % den

  // Goal: the first `scale` decimal digits of remainder / den, plus digit scale+1 for the rounding decision
  // scaled = floor(remainder * 10^(scale+1) / den)
  const scaled = (remainder * pow * 10n) / den
  const kept = scaled / 10n          // first scale digits
  const nextDigit = Number(scaled % 10n) // digit scale+1 (0-9)

  // Check whether there is any remaining tail (non-zero digits after nextDigit)
  const afterNext = (remainder * pow * 10n) % den
  const hasRest = afterNext !== 0n

  // The "last kept digit" for half-even: last digit of kept when scale>0, last digit of intPart when scale=0
  const lastKeptDigit = Number(scale > 0 ? (kept % 10n) : (intPart % 10n))

  let rounded = kept
  if (nextDigit > 5) {
    rounded += 1n
  } else if (nextDigit === 5 && (hasRest || lastKeptDigit % 2 === 1)) {
    // half-even: tail non-zero, or the kept digit is odd -> round up
    rounded += 1n
  }

  // If rounding carries into the integer part (e.g. 0.999... -> 1.000...)
  let intStr = intPart.toString()
  let fracStr = rounded.toString().padStart(scale, '0')
  if (rounded >= pow) {
    intStr = (intPart + 1n).toString()
    fracStr = (rounded - pow).toString().padStart(scale, '0')
  }

  // Strip trailing zeros - minimal canonical representation: integers without a decimal point, decimals without trailing zeros
  const trimmed = scale > 0 ? `${fracStr}`.replace(/0+$/, '') : ''
  const out = scale > 0 ? (trimmed === '' ? intStr : `${intStr}.${trimmed}`) : intStr
  return (neg ? '-' : '') + out
}

/** Check whether the rational is an integer (denominator == 1). */
export function isInteger(r: Rational): boolean {
  return r.den === 1n
}

/** Convert a rational to number (only for JS interop boundaries; not used for rule evaluation). */
export function toNumber(r: Rational): number {
  return Number(r.num) / Number(r.den)
}
