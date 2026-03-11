/**
 * Centralized localStorage helpers with try/catch and quota error handling.
 * Use for app preferences (layout scale, wheel scale, premium flag, etc.); no raw user data.
 */

const QUOTA_MESSAGE =
  'Storage limit reached. Try freeing space or clearing old data for this site.';

export interface StorageResult {
  ok: boolean;
  error?: string;
}

/**
 * Read a string from localStorage. Returns null if missing or on error.
 */
export function getStorageItem(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Write a string to localStorage. Catches QuotaExceededError and returns a user-facing message.
 */
export function setStorageItem(key: string, value: string): StorageResult {
  try {
    if (typeof window === 'undefined') return { ok: false, error: 'Unavailable' };
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      return { ok: false, error: QUOTA_MESSAGE };
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Storage write failed' };
  }
}

/**
 * Remove an item from localStorage.
 */
export function removeStorageItem(key: string): StorageResult {
  try {
    if (typeof window === 'undefined') return { ok: false, error: 'Unavailable' };
    localStorage.removeItem(key);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Storage remove failed' };
  }
}
