/**
 * Date utilities for YYYY-MM-DD strings. Used by Analytics and other modules
 * that rely on transaction/income dates. Validates to avoid NaN and bad buckets.
 */

export interface ParsedDate {
  y: number;
  m: number;
  d: number;
}

const YYYYMMDD_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Returns today's date as a YYYY-MM-DD string in local time. */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a string as YYYY-MM-DD. Returns null if invalid (wrong length, non-numeric,
 * or invalid month/day).
 */
export function parseYYYYMMDD(s: string): ParsedDate | null {
  if (typeof s !== 'string' || s.length !== 10) return null;
  const match = YYYYMMDD_REGEX.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const lastDay = new Date(y, m, 0).getDate();
  if (d > lastDay) return null;
  return { y, m, d };
}

/**
 * Return month key (year * 12 + (month - 1)) for aggregation, or null if invalid.
 */
export function monthKeyFromYYYYMMDD(s: string): number | null {
  const p = parseYYYYMMDD(s);
  if (!p) return null;
  return p.y * 12 + (p.m - 1);
}

/**
 * Return true if the date string is a valid YYYY-MM-DD within the last N days from ref.
 */
export function isWithinLastDays(dateStr: string, days: number, ref: Date = new Date()): boolean {
  const p = parseYYYYMMDD(dateStr);
  if (!p) return false;
  const d = new Date(p.y, p.m - 1, p.d);
  const start = new Date(ref);
  start.setDate(start.getDate() - days);
  return d >= start && d <= ref;
}

/**
 * Return true if the date string's month key is within [startMonthKey, endMonthKey] inclusive.
 */
export function isMonthKeyInRange(dateStr: string, startMonthKey: number, endMonthKey: number): boolean {
  const key = monthKeyFromYYYYMMDD(dateStr);
  if (key == null) return false;
  return key >= startMonthKey && key <= endMonthKey;
}

export interface PeriodBounds {
  start: string;
  end: string;
}

/** Options for period calculation. Biweekly: period 1 = [period1StartDay, period1EndDay], period 2 = (period1EndDay+1)–last day. Weekly: week containing date (week starts on weekStartDay). */
export interface PeriodOptions {
  /** Biweekly: first day of period 1 (1–31). Default 1. */
  period1StartDay?: number;
  /** Biweekly: last day of period 1 (1–31). Default 14. */
  period1EndDay?: number;
  /** Weekly: 0 = Sunday, 1 = Monday. Default 0. */
  weekStartDay?: number;
}

const DEFAULT_BIWEEKLY_PERIOD1_START_DAY = 1;
const DEFAULT_BIWEEKLY_PERIOD1_END_DAY = 14;
const DEFAULT_WEEK_START_DAY = 0;

/**
 * Return the period (start and end YYYY-MM-DD) containing the given date.
 * - monthly: full month (day 1 through last day of month).
 * - biweekly: Period 1 = days period1StartDay–period1EndDay, Period 2 = (period1EndDay+1)–last day of month. Start/end clamped to month.
 * - weekly: 7-day week containing the date; week starts on weekStartDay (0=Sun, 1=Mon).
 */
export function getPeriodForDate(
  dateStr: string,
  mode: 'monthly' | 'biweekly' | 'weekly',
  options: PeriodOptions & { period1EndDay?: number } = {}
): PeriodBounds | null {
  const p = parseYYYYMMDD(dateStr);
  if (!p) return null;
  const { y, m, d } = p;
  const lastDay = new Date(y, m, 0).getDate();

  if (mode === 'monthly') {
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  }

  if (mode === 'weekly') {
    const weekStart = options.weekStartDay ?? DEFAULT_WEEK_START_DAY;
    const date = new Date(y, m - 1, d);
    const dayOfWeek = date.getDay(); // 0 Sun .. 6 Sat
    const offset = (dayOfWeek - weekStart + 7) % 7;
    const weekStartDate = new Date(date);
    weekStartDate.setDate(date.getDate() - offset);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    const sy = weekStartDate.getFullYear();
    const sm = weekStartDate.getMonth() + 1;
    const sd = weekStartDate.getDate();
    const ey = weekEndDate.getFullYear();
    const em = weekEndDate.getMonth() + 1;
    const ed = weekEndDate.getDate();
    return {
      start: `${sy}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`,
      end: `${ey}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`,
    };
  }

  // biweekly
  const p1Start = Math.max(1, Math.min(31, options.period1StartDay ?? DEFAULT_BIWEEKLY_PERIOD1_START_DAY));
  const p1End = Math.max(1, Math.min(31, options.period1EndDay ?? DEFAULT_BIWEEKLY_PERIOD1_END_DAY));
  const period1End = Math.min(Math.max(p1Start, p1End), lastDay);
  const period1Start = Math.min(p1Start, period1End);
  const period2Start = period1End + 1;
  const inPeriod1 = d >= period1Start && d <= period1End;
  const periodStartDay = inPeriod1 ? period1Start : period2Start;
  const periodEndDay = inPeriod1 ? period1End : lastDay;
  const start = `${y}-${String(m).padStart(2, '0')}-${String(periodStartDay).padStart(2, '0')}`;
  const end = `${y}-${String(m).padStart(2, '0')}-${String(periodEndDay).padStart(2, '0')}`;
  return { start, end };
}

/**
 * Return true if dateStr (YYYY-MM-DD) is within [start, end] inclusive.
 */
