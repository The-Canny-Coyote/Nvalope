import { describe, expect, it } from 'vitest';
import { allocateTotalProportionally } from '@/app/services/receiptAllocation';
import { roundTo2 } from '@/app/utils/format';

function sum(xs: number[]): number {
  return roundTo2(xs.reduce((s, x) => s + x, 0));
}

describe('allocateTotalProportionally correctness', () => {
  it('reconciles exactly to target (basic)', () => {
    const out = allocateTotalProportionally({
      items: [{ amount: 1 }, { amount: 2 }, { amount: 3 }],
      totalToAllocate: 12.34,
    });
    expect(sum(out)).toBe(roundTo2(12.34));
  });

  it('handles small deltas without losing cents', () => {
    const out = allocateTotalProportionally({
      items: [{ amount: 9.99 }, { amount: 0.01 }],
      totalToAllocate: 10.01,
    });
    expect(sum(out)).toBe(10.01);
    for (const v of out) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('zero/invalid baseSum returns zeros', () => {
    const out = allocateTotalProportionally({
      items: [{ amount: 0 }, { amount: 0 }],
      totalToAllocate: 10,
    });
    expect(out).toEqual([0, 0]);
  });

  it('randomized reconciliation sweep (catches rounding regressions)', () => {
    for (let n = 2; n <= 25; n++) {
      const items = Array.from({ length: n }, (_, i) => ({ amount: i + 1 }));
      const total = 100 + n / 10;
      const out = allocateTotalProportionally({ items, totalToAllocate: total });
      expect(sum(out)).toBe(roundTo2(total));
      out.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    }
  });
});

