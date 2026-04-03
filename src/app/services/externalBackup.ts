import { openProtectionDB, STORE_FILE_HANDLES } from './protectionDb';
import { encryptBackupPayload } from '@/app/utils/backupCrypto';
import { saveLocalAutobackup } from './localBackupIdb';
import { STORAGE_KEYS } from '@/app/constants/storageKeys';

const HANDLE_KEY = 'backup-dir';
const LAST_BACKUP_SUCCESS_KEY = STORAGE_KEYS.LAST_BACKUP_SUCCESS;

export const MIN_BACKUP_INTERVAL_MS = 60_000;

/** Returns the Unix timestamp (ms) of the last successful auto-backup, or 0 if never. */
export function getLastBackupSuccessTime(): number {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_SUCCESS_KEY);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

const BACKUP_FILENAME_PREFIX = 'nvalope-backup-';
const BACKUP_FILENAME_SUFFIX = '.json';
const FIRST_INPUT_KEY = STORAGE_KEYS.FIRST_INPUT;
const BACKUP_SUGGESTED_KEY = STORAGE_KEYS.BACKUP_SUGGESTED;
const BACKUP_DOWNLOAD_SUGGESTED_KEY = STORAGE_KEYS.BACKUP_DOWNLOAD_SUGGESTED;

export interface SettingsState {
  enabledModules?: string[];
  /** Separate from preset accessibility modes; see AppState.colorblindMode. */
  colorblindMode?: string;
  selectedMode?: string;
  textSize?: number;
  reducedMotion?: boolean;
  highContrast?: boolean;
  screenReaderMode?: boolean;
  lineHeight?: number;
  letterSpacing?: number;
  layoutScale?: number;
  wheelScale?: number;
  isPremiumLocal?: boolean;
  isPremium?: boolean;
  [key: string]: unknown;
}

export interface FullBackupSnapshot {
  budget?: unknown;
  settings?: SettingsState;
  premium?: boolean;
  appData?: unknown;
  /** Saved bank statement column templates and assignment rules (no transaction PII). */
  statementImport?: {
    templates: import('@/app/services/statementImport/statementTemplates').StatementTemplateRecord[];
    rules: import('@/app/services/statementImport/ruleEngine').AssignmentRule[];
  };
}

const BACKUP_ON_CHANGE_DEBOUNCE_MS = 3000;
const BACKUP_EVERY_N_CHANGES = 3;
const BACKUP_LATEST_FILENAME = 'nvalope-backup-latest.json';
let scheduleBackupDebounceTimer: ReturnType<typeof setTimeout> | null = null;
/** Retries scheduled backup after triggerBackupNow was throttled (min interval). */
let backupThrottleRetryTimer: ReturnType<typeof setTimeout> | null = null;
let changeCountSinceLastBackup = 0;

let fullSnapshotGetter: (() => FullBackupSnapshot) | null = null;
let notifyCallback: ((message: string) => void) | null = null;
let backupSuggestionToast: ((message: string) => void) | null = null;
let autobackupNotify: ((phase: 'start' | 'done' | 'error') => void) | null = null;
/** When encrypt backups is on, used by triggerBackupNow to get session password. Not persisted. */
let getBackupPassword: (() => string | null) | null = null;

export function setFullSnapshotGetter(getter: (() => FullBackupSnapshot) | null): void {
  fullSnapshotGetter = getter;
}
export function setBackupPasswordGetter(fn: (() => string | null) | null): void {
  getBackupPassword = fn;
}

export function setNotifyCallback(cb: ((message: string) => void) | null): void {
  notifyCallback = cb;
}

export function setAutobackupNotify(cb: ((phase: 'start' | 'done' | 'error') => void) | null): void {
  autobackupNotify = cb;
}

export function setBackupSuggestionToast(cb: ((message: string) => void) | null): void {
  backupSuggestionToast = cb;
}

export function notifyExternalBackupFolderLost(): void {
  notifyCallback?.(
    'Backup folder access was reset. Choose your backup folder again in Settings → Data Management to resume auto-backup.'
  );
}

// File System Access API: type for directory handle (not in all TS libs)
interface FileSystemDirectoryHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  return new Promise((resolve, reject) => {
    openProtectionDB().then((db) => {
      const tx = db.transaction(STORE_FILE_HANDLES, 'readwrite');
      tx.objectStore(STORE_FILE_HANDLES).put(handle, HANDLE_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    }, reject);
  });
}

export async function getBackupFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openProtectionDB();
    const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
      const req = db.transaction(STORE_FILE_HANDLES, 'readonly').objectStore(STORE_FILE_HANDLES).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle ?? null;
  } catch {
    return null;
  }
}

/**
 * Request user to choose a backup folder. Call from a user gesture (e.g. button click).
 * Returns true if a folder was chosen and saved.
 */