export function isDateInPeriod(dateStr: string, start: string, end: string): boolean {
  const p = parseYYYYMMDD(dateStr);
  const s = parseYYYYMMDD(start);
  const e = parseYYYYMMDD(end);
  if (!p || !s || !e) return false;
  const d = p.y * 10000 + p.m * 100 + p.d;
  const startNum = s.y * 10000 + s.m * 100 + s.d;
  const endNum = e.y * 10000 + e.m * 100 + e.d;
  return d >= startNum && d <= endNum;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Human-readable label for a period (e.g. "January 2025", "Period 1 (Jan 5–18)", "Week of Jan 5–11, 2025").
 * For biweekly, optional options.period1EndDay is used to show "Period 1" vs "Period 2".
 */
export function getPeriodLabel(
  period: PeriodBounds,
  mode: 'monthly' | 'biweekly' | 'weekly',
  options?: PeriodOptions
): string {
  const start = parseYYYYMMDD(period.start);
  if (!start) return period.start;
  if (mode === 'monthly') {
    return `${MONTH_NAMES[start.m - 1]} ${start.y}`;
  }
  const end = parseYYYYMMDD(period.end);
  if (!end) return period.start;
  if (mode === 'weekly') {
    if (start.y === end.y && start.m === end.m) {
      return `Week of ${MONTH_NAMES[start.m - 1]} ${start.d}–${end.d}, ${start.y}`;
    }
    return `Week of ${MONTH_NAMES[start.m - 1]} ${start.d} – ${MONTH_NAMES[end.m - 1]} ${end.d}, ${start.y}`;
  }
  // Biweekly: which period (use options.period1EndDay when provided, else infer from start.d === 1 for classic split)
  const lastDay = new Date(start.y, start.m, 0).getDate();
  const p1End = options?.period1EndDay != null ? Math.min(Math.max(1, options.period1EndDay), lastDay) : null;
  const periodNum = p1End != null ? (end.d <= p1End ? 1 : 2) : (start.d === 1 ? 1 : 2);
  return `Period ${periodNum} (${MONTH_NAMES[start.m - 1]} ${start.d}–${end.d})`;
}

/**
 * Days left in the period (inclusive of today). referenceDate defaults to today.
 */
export function getDaysLeftInPeriod(period: PeriodBounds, referenceDate: Date = new Date()): number {
  const end = parseYYYYMMDD(period.end);
  if (!end) return 0;
  const refY = referenceDate.getFullYear();
  const refM = referenceDate.getMonth() + 1;
  const refD = referenceDate.getDate();
  const refNum = refY * 10000 + refM * 100 + refD;
  const endNum = end.y * 10000 + end.m * 100 + end.d;
  return Math.max(0, endNum - refNum + 1);
}

/**
 * Biweekly period key: year*24 + (month-1)*2 + (day in period 1 ? 0 : 1). Used for aggregation in analytics.
 */
export function biweeklyPeriodKeyFromYYYYMMDD(
  s: string,
  options: { period1StartDay?: number; period1EndDay?: number } = {}
): number | null {
  const p = parseYYYYMMDD(s);
  if (!p) return null;
  const p1Start = Math.max(1, Math.min(31, options.period1StartDay ?? DEFAULT_BIWEEKLY_PERIOD1_START_DAY));
  const p1End = Math.max(1, Math.min(31, options.period1EndDay ?? DEFAULT_BIWEEKLY_PERIOD1_END_DAY));
  const lastDay = new Date(p.y, p.m, 0).getDate();
  const period1End = Math.min(Math.max(p1Start, p1End), lastDay);
  const period1Start = Math.min(p1Start, period1End);
  const inPeriod1 = p.d >= period1Start && p.d <= period1End;
  const periodHalf = inPeriod1 ? 0 : 1;
  return p.y * 24 + (p.m - 1) * 2 + periodHalf;
}

/**
 * Weekly period key: ordinal week number from epoch week 0 (weekStartDay 0=Sun, 1=Mon). Used for aggregation.
 */
export function weeklyPeriodKeyFromYYYYMMDD(s: string, weekStartDay: number = DEFAULT_WEEK_START_DAY): number | null {
  const p = parseYYYYMMDD(s);
  if (!p) return null;
  const date = new Date(p.y, p.m - 1, p.d);
  const dayOfWeek = date.getDay();
  const offset = (dayOfWeek - weekStartDay + 7) % 7;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - offset);
  const ms = weekStart.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor(ms / oneWeek);
}

/**
 * Effective period mode for a given date when we have a switch date (user chose "monthly from now on").
 * For dates before switchDate we use the previous mode (biweekly/weekly); on or after we use monthly.
 */
export function getEffectivePeriodMode(
  dateStr: string,
  mode: 'monthly' | 'biweekly' | 'weekly',
  switchDate: string | null,
  previousMode: 'biweekly' | 'weekly' | null = 'biweekly'
): 'monthly' | 'biweekly' | 'weekly' {
  if (mode !== 'monthly' || !switchDate) return mode;
  const p = parseYYYYMMDD(dateStr);
  const s = parseYYYYMMDD(switchDate);
  if (!p || !s) return mode;
  const d = p.y * 10000 + p.m * 100 + p.d;
  const sw = s.y * 10000 + s.m * 100 + s.d;
  return d < sw ? (previousMode ?? 'biweekly') : 'monthly';
}
