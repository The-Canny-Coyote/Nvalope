import { describe, expect, it } from 'vitest';
import { allocateTotalProportionally } from './receiptAllocation';

describe('allocateTotalProportionally', () => {
  it('allocates proportionally and sums to target', () => {
    const items = [{ amount: 40 }, { amount: 60 }];
    const out = allocateTotalProportionally({ items, totalToAllocate: 106 });
    expect(out).toEqual([42.4, 63.6]);
    expect(out.reduce((s, v) => s + v, 0)).toBe(106);
  });

  it('handles rounding remainder by assigning to largest line', () => {
    const items = [{ amount: 1 }, { amount: 1 }, { amount: 1 }];
    const out = allocateTotalProportionally({ items, totalToAllocate: 10 });
    expect(out.reduce((s, v) => s + v, 0)).toBe(10);
    // two should be equal, one should absorb remainder
    expect(new Set(out).size).toBeGreaterThanOrEqual(2);
  });

  it('returns zeros when base sum is invalid', () => {
    expect(allocateTotalProportionally({ items: [], totalToAllocate: 10 })).toEqual([]);
    expect(allocateTotalProportionally({ items: [{ amount: 0 }], totalToAllocate: 10 })).toEqual([0]);
  });
});

