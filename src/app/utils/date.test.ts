import { describe, it, expect } from 'vitest';
import {
  parseYYYYMMDD,
  monthKeyFromYYYYMMDD,
  isDateInPeriod,
  getPeriodForDate,
  getPeriodLabel,
  getDaysLeftInPeriod,
  biweeklyPeriodKeyFromYYYYMMDD,
  weeklyPeriodKeyFromYYYYMMDD,
  getEffectivePeriodMode,
} from './date';

describe('getPeriodForDate', () => {
  it('returns full month for monthly mode', () => {
    const period = getPeriodForDate('2025-01-15', 'monthly');
    expect(period).toEqual({ start: '2025-01-01', end: '2025-01-31' });
  });

  it('returns period 1 (1-14) for biweekly when date in first half', () => {
    const period = getPeriodForDate('2025-01-10', 'biweekly');
    expect(period).toEqual({ start: '2025-01-01', end: '2025-01-14' });
  });

  it('returns period 2 (15-end) for biweekly when date in second half', () => {
    const period = getPeriodForDate('2025-01-20', 'biweekly');
    expect(period).toEqual({ start: '2025-01-15', end: '2025-01-31' });
  });

  it('returns period 1 for biweekly on day 14', () => {
    const period = getPeriodForDate('2025-02-14', 'biweekly');
    expect(period).toEqual({ start: '2025-02-01', end: '2025-02-14' });
  });

  it('returns period 2 for biweekly on day 15', () => {
    const period = getPeriodForDate('2025-02-15', 'biweekly');
    expect(period).toEqual({ start: '2025-02-15', end: '2025-02-28' });
  });

  it('returns null for invalid date', () => {
    expect(getPeriodForDate('invalid', 'monthly')).toBeNull();
    expect(getPeriodForDate('2025-13-01', 'monthly')).toBeNull();
  });

  it('returns biweekly period 1 with custom start/end (5-18)', () => {
    const period = getPeriodForDate('2025-01-10', 'biweekly', { period1StartDay: 5, period1EndDay: 18 });
    expect(period).toEqual({ start: '2025-01-05', end: '2025-01-18' });
  });

  it('returns biweekly period 2 with custom start/end (5-18)', () => {
    const period = getPeriodForDate('2025-01-25', 'biweekly', { period1StartDay: 5, period1EndDay: 18 });
    expect(period).toEqual({ start: '2025-01-19', end: '2025-01-31' });
  });

  it('returns weekly period containing the date (Sun start)', () => {
    const period = getPeriodForDate('2025-01-15', 'weekly', { weekStartDay: 0 });
    expect(period).toBeTruthy();
    expect(period!.start).toBe('2025-01-12');
    expect(period!.end).toBe('2025-01-18');
  });

  it('returns weekly period (Mon start)', () => {
    const period = getPeriodForDate('2025-01-15', 'weekly', { weekStartDay: 1 });
    expect(period).toBeTruthy();
    expect(period!.start).toBe('2025-01-13');
    expect(period!.end).toBe('2025-01-19');
  });
});

describe('isDateInPeriod', () => {
  it('returns true when date is within start and end', () => {
    expect(isDateInPeriod('2025-01-10', '2025-01-01', '2025-01-14')).toBe(true);
    expect(isDateInPeriod('2025-01-01', '2025-01-01', '2025-01-14')).toBe(true);
    expect(isDateInPeriod('2025-01-14', '2025-01-01', '2025-01-14')).toBe(true);
  });

  it('returns false when date is outside range', () => {
    expect(isDateInPeriod('2025-01-15', '2025-01-01', '2025-01-14')).toBe(false);
    expect(isDateInPeriod('2024-12-31', '2025-01-01', '2025-01-14')).toBe(false);
  });

  it('returns false for invalid date', () => {
    expect(isDateInPeriod('bad', '2025-01-01', '2025-01-14')).toBe(false);
  });
});

describe('getPeriodLabel', () => {
  it('returns month year for monthly', () => {
    expect(getPeriodLabel({ start: '2025-01-01', end: '2025-01-31' }, 'monthly')).toBe('Jan 2025');
  });

  it('returns period 1 label for biweekly first half', () => {
    expect(getPeriodLabel({ start: '2025-01-01', end: '2025-01-14' }, 'biweekly')).toBe(
      'Period 1 (Jan 1–14)'
    );
  });

  it('returns period 2 label for biweekly second half', () => {
    expect(getPeriodLabel({ start: '2025-01-15', end: '2025-01-31' }, 'biweekly')).toBe(
      'Period 2 (Jan 15–31)'
    );
  });

  it('returns weekly label for same month', () => {
    expect(getPeriodLabel({ start: '2025-01-05', end: '2025-01-11' }, 'weekly')).toContain('Week of');
    expect(getPeriodLabel({ start: '2025-01-05', end: '2025-01-11' }, 'weekly')).toContain('Jan 5–11');
  });
});

