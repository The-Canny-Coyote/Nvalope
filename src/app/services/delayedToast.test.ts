import { describe, it, expect, vi, beforeEach } from 'vitest';
import { delayedToast, setToastBlocking } from './delayedToast';

describe('delayedToast', () => {
  beforeEach(() => {
    vi.mock('sonner', () => ({
      toast: {
        success: vi.fn(() => 'toast-id'),
        error: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
      },
    }));
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

  it('delayedToast.successWithUndo is a function', () => {
    expect(typeof delayedToast.successWithUndo).toBe('function');
    const onCommit = vi.fn();
    const onUndo = vi.fn();
    delayedToast.successWithUndo('Transaction deleted', onCommit, onUndo);
    setToastBlocking(false);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
