/**
 * GuardStateManager - state management + hot-reload strategy.
 *
 * Manages the runtime counters of the stateful operators (within/rate),
 * using sliding timestamp-array semantics.
 *
 * Semantic highlights:
 * - rate: timestamp array; `recent.length >= maxCount` within the window means over the limit;
 * - within: timestamp array; `recent.length >= 1` within the window means the check passes
 *   (requires prior history inside the window);
 * - cleanup: cleanup(maxAgeMs) trims expired timestamps per key.
 *
 * Also provides a hot-reload "conservative freeze" capability
 * (snapshotBeforeMigration / isFrozen / conservativeCount) to prevent clearing
 * counters on hot reload from opening a window-period hole in safety rules.
 */

import { Clock, SystemClock } from './clock.js';

/**
 * GuardStateManager
 */
export class GuardStateManager {
  private withinTracker = new Map<string, number[]>();
  private rateTracker = new Map<string, number[]>();
  private readonly clock: Clock;
  private readonly freezeWindowMs: number;

  constructor(clock: Clock = new SystemClock(), freezeWindowMs: number = 60000) {
    this.clock = clock;
    this.freezeWindowMs = freezeWindowMs;
  }

  // ===========================================
  // rate - sliding timestamp-array semantics (read/write separation)
  // ===========================================

  /**
   * Check whether rate is over the limit (read-only, no write-back).
   * @returns true when under the limit (may continue), false when over the limit.
   */
  checkRate(key: string, maxCount: number, windowMs: number): boolean {
    const now = this.clock.now();
    const timestamps = this.rateTracker.get(key) ?? [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    return recent.length < maxCount;
  }

  /**
   * Record one rate event (recorded when under the limit, i.e. for allowed operations).
   * Standard rate-limiting semantics: the count tracks "allowed operations"; over-limit
   * operations do not accumulate, and the window recovers naturally.
   */
  recordRate(key: string, windowMs: number): void {
    const now = this.clock.now();
    const timestamps = this.rateTracker.get(key) ?? [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    recent.push(now);
    this.rateTracker.set(key, recent);
  }

  /**
   * Get the count within the current window for the given key (read-only, for temporal_state snapshots).
   * @param key  tracker key (rate:field:rate or within:field)
   * @param windowMs window size in milliseconds
   * @param isRate  true for the rate tracker, false for the within tracker
   */
  getCount(key: string, windowMs: number, isRate: boolean): number {
    const now = this.clock.now();
    const tracker = isRate ? this.rateTracker : this.withinTracker;
    const timestamps = tracker.get(key) ?? [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    return recent.length;
  }

  // ===========================================
  // within - sliding timestamp-array semantics
  // ===========================================

  /**
   * Check whether there is already a historical event inside the within window (read-only).
   * Requires at least one timestamp inside the window.
   */
  checkWithin(key: string, windowMs: number): boolean {
    const now = this.clock.now();
    const timestamps = this.withinTracker.get(key) ?? [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    return recent.length >= 1;
  }

  /**
   * Record one within event (recorded on first trigger, i.e. the allowed operation).
   * Deduplication semantics: the first trigger inside the window is recorded; from the second on, it hits (blocked).
   */
  recordWithin(key: string): void {
    const now = this.clock.now();
    const timestamps = this.withinTracker.get(key) ?? [];
    timestamps.push(now);
    this.withinTracker.set(key, timestamps);
  }

  // ===========================================
  // Cleanup
  // ===========================================

  /**
   * Trim expired timestamps (conservative cleanup by maxAgeMs).
   */
  cleanup(maxAgeMs: number): void {
    const now = this.clock.now();
    for (const [key, timestamps] of this.rateTracker) {
      const recent = timestamps.filter((t) => now - t < maxAgeMs);
      if (recent.length === 0) this.rateTracker.delete(key);
      else this.rateTracker.set(key, recent);
    }
    for (const [key, timestamps] of this.withinTracker) {
      const recent = timestamps.filter((t) => now - t < maxAgeMs);
      if (recent.length === 0) this.withinTracker.delete(key);
      else this.withinTracker.set(key, recent);
    }
  }

  // ===========================================
  // Hot-reload conservative freeze
  // ===========================================

  /**
   * Snapshot before hot reload: returns the currently active keys and timestamps, for conservative counting during the freeze window.
   */
  snapshotBeforeMigration(): { withinKeys: string[]; rateKeys: string[]; snapshotTime: number } {
    return {
      withinKeys: Array.from(this.withinTracker.keys()),
      rateKeys: Array.from(this.rateTracker.keys()),
      snapshotTime: this.clock.now(),
    };
  }

  /** Whether we are inside the freeze window. */
  isFrozen(snapshotTime: number): boolean {
    return (this.clock.now() - snapshotTime) < this.freezeWindowMs;
  }

  /**
   * Conservative counting: during the freeze window the count is max(actual, floor(limit * 0.8)),
   * preventing underestimation of existing invocations within the window after a hot reload.
   */
  conservativeCount(actualCount: number, limit: number): number {
    return Math.max(actualCount, Math.floor(limit * 0.8));
  }

  /** Clear all state (for testing only). */
  reset(): void {
    this.withinTracker.clear();
    this.rateTracker.clear();
  }

  /** Get the within keys active inside the window (for diagnostics). */
  getActiveWithinKeys(windowMs: number): string[] {
    const now = this.clock.now();
    const active: string[] = [];
    for (const [key, timestamps] of this.withinTracker) {
      const recent = timestamps.filter((t) => now - t < windowMs);
      if (recent.length > 0) active.push(key);
    }
    return active;
  }
}
