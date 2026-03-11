import { describe, it, expect } from 'vitest';
import { formatMoney } from './format';

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
