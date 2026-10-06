/**
 * canonical - canonical expression tree + hash.
 *
 * The hash is computed over the canonical tree (not the serialized text).
 * Canonicalization rules:
 * - Fixed node order: the children array order of the S-expression is the
 *   canonical order (already ordered at construction time)
 * - Field names carry weight: field paths participate in the hash and are
 *   frozen - they must not change
 * - Literal canonicalization: numbers are typed `{ n: "<decimal>" }`, strictly
 *   distinguished from strings (which stay bare NFC-normalized values)
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
import { expandExponential } from './fixed-point.js'

/**
 * Recursively canonicalize literal values in an S-expression.
 *
 * Typed number literals (S2 fix): a JS number serializes as `{ n: "<decimal>" }`
 * (an object with a single `n` key), NOT as a bare decimal string. This removes
 * the encoding collision between `eq(x, 15)` and `eq(x, "15")` — a number and a
 * numeric string previously canonicalized to identical bytes, so their tree
 * hashes matched while their strict-typed semantics differ. The `n` key is
 * reserved: it is not an S-expression node key, so it cannot collide with a
 * node name. Strings are NFC-normalized and stay bare values.
 */
function normalizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return normalizeNfc(value)
  }
  if (typeof value === 'number') {
    // Decimal form: shortest round-trip, exponential expanded, -0 normalized to 0
    // (expandExponential(String(-0)) === "0"). Canonical decimal-string rules:
    // no leading +, no trailing zeros, no exponent.
    return { n: expandExponential(String(value)) }
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
  // boolean / null: kept as-is
  return value
}

/** Canonical expression tree as a normalized JSON object (typed number literals applied). */
export function canonicalTreeObject(node: ExprNode): unknown {
  return normalizeValue(toSExpr(node))
}

/** Canonical expression tree -> JCS byte sequence. */
export function canonicalTree(node: ExprNode): string {
  return canonicalize(canonicalTreeObject(node) as Record<string, unknown>)
}

/**
 * Versioned domain-separation prefix for tree hashes.
 *
 * S2 fix: changing the number-literal encoding (bare decimal string → typed
 * `{ n: "..." }`) changes the hash of every tree containing a number literal.
 * To prevent a stale implementation or a stale hash crosswalk from ever
 * mistaking a v2.x hash for a v3 hash (or vice versa), the hash input is
 * domain-separated by this prefix. A tree with no number literal would hash
 * identically across the encoding change without it.
 */
export const TREE_HASH_DOMAIN = 'erdl-tree-v3:'

/** Hash of the canonical expression tree (SHA-256, domain-separated). */
export function hashTree(node: ExprNode): string {
  const canonical = canonicalTree(node)
  return createHash('sha256').update(TREE_HASH_DOMAIN + canonical).digest('hex')
}

/** Return the prefixed hash (matches the 'sha256:' prefix used by the decision-object layer). */
export function hashTreeWithPrefix(node: ExprNode): string {
  return `sha256:${hashTree(node)}`
}
