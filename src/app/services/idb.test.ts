import { describe, it, expect } from 'vitest';
import { isIdbAvailable, withRetry } from './idb';

describe('idb', () => {
  describe('isIdbAvailable', () => {
    it('returns boolean', () => {
      expect(typeof isIdbAvailable()).toBe('boolean');
    });
  });

  describe('withRetry', () => {
    it('returns result when fn succeeds', async () => {
      const result = await withRetry(() => Promise.resolve(42));
      expect(result).toBe(42);
    });

    it('retries and succeeds on second attempt', async () => {
      let attempts = 0;
      const result = await withRetry(() => {
        attempts++;
        if (attempts < 2) return Promise.reject(new Error('transient'));
        return Promise.resolve('ok');
      }, { maxRetries: 3, delayMs: 1 });
      expect(result).toBe('ok');
      expect(attempts).toBe(2);
    });

    it('throws after maxRetries exhausted', async () => {
      await expect(
        withRetry(() => Promise.reject(new Error('fail')), { maxRetries: 2, delayMs: 1 })
      ).rejects.toThrow('fail');
    });

    it('does not retry when isRetryable returns false', async () => {
      const err = new Error('no retry');
      let attempts = 0;
      await expect(
        withRetry(
          () => {
            attempts++;
            return Promise.reject(err);
          },
          { maxRetries: 3, delayMs: 1, isRetryable: () => false }
        )
      ).rejects.toBe(err);
      expect(attempts).toBe(1);
    });
  });
});
