export const PROTECTION_DB_NAME = 'nvalope-protection';
const DB_VERSION = 1;
export const STORE_FILE_HANDLES = 'file-handles';

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function openProtectionDB(): Promise<IDBDatabase> {
  if (!isAvailable()) return Promise.reject(new Error('indexedDB not available'));
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PROTECTION_DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILE_HANDLES)) {
        db.createObjectStore(STORE_FILE_HANDLES);
      }
    };
  });
}
