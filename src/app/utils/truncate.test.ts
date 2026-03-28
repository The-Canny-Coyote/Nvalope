import { describe, it, expect } from 'vitest';
import { truncate } from './truncate';

describe('truncate', () => {
  it('returns short text unchanged', () => {
    const short = 'How much have I spent?';
    expect(truncate(short, 2000)).toBe(short);
  });

  it('returns text at exactly maxLength unchanged', () => {
    const exact = 'x'.repeat(2000);
    expect(truncate(exact, 2000)).toBe(exact);
    expect(truncate(exact, 2000).length).toBe(2000);
  });

  it('truncates long text to maxLength plus ellipsis', () => {
    const long = 'y'.repeat(3000);
    const out = truncate(long, 2000);
    expect(out.length).toBe(2001);
    expect(out.slice(0, 2000)).toBe('y'.repeat(2000));
    expect(out.slice(-1)).toBe('…');
  });
});
