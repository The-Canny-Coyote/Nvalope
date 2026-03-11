/**
 * Budget persistence in IndexedDB. No migration; production-ready from clean state.
 * All data stays on-device.
 */

import type { BudgetState } from '@/app/store/budgetTypes';
import { withRetry, isIdbAvailable } from './idb';

export const DB_NAME = 'nvalope-db';
const DB_VERSION = 2;
const STORE_BUDGET = 'budget';
export const STORE_APP_DATA = 'appData';
const BUDGET_KEY = 'state';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

export type BudgetIdbErrorCode =
  | 'IDB_UNAVAILABLE'
  | 'IDB_OPEN_FAILED'
  | 'IDB_READ_FAILED'
  | 'IDB_WRITE_FAILED'
  | 'IDB_QUOTA_EXCEEDED'
  | 'IDB_BLOCKED'
  | 'VALIDATION_FAILED';

export class BudgetIdbError extends Error {
  constructor(
    message: string,
    public code: BudgetIdbErrorCode,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'BudgetIdbError';
  }
}

export function openDB(): Promise<IDBDatabase> {
  if (!isIdbAvailable()) {
    return Promise.reject(new BudgetIdbError('IndexedDB not available', 'IDB_UNAVAILABLE'));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => {
      const err = req.error;
      const code: BudgetIdbErrorCode = err?.name === 'QuotaExceededError' ? 'IDB_QUOTA_EXCEEDED' : err?.name === 'BlockedError' ? 'IDB_BLOCKED' : 'IDB_OPEN_FAILED';
      reject(new BudgetIdbError(err?.message ?? 'Failed to open database', code, err));
    };
    req.onsuccess = () => resolve(req.result);
    req.onblocked = () => reject(new BudgetIdbError('Database upgrade blocked (close other tabs)', 'IDB_BLOCKED'));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_BUDGET)) db.createObjectStore(STORE_BUDGET);
      if (!db.objectStoreNames.contains(STORE_APP_DATA)) db.createObjectStore(STORE_APP_DATA);
    };
  });
}

function validateState(parsed: unknown): parsed is BudgetState {
  if (!parsed || typeof parsed !== 'object') return false;
  const o = parsed as Record<string, unknown>;
  if (!Array.isArray(o.envelopes) || !Array.isArray(o.transactions)) return false;
  return true;
}

/**
 * Get budget state from IndexedDB only. No migration.
 * Retries up to MAX_RETRIES on transient failures.
 * Returns null if no data or empty DB; throws BudgetIdbError on unrecoverable failure.
 */
export async function getBudget(): Promise<BudgetState | null> {
  try {
    return await withRetry(
      async () => {
        const db = await openDB();
        const state = await new Promise<BudgetState | undefined>((resolve, reject) => {
          const tx = db.transaction(STORE_BUDGET, 'readonly');
          const req = tx.objectStore(STORE_BUDGET).get(BUDGET_KEY);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        db.close();
        if (state && validateState(state)) return state as BudgetState;
        return null;
      },
      {
        maxRetries: MAX_RETRIES,
        delayMs: RETRY_DELAY_MS,
        isRetryable: (e) =>
          !(e instanceof BudgetIdbError && ['IDB_UNAVAILABLE', 'IDB_BLOCKED', 'IDB_QUOTA_EXCEEDED'].includes(e.code)),
      }
    );
  } catch (e) {
    if (e instanceof BudgetIdbError) throw e;
    throw new BudgetIdbError(
      e instanceof Error ? e.message : 'Failed to read budget',
      'IDB_READ_FAILED',
      e
    );
  }
}

/**
 * Save budget state to IndexedDB. Throws BudgetIdbError on failure (e.g. quota exceeded).
 */
export async function setBudget(state: BudgetState): Promise<void> {
  if (!validateState(state)) {
    throw new BudgetIdbError('Invalid budget state', 'VALIDATION_FAILED');
  }
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BUDGET, 'readwrite');
      tx.objectStore(STORE_BUDGET).put(state, BUDGET_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        const err = tx.error;
        const code: BudgetIdbErrorCode = err?.name === 'QuotaExceededError' ? 'IDB_QUOTA_EXCEEDED' : 'IDB_WRITE_FAILED';
        reject(new BudgetIdbError(err?.message ?? 'Failed to write', code, err));
      };
    });
    db.close();
  } catch (e) {
    if (e instanceof BudgetIdbError) throw e;
    throw new BudgetIdbError(e instanceof Error ? e.message : 'Failed to save budget', 'IDB_WRITE_FAILED', e);
  }
}
