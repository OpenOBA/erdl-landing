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
