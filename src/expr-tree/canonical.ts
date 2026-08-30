/**
 * canonical - canonical expression tree + hash.
 *
 * The hash is computed over the canonical tree (not the serialized text).
 * Canonicalization rules:
 * - Fixed node order: the children array order of the S-expression is the
 *   canonical order (already ordered at construction time)
 * - Field names carry weight: field paths participate in the hash and are
 *   frozen - they must not change
 * - Literal canonicalization: numbers stay numbers (JCS IEEE 754, strictly
 *   distinguished from strings); strings are NFC-normalized; monetary/floating
 *   point values MUST use strings
 * - var canonicalization: only '$' / '$.path'
 * - Metadata stripping: S-expressions carry no metadata (this implementation
 *   never adds any), so this holds by construction
 *
 * Hash algorithm: JCS (RFC 8785, json-canonicalize) + SHA-256.
 *
 * @license MIT
 */

import { createHash } from 'node:crypto'
import { canonicalize } from 'json-canonicalize'
import type { ExprNode } from './node-types.js'
import { toSExpr } from './s-expression.js'
import { normalizeNfc } from './normalize.js'

/** Recursively canonicalize literal values in an S-expression (strict typing: numbers stay numbers for JCS IEEE 754 handling and are distinguished from strings; strings are NFC-normalized). */
function normalizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return normalizeNfc(value)
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue)
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeValue(v)
    }
    return out
  }
  // number / boolean / null: kept as-is (strict typing; numbers distinguished from strings)
  return value
}

/** Canonical expression tree -> JCS byte sequence. */
export function canonicalTree(node: ExprNode): string {
  const sexpr = toSExpr(node)
  const normalized = normalizeValue(sexpr)
  return canonicalize(normalized as Record<string, unknown>)
}

/** Hash of the canonical expression tree (SHA-256). */
export function hashTree(node: ExprNode): string {
  const canonical = canonicalTree(node)
  return createHash('sha256').update(canonical).digest('hex')
}

/** Return the prefixed hash (matches the 'sha256:' prefix used by the decision-object layer). */
export function hashTreeWithPrefix(node: ExprNode): string {
  return `sha256:${hashTree(node)}`
}