export async function requestBackupFolder(): Promise<boolean> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) return false;
  try {
    const picker = (window as unknown as { showDirectoryPicker: (opts?: { mode?: string; startIn?: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
    const handle = await picker({ mode: 'readwrite', startIn: 'documents' });
    await saveHandle(handle);
    return true;
  } catch {
    return false;
  }
}

export type BackupWriteErrorCode = 'FILE_CREATE_FAILED' | 'WRITE_FAILED' | 'FOLDER_ACCESS_LOST' | 'UNKNOWN';

/**
 * Write a backup JSON file to the chosen folder. Filename: nvalope-backup-YYYY-MM-DD-HHmmss.json
 * Includes budget, settings, premium, and appData (assistant messages, insights).
 * If options.password is set, the file is encrypted (password-protected).
 * Robust error handling: notifies callback on failure and returns error code.
 */
export async function writeBackupToFolder(
  handle: FileSystemDirectoryHandle,
  snapshot: FullBackupSnapshot | Record<string, unknown>,
  options?: { overwriteLatest?: boolean; password?: string }
): Promise<{ ok: true } | { ok: false; code: BackupWriteErrorCode; message: string }> {
  try {
    const overwriteLatest = options?.overwriteLatest === true;
    const password = options?.password;
    const filename = overwriteLatest
      ? BACKUP_LATEST_FILENAME
      : (() => {
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');
          const h = String(now.getHours()).padStart(2, '0');
          const min = String(now.getMinutes()).padStart(2, '0');
          const s = String(now.getSeconds()).padStart(2, '0');
          return `${BACKUP_FILENAME_PREFIX}${y}-${m}-${d}-${h}${min}${s}${BACKUP_FILENAME_SUFFIX}`;
        })();
    const backup =
      'budget' in snapshot && snapshot.budget !== undefined
        ? { exportDate: new Date().toISOString(), version: 2, ...snapshot, backupFolderChosen: true }
        : { exportDate: new Date().toISOString(), version: 1, data: snapshot, backupFolderChosen: true };
    const jsonPlain = JSON.stringify(backup, null, 2);
    let contents: string;
    if (password) {
      try {
        contents = await encryptBackupPayload(jsonPlain, password);
      } catch (e) {
        notifyCallback?.(e instanceof Error ? e.message : 'Encryption failed.');
        return { ok: false, code: 'UNKNOWN', message: e instanceof Error ? e.message : String(e) };
      }
    } else {
      contents = jsonPlain;
    }

    let fileHandle: FileSystemFileHandle;
    try {
      fileHandle = await handle.getFileHandle(filename, { create: true });
    } catch (e) {
      notifyCallback?.(
        'Could not create backup file in the chosen folder. Check folder permissions or try another folder.'
      );
      return { ok: false, code: 'FILE_CREATE_FAILED', message: e instanceof Error ? e.message : String(e) };
    }

    let writable: FileSystemWritableFileStream;
    try {
      writable = await (fileHandle as FileSystemFileHandle).createWritable();
    } catch (e) {
      notifyCallback?.('Backup folder access may have been revoked. Choose the folder again in Settings → Data Management.');
      return { ok: false, code: 'FOLDER_ACCESS_LOST', message: e instanceof Error ? e.message : String(e) };
    }

    try {
      await writable.write(contents);
      await writable.close();
      return { ok: true };
    } catch (e) {
      notifyCallback?.('Failed to write backup file. Disk may be full or the folder is read-only.');
      return { ok: false, code: 'WRITE_FAILED', message: e instanceof Error ? e.message : String(e) };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    notifyCallback?.('Backup failed. You can try again from Settings → Data Management.');
    return { ok: false, code: 'UNKNOWN', message };
  }
}

let lastBackupAttempt = 0;

function getSnapshot(getState: () => FullBackupSnapshot | Record<string, unknown>): FullBackupSnapshot | Record<string, unknown> {
  const full = fullSnapshotGetter?.();
  if (full && (full.budget !== undefined || (full.settings !== undefined) || full.premium !== undefined)) return full;
  return getState();
}

export function hasBackupableData(snapshot: FullBackupSnapshot | Record<string, unknown> | null | undefined): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const hasBudget =
    (snapshot as FullBackupSnapshot).budget != null &&
    typeof (snapshot as FullBackupSnapshot).budget === 'object';
  const hasLegacyData = 'data' in snapshot && (snapshot as Record<string, unknown>).data != null;
  return hasBudget || hasLegacyData;
}

export function startAutoBackup(_getState: () => FullBackupSnapshot | Record<string, unknown>): void {
  // Backup runs only on change (scheduleBackup/triggerBackupNow), not on a timer.
}

/**
 * Cancel any scheduled backup (e.g. on app unmount so we never run with a null getter).
 */
export function cancelScheduledBackup(): void {
  if (scheduleBackupDebounceTimer) {
    clearTimeout(scheduleBackupDebounceTimer);
    scheduleBackupDebounceTimer = null;
  }
  if (backupThrottleRetryTimer) {
    clearTimeout(backupThrottleRetryTimer);
    backupThrottleRetryTimer = null;
  }
}

/** Clears debounce timers and counters; used by Vitest only. */
export function resetBackupSchedulerStateForTests(): void {
  if (!import.meta.env.VITEST) return;
  cancelScheduledBackup();
  changeCountSinceLastBackup = 0;
  lastBackupAttempt = 0;
}

function attemptScheduledBackup(): void {
  const getState = () => fullSnapshotGetter?.() ?? {};
  void triggerBackupNow(getState, false).then((result) => {
    if (result.ok) {
      changeCountSinceLastBackup = 0;
      if (backupThrottleRetryTimer) {
        clearTimeout(backupThrottleRetryTimer);
        backupThrottleRetryTimer = null;
      }
      return;
    }
    if (result.error === 'Throttled') {
      const elapsed = Date.now() - lastBackupAttempt;
      const wait = Math.max(0, MIN_BACKUP_INTERVAL_MS - elapsed);
      if (backupThrottleRetryTimer) clearTimeout(backupThrottleRetryTimer);
      backupThrottleRetryTimer = setTimeout(() => {
        backupThrottleRetryTimer = null;
        attemptScheduledBackup();
      }, wait);
      return;
    }
    changeCountSinceLastBackup = 0;
  });
}

export function scheduleBackup(): void {
  changeCountSinceLastBackup += 1;
  if (scheduleBackupDebounceTimer) clearTimeout(scheduleBackupDebounceTimer);
  scheduleBackupDebounceTimer = setTimeout(() => {
    scheduleBackupDebounceTimer = null;
    if (changeCountSinceLastBackup >= BACKUP_EVERY_N_CHANGES) {
      attemptScheduledBackup();
    }
  }, BACKUP_ON_CHANGE_DEBOUNCE_MS);
}

/** Writes to folder or local autobackup; respects throttle, silent, and password via getBackupPassword or passwordOverride. */
export async function triggerBackupNow(
  getState: () => FullBackupSnapshot | Record<string, unknown>,
  force?: boolean,
  silent?: boolean,
  passwordOverride?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const now = Date.now();
  if (!force && now - lastBackupAttempt < MIN_BACKUP_INTERVAL_MS) return { ok: false, error: 'Throttled' };
  if (!silent) autobackupNotify?.('start');
  const rawSnapshot = getSnapshot(getState);
  if (!hasBackupableData(rawSnapshot)) {
    if (!silent) autobackupNotify?.('error');
    return { ok: false, error: 'No data to backup' };
  }
  lastBackupAttempt = now;
  const { enrichFullBackupWithStatementImport } = await import('@/app/services/statementImport/backupEnrich');
  const snapshot = await enrichFullBackupWithStatementImport(rawSnapshot as FullBackupSnapshot);
  const handle = await getBackupFolderHandle();
  if (handle) {
    const password = passwordOverride ?? getBackupPassword?.() ?? undefined;
    const result = await writeBackupToFolder(handle, snapshot as FullBackupSnapshot, {
      overwriteLatest: true,
      password,
    });
    if (result.ok) {
      try { localStorage.setItem(LAST_BACKUP_SUCCESS_KEY, String(Date.now())); } catch { /* ignore */ }
      if (!silent) autobackupNotify?.('done');
    } else {
      if (!silent) autobackupNotify?.('error');
    }
    if (!result.ok && result.code === 'FOLDER_ACCESS_LOST') {
      notifyExternalBackupFolderLost();
    }
    return result.ok ? { ok: true } : { ok: false, error: result.message };
  }
  // No folder (e.g. Firefox, Safari, or user has not chosen a folder): save locally so autobackup works on all browsers.
  try {
    await saveLocalAutobackup(snapshot as FullBackupSnapshot);
    try { localStorage.setItem(LAST_BACKUP_SUCCESS_KEY, String(Date.now())); } catch { /* ignore */ }
    if (!silent) autobackupNotify?.('done');
    return { ok: true };
  } catch (e) {
    if (!silent) autobackupNotify?.('error');
    const message = e instanceof Error ? e.message : 'Local backup failed';
    return { ok: false, error: message };
  }
}

export function stopAutoBackup(): void {
  cancelScheduledBackup();
}

export function isExternalBackupSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** Same structure we write to folder (v2 base; v3 adds optional statementImport). */
function buildBackupPayload(snapshot: FullBackupSnapshot, backupFolderChosen?: boolean): Record<string, unknown> {
  const hasStatementImport =
    snapshot.statementImport &&
    (snapshot.statementImport.templates.length > 0 || snapshot.statementImport.rules.length > 0);
  return {
    exportDate: new Date().toISOString(),
    version: hasStatementImport ? 3 : 2,
    budget: snapshot.budget,
    settings: snapshot.settings,
    premium: snapshot.premium,
    appData: snapshot.appData,
    ...(snapshot.statementImport && { statementImport: snapshot.statementImport }),
    ...(backupFolderChosen !== undefined && { backupFolderChosen }),
  };
}

export async function downloadFullBackup(
  snapshot: FullBackupSnapshot,
  options?: { password?: string }
): Promise<void> {
  if (typeof document === 'undefined' || !document.createElement) return;
  const { enrichFullBackupWithStatementImport } = await import('@/app/services/statementImport/backupEnrich');
  const enriched = await enrichFullBackupWithStatementImport(snapshot);
  const hasFolder = await getBackupFolderHandle().then((h) => !!h);
  const payload = buildBackupPayload(enriched, hasFolder);
  const jsonPlain = JSON.stringify(payload, null, 2);
  let contents: string;
  if (options?.password) {
    contents = await encryptBackupPayload(jsonPlain, options.password);
  } else {
    contents = jsonPlain;
  }
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const sec = String(now.getSeconds()).padStart(2, '0');
  const filename = `${BACKUP_FILENAME_PREFIX}${y}-${m}-${d}-${h}${min}${sec}${BACKUP_FILENAME_SUFFIX}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- First-input backup suggestion ---

function hasSuggestedBackupFolder(): boolean {
  try {
    return localStorage.getItem(BACKUP_SUGGESTED_KEY) === 'true';
  } catch {
    return true; // avoid repeated toasts if localStorage fails
  }
}

function setSuggestedBackupFolder(): void {
  try {
    localStorage.setItem(BACKUP_SUGGESTED_KEY, 'true');
  } catch {
    // ignore
  }
}

export function markBackupSuggestionDismissed(): void {
  setSuggestedBackupFolder();
  try {
    localStorage.setItem(BACKUP_DOWNLOAD_SUGGESTED_KEY, 'true');
  } catch {
    // ignore
  }
}

function hasSuggestedDownloadBackup(): boolean {
  try {
    return localStorage.getItem(BACKUP_DOWNLOAD_SUGGESTED_KEY) === 'true';
  } catch {
    return true;
  }
}

function setSuggestedDownloadBackup(): void {
  try {
    localStorage.setItem(BACKUP_DOWNLOAD_SUGGESTED_KEY, 'true');
  } catch {
    // ignore
  }
}

const BACKUP_REMINDER_KEY = STORAGE_KEYS.BACKUP_REMINDER;
const BACKUP_REMINDER_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Call occasionally (e.g. on app load or when opening Settings). Shows a friendly reminder
 * to back up or export if it's been at least 3 days since the last reminder.
 */
export function maybeShowBackupReminder(showToast: (message: string) => void): void {
  try {
    const raw = localStorage.getItem(BACKUP_REMINDER_KEY);
    const last = raw ? parseInt(raw, 10) : 0;
    if (Date.now() - last < BACKUP_REMINDER_INTERVAL_MS) return;
    localStorage.setItem(BACKUP_REMINDER_KEY, String(Date.now()));
    showToast(
      'Tip: After 3 changes, a backup copy is saved on this device (at most once per minute). To keep a file elsewhere, download a full backup or set a backup folder (Chrome/Edge) in Settings → Data Management.'
    );
  } catch {
    // ignore
  }
}

/**
 * Call when the user performs their first meaningful action (e.g. opens a section, adds income).
 * If backup is supported, no folder is set yet, and we haven't suggested before, shows a one-time toast
 * suggesting they set up a backup folder in Settings → Data Management.
 */
export function markFirstInput(): void {
  try {
    localStorage.setItem(FIRST_INPUT_KEY, 'true');
  } catch {
    return;
  }
  (async () => {
    if (!backupSuggestionToast) return;
    if (isExternalBackupSupported()) {
      const handle = await getBackupFolderHandle();
      if (handle) return;
      if (hasSuggestedBackupFolder()) return;
      setSuggestedBackupFolder();
      backupSuggestionToast(
        'Tip: After 3 changes, a copy is saved on this device (at most once per minute). To keep a file elsewhere, set a backup folder or download a backup in Settings → Data Management.'
      );
    } else {
      if (hasSuggestedDownloadBackup()) return;
      setSuggestedDownloadBackup();
      backupSuggestionToast(
        'Tip: After 3 changes, a copy is saved on this device (at most once per minute). Download a backup from Settings → Data Management to save a file elsewhere (e.g. USB drive).'
      );
    }
  })();
}
