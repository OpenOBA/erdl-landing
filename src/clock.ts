/**
 * Clock - time abstraction layer.
 *
 * Makes time-dependent rules (within/rate) testable.
 */

export interface Clock {
  /** Returns the current time (millisecond Unix timestamp). */
  now(): number;

  /** Freeze at the given time (for testing). */
  freeze?(time: number): void;

  /** Fast-forward time (for testing). */
  advance?(ms: number): void;
}

/**
 * SystemClock - real system clock.
 */
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

/**
 * VirtualClock - virtual clock (for testing).
 *
 * Initial time defaults to 0. Supports freeze to any point in time and advance.
 */
export class VirtualClock implements Clock {
  private _now: number;

  constructor(initialTime: number = 0) {
    this._now = initialTime;
  }

  now(): number {
    return this._now;
  }

  freeze(time: number): void {
    this._now = time;
  }

  advance(ms: number): void {
    if (ms < 0) {
      throw new Error('VirtualClock.advance: ms must be non-negative');
    }
    this._now += ms;
  }
}
