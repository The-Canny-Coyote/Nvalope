import { openIdb, isIdbAvailable } from './idb';

const DB_NAME = 'nvalope-autobackup';
const DB_VERSION = 1;
const STORE_NAME = 'snapshot';
const KEY = 'latest';

/** Same shape as FullBackupSnapshot; kept local to avoid circular dependency. */
export interface LocalBackupSnapshot {
  budget?: unknown;
  settings?: unknown;
  premium?: boolean;
  appData?: unknown;
}

export interface LocalBackupEntry {
  savedAt: string; // ISO string
  snapshot: LocalBackupSnapshot;
}

export async function saveLocalAutobackup(snapshot: LocalBackupSnapshot): Promise<void> {
  if (!isIdbAvailable()) return;
  const db = await openIdb(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  });
  const entry: LocalBackupEntry = {
    savedAt: new Date().toISOString(),
    snapshot,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry, KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getLocalAutobackup(): Promise<LocalBackupEntry | null> {
  if (!isIdbAvailable()) return null;
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, (db) => {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    });
    const entry = await new Promise<LocalBackupEntry | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(tx.error);
    });
    db.close();
    return entry ?? null;
  } catch {
    return null;
  }
}
