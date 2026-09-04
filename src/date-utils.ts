/**
 * date-utils - date arithmetic helpers (UTC semantics, zero dependencies, deterministic).
 *
 * Timezone semantics: all date values are evaluated in UTC, guaranteeing
 * consistent results across implementations and time zones (dates are stored
 * and transmitted in UTC; conversion to a business-local timezone, if any,
 * happens when the engine injects `as_of`).
 *
 * Covers the 9 functions needed by the expression-tree evaluator:
 *   - addYears / addMonths: UTC calendar arithmetic with end-of-month clamping
 *     (clamps to the last day of the target month, handling Feb 29 leap years)
 *   - addDays / addHours: UTC timestamp addition/subtraction (a UTC day is
 *     always 86400000 ms and an hour always 3600000 ms; no DST)
 *   - getYear / getMonth / getDate / getDay: UTC component extraction
 *     (equivalent to getUTC*)
 *   - endOfMonth: last day of the month in UTC (Date.UTC at month end 00:00:00Z)
 *
 * @license MIT
 */

/** Number of days in the given year/month (month: 0-11, UTC calendar). */
function daysInMonthUtc(year: number, month: number): number {
  // Day 0 of the next month = last day of this month (UTC)
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** Add N years (UTC calendar arithmetic with end-of-month clamping: Feb 29 + 1 year -> Feb 28). */
export function addYears(date: Date, amount: number): Date {
  const d = new Date(date.getTime())
  const y = d.getUTCFullYear() + amount
  const m = d.getUTCMonth()
  const day = Math.min(d.getUTCDate(), daysInMonthUtc(y, m))
  d.setUTCFullYear(y, m, day)
  return d
}

/** Add N months (UTC calendar arithmetic with end-of-month clamping: Jan 31 + 1 month -> Feb 28 or Feb 29). */
export function addMonths(date: Date, amount: number): Date {
  const d = new Date(date.getTime())
  const totalMonths = d.getUTCFullYear() * 12 + d.getUTCMonth() + amount
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths - y * 12
  const day = Math.min(d.getUTCDate(), daysInMonthUtc(y, m))
  d.setUTCFullYear(y, m, day)
  return d
}

/** Add N days (UTC timestamp arithmetic; a UTC day is always 86400000 ms). */
export function addDays(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 86400000)
}

/** Add N hours (UTC timestamp arithmetic; a UTC hour is always 3600000 ms). */
export function addHours(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 3600000)
}

/** 4-digit year (UTC). */
export function getYear(date: Date): number {
  return date.getUTCFullYear()
}

/** Month (0-11, UTC). */
export function getMonth(date: Date): number {
  return date.getUTCMonth()
}

/** Day of month (1-31, UTC). */
export function getDate(date: Date): number {
  return date.getUTCDate()
}

/** Day of week (0 = Sunday, 6 = Saturday, UTC). */
export function getDay(date: Date): number {
  return date.getUTCDay()
}

/** Last day of the month (UTC, at month end 00:00:00Z). */
export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}

// --- Strict ISO 8601 date/datetime parsing (spec §7.3(f), UTC semantics) ---

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})?$/

/** Whether (year, month 1-12, day) is a real calendar date (rejects 2026-02-30 etc.). */
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false
  return day >= 1 && day <= daysInMonthUtc(year, month - 1)
}

/**
 * Parse a date/datetime into a UTC `Date` with strict, deterministic ISO 8601 semantics.
 *
 * Accepted forms (matching erdl-formal's SMT encoding):
 *   - date-only   `YYYY-MM-DD`                    -> UTC midnight
 *   - datetime    `YYYY-MM-DDTHH:MM:SS[.fraction]`  (no tz suffix -> UTC, §7.3(f))
 *   - datetime    `...Z` / `...±HH:MM`              (explicit zone, kept)
 *
 * Any other input (non-ISO strings such as `Jan 1 2026`, slash dates, or an invalid
 * calendar date) returns `null`, so callers record `invalid_date` instead of delegating
 * to implementation-defined `Date` parsing. This removes the cross-timezone drift where
 * a no-timezone datetime was previously parsed as *local* time (breaking byte-for-byte
 * determinism on non-UTC hosts).
 */
export function parseIsoDateStrict(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value !== 'string') return null
  const s = value.trim()

  const dateOnly = DATE_ONLY_RE.exec(s)
  if (dateOnly) {
    const y = Number(dateOnly[1])
    const m = Number(dateOnly[2])
    const d = Number(dateOnly[3])
    if (!isRealDate(y, m, d)) return null
    return new Date(Date.UTC(y, m - 1, d))
  }

  const dt = DATETIME_RE.exec(s)
  if (!dt) return null
  const y = Number(dt[1])
  const m = Number(dt[2])
  const d = Number(dt[3])
  const h = Number(dt[4])
  const mi = Number(dt[5])
  const se = Number(dt[6])
  if (!isRealDate(y, m, d)) return null
  if (h > 23 || mi > 59 || se > 59) return null
  const tz = dt[8]
  // No timezone suffix -> UTC (spec §7.3(f)); append Z so Date parses as UTC, never local.
  const canonical = tz === undefined ? `${s}Z` : s
  const parsed = new Date(canonical)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
