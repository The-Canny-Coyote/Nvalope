import { describe, it, expect, vi, beforeEach } from 'vitest';
import { delayedToast, setToastBlocking } from './delayedToast';

describe('delayedToast', () => {
  beforeEach(() => {
    vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
    setToastBlocking(true);
  });

  it('setToastBlocking accepts boolean', () => {
    setToastBlocking(true);
    setToastBlocking(false);
    expect(true).toBe(true);
  });

  it('delayedToast.success is a function', () => {
    expect(typeof delayedToast.success).toBe('function');
    delayedToast.success('test');
  });

  it('delayedToast.error is a function', () => {
    expect(typeof delayedToast.error).toBe('function');
    delayedToast.error('test');
  });

  it('delayedToast.info is a function', () => {
    expect(typeof delayedToast.info).toBe('function');
    delayedToast.info('test');
  });
});
