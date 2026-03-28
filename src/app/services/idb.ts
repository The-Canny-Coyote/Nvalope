export function isIdbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Open an IndexedDB database. Rejects if IndexedDB is unavailable or open fails.
 */
export function openIdb(
  dbName: string,
  version: number,
  onUpgradeNeeded: (db: IDBDatabase) => void
): Promise<IDBDatabase> {
  if (!isIdbAvailable()) {
    return Promise.reject(new Error('IndexedDB not available'));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, version);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => onUpgradeNeeded(req.result);
  });
}

const DEFAULT_RETRY_DELAY_MS = 100;

/**
 * Run an async function with retries. Useful for transient IDB failures.
 * @param fn Function to run (e.g. open DB and read)
 * @param opts maxRetries (default 3), delayMs between retries (default 100), isRetryable (if false, throw immediately)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; delayMs?: number; isRetryable?: (error: unknown) => boolean } = {}
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 3;
  const delayMs = opts.delayMs ?? DEFAULT_RETRY_DELAY_MS;
  const isRetryable = opts.isRetryable ?? (() => true);
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (!isRetryable(e) || attempt >= maxRetries - 1) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}
