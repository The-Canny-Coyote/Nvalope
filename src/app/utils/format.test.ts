import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate } from './format';

describe('formatMoney', () => {
  it('formats positive number as USD', () => {
    expect(formatMoney(1234.56)).toBe('$1,234.56');
  });

  it('formats zero', () => {
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('formats negative number', () => {
    expect(formatMoney(-100)).toContain('-');
    expect(formatMoney(-100)).toContain('100');
  });

  it('rounds to two decimals', () => {
    expect(formatMoney(10.999)).toBe('$11.00');
  });
});

describe('formatDate', () => {
  it('formats a date-only ISO string without timezone off-by-one', () => {
    // new Date('2026-04-15') parses as UTC midnight — in UTC-5 that renders as Apr 14.
    // The fix appends T12:00:00 so local noon is used regardless of timezone.
    const result = formatDate('2026-04-15');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });

  it('returns the raw string on invalid input', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});
