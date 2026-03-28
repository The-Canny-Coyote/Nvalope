import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBudget, setBudget, openDB, BudgetIdbError } from './budgetIdb';
import type { BudgetState } from '@/app/store/budgetTypes';
import { getDefaultBudgetState } from '@/app/store/budgetStore';

describe('budgetIdb', () => {
  let fakeStore: Record<string, unknown>;

  beforeEach(() => {
    fakeStore = {};
    vi.stubGlobal('indexedDB', {
      open: vi.fn((_name: string, _version: number) => {
        const req = {
          result: undefined as IDBDatabase | undefined,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          onblocked: null as (() => void) | null,
          onupgradeneeded: null as (() => void) | null,
        };
        const store = {
          get: () => {
            const r = { result: fakeStore['state'], onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
            setTimeout(() => r.onsuccess?.(), 0);
            return r;
          },
          put: (value: unknown, key: string) => {
            fakeStore[key] = value;
            const r = { oncomplete: null as (() => void) | null, onerror: null as (() => void) | null };
            setTimeout(() => { r.oncomplete?.(); tx.oncomplete?.(); }, 0);
            return r;
          },
        };
        const tx = {
          oncomplete: null as (() => void) | null,
          onerror: null as (() => void) | null,
          objectStore: () => store,
        };
        req.result = {
          objectStoreNames: { contains: () => true },
          transaction: () => tx as unknown as IDBTransaction,
          close: () => {},
        } as unknown as IDBDatabase;
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getBudget returns null when no data', async () => {
    const result = await getBudget();
    expect(result).toBeNull();
  });

  it('setBudget then getBudget roundtrips state', async () => {
    const state = getDefaultBudgetState();
    await setBudget(state);
    const loaded = await getBudget();
    expect(loaded).not.toBeNull();
    expect(loaded?.envelopes).toHaveLength(state.envelopes.length);
    expect(loaded?.transactions).toEqual(state.transactions);
  });

  it('setBudget throws BudgetIdbError when state is invalid', async () => {
    await expect(setBudget(null as unknown as BudgetState)).rejects.toThrow(BudgetIdbError);
    await expect(setBudget({} as BudgetState)).rejects.toThrow(BudgetIdbError);
    await expect(setBudget({ envelopes: 'not-array', transactions: [] } as unknown as BudgetState)).rejects.toThrow(BudgetIdbError);
  });

  it('BudgetIdbError has code VALIDATION_FAILED for invalid state', async () => {
    try {
      await setBudget({ envelopes: 1, transactions: [] } as unknown as BudgetState);
    } catch (e) {
      expect(e).toBeInstanceOf(BudgetIdbError);
      expect((e as BudgetIdbError).code).toBe('VALIDATION_FAILED');
    }
  });

  it('getBudget throws when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(getBudget()).rejects.toThrow(BudgetIdbError);
    try {
      await getBudget();
    } catch (e) {
      expect((e as BudgetIdbError).code).toBe('IDB_UNAVAILABLE');
    }
  });

  it('setBudget throws BudgetIdbError with IDB_QUOTA_EXCEEDED when write hits QuotaExceededError', async () => {
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
    vi.stubGlobal('indexedDB', {
      open: vi.fn((_name: string, _version: number) => {
        const req = {
          result: undefined as IDBDatabase | undefined,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          onblocked: null as (() => void) | null,
          onupgradeneeded: null as (() => void) | null,
        };
        const store = {
          put: () => {
            const r = { oncomplete: null as (() => void) | null, onerror: null as (() => void) | null };
            setTimeout(() => {
              tx.error = quotaError;
              tx.onerror?.();
            }, 0);
            return r;
          },
        };
        const tx = {
          oncomplete: null as (() => void) | null,
          onerror: null as (() => void) | null,
          error: null as unknown,
          objectStore: () => store,
        };
        req.result = {
          objectStoreNames: { contains: () => true },
          transaction: () => tx as unknown as IDBTransaction,
          close: () => {},
        } as unknown as IDBDatabase;
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
    });
    const state = getDefaultBudgetState();
    await expect(setBudget(state)).rejects.toThrow(BudgetIdbError);
    try {
      await setBudget(state);
    } catch (e) {
      expect((e as BudgetIdbError).code).toBe('IDB_QUOTA_EXCEEDED');
    }
  });

  it('openDB rejects with IDB_BLOCKED when onblocked fires', async () => {
    vi.stubGlobal('indexedDB', {
      open: vi.fn((_name: string, _version: number) => {
        const req = {
          result: undefined as IDBDatabase | undefined,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          onblocked: null as (() => void) | null,
          onupgradeneeded: null as (() => void) | null,
        };
        setTimeout(() => req.onblocked?.(), 0);
        return req;
      }),
    });
    await expect(openDB()).rejects.toThrow(BudgetIdbError);
    try {
      await openDB();
    } catch (e) {
      expect((e as BudgetIdbError).code).toBe('IDB_BLOCKED');
    }
  });
});