describe('getDaysLeftInPeriod', () => {
  it('returns days from reference to end', () => {
    const period = { start: '2025-01-01', end: '2025-01-14' };
    expect(getDaysLeftInPeriod(period, new Date(2025, 0, 10))).toBe(4); // 10->14 = 4 days
    expect(getDaysLeftInPeriod(period, new Date(2025, 0, 14))).toBe(0);
    expect(getDaysLeftInPeriod(period, new Date(2025, 0, 15))).toBe(0);
  });
});

describe('biweeklyPeriodKeyFromYYYYMMDD', () => {
  it('returns same key for dates in period 1 (default 1-14)', () => {
    const k1 = biweeklyPeriodKeyFromYYYYMMDD('2025-01-01');
    const k2 = biweeklyPeriodKeyFromYYYYMMDD('2025-01-14');
    expect(k1).toBe(k2);
    expect(k1).toBe(2025 * 24 + 0 * 2 + 0);
  });

  it('returns same key for dates in period 2 (default)', () => {
    const k1 = biweeklyPeriodKeyFromYYYYMMDD('2025-01-15');
    const k2 = biweeklyPeriodKeyFromYYYYMMDD('2025-01-31');
    expect(k1).toBe(k2);
    expect(k1).toBe(2025 * 24 + 0 * 2 + 1);
  });

  it('returns same key for custom period 1 (5-18)', () => {
    const opts = { period1StartDay: 5, period1EndDay: 18 };
    const k1 = biweeklyPeriodKeyFromYYYYMMDD('2025-01-05', opts);
    const k2 = biweeklyPeriodKeyFromYYYYMMDD('2025-01-18', opts);
    expect(k1).toBe(k2);
  });

  it('returns null for invalid date', () => {
    expect(biweeklyPeriodKeyFromYYYYMMDD('invalid')).toBeNull();
  });
});

describe('weeklyPeriodKeyFromYYYYMMDD', () => {
  it('returns same key for dates in same week (Sun start)', () => {
    const k1 = weeklyPeriodKeyFromYYYYMMDD('2025-01-12', 0);
    const k2 = weeklyPeriodKeyFromYYYYMMDD('2025-01-18', 0);
    expect(k1).toBe(k2);
  });

  it('returns null for invalid date', () => {
    expect(weeklyPeriodKeyFromYYYYMMDD('invalid')).toBeNull();
  });
});

describe('getEffectivePeriodMode', () => {
  it('returns mode when no switch date', () => {
    expect(getEffectivePeriodMode('2025-01-10', 'monthly', null)).toBe('monthly');
    expect(getEffectivePeriodMode('2025-01-10', 'biweekly', null)).toBe('biweekly');
  });
  it('returns biweekly for dates before switch when mode is monthly', () => {
    expect(getEffectivePeriodMode('2025-01-10', 'monthly', '2025-02-01')).toBe('biweekly');
  });
  it('returns monthly for dates on or after switch when mode is monthly', () => {
    expect(getEffectivePeriodMode('2025-02-01', 'monthly', '2025-02-01')).toBe('monthly');
    expect(getEffectivePeriodMode('2025-02-15', 'monthly', '2025-02-01')).toBe('monthly');
  });
});

describe('parseYYYYMMDD and monthKeyFromYYYYMMDD', () => {
  it('parseYYYYMMDD validates and parses', () => {
    expect(parseYYYYMMDD('2025-01-15')).toEqual({ y: 2025, m: 1, d: 15 });
    expect(parseYYYYMMDD('2025-13-01')).toBeNull();
    expect(parseYYYYMMDD('2025-02-30')).toBeNull();
  });

  it('monthKeyFromYYYYMMDD returns year*12 + (month-1)', () => {
    expect(monthKeyFromYYYYMMDD('2025-01-15')).toBe(2025 * 12 + 0);
    expect(monthKeyFromYYYYMMDD('2025-12-01')).toBe(2025 * 12 + 11);
  });
});
