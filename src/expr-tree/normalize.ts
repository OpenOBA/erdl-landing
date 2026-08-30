/**
 * normalize - Unicode NFC canonicalization for strings.
 *
 * String literals are normalized to Unicode NFC before entering the
 * canonical tree / hash, so visually identical strings with different
 * code points (e.g. e vs e + combining mark) produce identical byte sequences.
 *
 * @license MIT
 */

/** NFC-normalize a string (uses the built-in normalize('NFC')). */
export function normalizeNfc(input: string): string {
  return input.normalize('NFC')
}

/** Recursively normalize all string values inside an object (used for literal canonicalization). */
export function normalizeStringValue(value: unknown): unknown {
  if (typeof value === 'string') return normalizeNfc(value)
  if (Array.isArray(value)) return value.map(normalizeStringValue)
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeStringValue(v)
    }
    return out
  }
  return value
}
