/**
 * eval-trace - evaluation evidence chain ("the tree is the evidence").
 *
 * Expression-level evaluation treats the tree as evidence: one DerivationRecord
 * per derived value, forming an evidence chain that can be independently
 * recomputed. eval_trace is the node-level reasoning chain - required for
 * Expression-grade rules, recommended for Simple-grade rules - recorded into
 * the decision object.
 *
 * DerivationRecord fields:
 * - node identity (node type + position)
 * - semantic canonical hash (hash of the node in its canonical form)
 * - context snapshot hash (a snapshot of the context at evaluation time, not a reference)
 * - input value snapshot (not a reference; undefined inputs are distinguished)
 * - output and verdict
 *
 * gloss and eval_trace together form the two sides of the decision object:
 * humans read the gloss to judge correctness; machines verify the eval_trace
 * to prove it.
 *
 * @license MIT
 */

import { createHash } from 'node:crypto'
import type { ExprNode } from './node-types.js'
import { canonicalTree } from './canonical.js'

/** A single derivation record (DerivationRecord). */
export interface DerivationRecord {
  /** Node type. */
  nodeType: string
  /** Position of the node in the tree (human-readable locating aid; unique node identity is guaranteed by nodeHash). */
  path: string
  /** Hash of the node's canonical form (semantic canonical hash, i.e. the node identity). */
  nodeHash: string
  /** Context snapshot hash (a non-reference snapshot hash of the context at evaluation time, for independent recomputation checks). */
  contextHash: string
  /** Input value snapshot (non-reference; undefined/absent are distinguished; leaf nodes record resolved values, composite nodes leave it to the caller to fill). */
  inputValues: Array<{ type: string; value: unknown; absent: boolean }>
  /** Output value. */
  output: unknown
  /** Verdict (boolean or value). */
  verdict: unknown
  /** Evaluation warnings (if any). */
  warnings?: string[]
}

/** A complete eval_trace. */
export interface EvalTrace {
  /** Hash of the root node. */
  rootHash: string
  /** Per-node derivation records. */
  records: DerivationRecord[]
  /** Final result. */
  finalValue: unknown
}

/** Value snapshot: safe serialization (undefined/null distinguished, non-reference). */
function snapshot(value: unknown): { type: string; value: unknown; absent: boolean } {
  if (value === undefined) return { type: 'undefined', value: null, absent: true }
  if (value === null) return { type: 'null', value: null, absent: false }
  const t = typeof value
  if (t === 'bigint') {
    // Defensively stringify bare bigints (non-Rational) to avoid JSON serialization crashes
    return { type: 'bigint', value: String(value), absent: false }
  }
  if (t === 'object' && value !== null && typeof (value as { num?: unknown }).num === 'bigint' && typeof (value as { den?: unknown }).den === 'bigint') {
    // Rational object snapshot
    return { type: 'rational', value: `${(value as { num: bigint }).num}/${(value as { den: bigint }).den}`, absent: false }
  }
  if (t === 'object') {
    // Object snapshot (JSON serialized, non-reference)
    try { return { type: 'object', value: JSON.parse(JSON.stringify(value)), absent: false } }
    catch { return { type: 'object', value: '[unserializable]', absent: false } }
  }
  return { type: t, value, absent: false }
}

/** Canonical hash of a node (used as the semantic canonical hash). */
export function hashNodeCanonical(node: ExprNode): string {
  return createHash('sha256').update(canonicalTree(node)).digest('hex')
}

/** Empty trace. */
export function emptyTrace(): EvalTrace {
  return { rootHash: '', records: [], finalValue: null }
}

// ===========================================
// TraceCollector - collects DerivationRecords during evaluation
// ===========================================

/** Trace collector invoked by the evaluator during recursive evaluation. */
export class TraceCollector {
  private readonly records: DerivationRecord[] = []
  private contextHash: string = ''

  /** Set the context snapshot hash (called once at the start of evaluation). */
  setContextHash(hash: string): void {
    this.contextHash = hash
  }

  /** Record a single derivation record. */
  record(nodeType: string, path: string, node: ExprNode, inputValues: unknown[], output: unknown, verdict: unknown, warnings?: string[]): void {
    this.records.push({
      nodeType,
      path,
      nodeHash: hashNodeCanonical(node),
      contextHash: this.contextHash,
      inputValues: inputValues.map((v) => snapshot(v)),
      output: snapshot(output).value,
      verdict: snapshot(verdict).value,
      ...(warnings && warnings.length > 0 ? { warnings } : {}),
    })
  }

  /** Produce the complete EvalTrace. */
  toTrace(root: ExprNode, finalValue: unknown): EvalTrace {
    return {
      rootHash: hashNodeCanonical(root),
      records: this.records,
      finalValue: snapshot(finalValue).value,
    }
  }

  get size(): number {
    return this.records.length
  }
}
