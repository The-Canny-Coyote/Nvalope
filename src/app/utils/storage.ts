/**
 * Centralized localStorage helpers with try/catch and quota error handling.
 * Use for app preferences (layout scale, wheel scale, premium flag, etc.); no raw user data.
 */

const QUOTA_MESSAGE =
  'Storage limit reached. Try freeing space or clearing old data for this site.';
const STORAGE_UNAVAILABLE_MESSAGE = 'Storage is unavailable right now.';
const STORAGE_WRITE_FAILED_MESSAGE = 'Could not save your changes. Please try again.';
const STORAGE_REMOVE_FAILED_MESSAGE = 'Could not remove saved data. Please try again.';

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
    if (typeof window === 'undefined') return { ok: false, error: STORAGE_UNAVAILABLE_MESSAGE };
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      return { ok: false, error: QUOTA_MESSAGE };
    }
    void e;
    return { ok: false, error: STORAGE_WRITE_FAILED_MESSAGE };
  }
}

/**
 * Remove an item from localStorage.
 */
export function removeStorageItem(key: string): StorageResult {
  try {
    if (typeof window === 'undefined') return { ok: false, error: STORAGE_UNAVAILABLE_MESSAGE };
    localStorage.removeItem(key);
    return { ok: true };
  } catch (e) {
    void e;
    return { ok: false, error: STORAGE_REMOVE_FAILED_MESSAGE };
  }
}
