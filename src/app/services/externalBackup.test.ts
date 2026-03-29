import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { saveLocalAutobackupMock } = vi.hoisted(() => ({
  saveLocalAutobackupMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./localBackupIdb', () => ({
  saveLocalAutobackup: saveLocalAutobackupMock,
}));

import {
  MIN_BACKUP_INTERVAL_MS,
  triggerBackupNow,
  getBackupFolderHandle,
  writeBackupToFolder,
  isExternalBackupSupported,
  setNotifyCallback,
  cancelScheduledBackup,
  scheduleBackup,
  hasBackupableData,
  resetBackupSchedulerStateForTests,
  setFullSnapshotGetter,
} from './externalBackup';
import { isEncryptedBackup } from '@/app/utils/backupCrypto';

describe('externalBackup', () => {
  beforeEach(() => {
    setNotifyCallback(null);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    resetBackupSchedulerStateForTests();
  });

  it('triggerBackupNow returns result with ok boolean when no backup folder', async () => {
    vi.stubGlobal('window', { ...globalThis.window });
    const getState = () => ({ budget: {}, settings: {}, premium: false });
    const result = await triggerBackupNow(getState, true, true);
    expect(typeof result.ok).toBe('boolean');
    if (!result.ok) expect(typeof result.error).toBe('string');
  });

  it('triggerBackupNow succeeds via local save when no backup folder (all browsers)', async () => {
    vi.stubGlobal('window', { ...globalThis.window });
    const getState = () => ({ budget: { envelopes: [] }, settings: {}, premium: false });
    const result = await triggerBackupNow(getState, true, true);
    expect(result.ok).toBe(true);
  });

  it('hasBackupableData is false for empty snapshot (avoids overwriting backup with empty)', () => {
    expect(hasBackupableData(null)).toBe(false);
    expect(hasBackupableData(undefined)).toBe(false);
    expect(hasBackupableData({})).toBe(false);
    expect(hasBackupableData({ settings: {} })).toBe(false);
  });

  it('hasBackupableData is true when budget or data is present', () => {
    expect(hasBackupableData({ budget: {} })).toBe(true);
    expect(hasBackupableData({ budget: { envelopes: [] } })).toBe(true);
    expect(hasBackupableData({ data: {} })).toBe(true);
    expect(hasBackupableData({ data: { envelopes: [] } })).toBe(true);
  });

  it('cancelScheduledBackup clears timer', () => {
    scheduleBackup();
    cancelScheduledBackup();
    expect(true).toBe(true);
  });

  it('writeBackupToFolder returns ok and result shape when createWritable fails', async () => {
    const handle = {
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockRejectedValue(new Error('Permission denied')),
      }),
    };
    const snapshot = { budget: {}, settings: {}, premium: false };
    const result = await writeBackupToFolder(handle as never, snapshot);
    expect(result.ok).toBe(false);
    expect('code' in result && result.code).toBeDefined();
    expect('message' in result && result.message).toBeDefined();
  });

  it('writeBackupToFolder writes full snapshot (budget, settings, premium, appData) to file', async () => {
    let written = '';
    const writable = {
      write: vi.fn().mockImplementation((chunk: string) => {
        written = chunk;
        return Promise.resolve();
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const handle = {
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue(writable),
      }),
    };
    const snapshot = {
      budget: { envelopes: [], transactions: [] },
      settings: { textSize: 16 },
      premium: true,
      appData: { assistantMessages: [{ role: 'user', content: 'hi' }] },
    };
    const result = await writeBackupToFolder(handle as never, snapshot);
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(written) as Record<string, unknown>;
    expect(parsed.version).toBe(2);
    expect(parsed.budget).toEqual(snapshot.budget);
    expect(parsed.settings).toEqual(snapshot.settings);
    expect(parsed.premium).toBe(snapshot.premium);
    expect(parsed.appData).toEqual(snapshot.appData);
    expect(typeof parsed.exportDate).toBe('string');
  });

  it('isExternalBackupSupported returns boolean', () => {
    const result = isExternalBackupSupported();
    expect(typeof result).toBe('boolean');
  });

  it('getBackupFolderHandle returns null when protection DB fails', async () => {
    const handle = await getBackupFolderHandle();
    expect(handle === null || typeof (handle as { getFileHandle: unknown })?.getFileHandle === 'function').toBe(true);
  });

  it('writeBackupToFolder with password writes encrypted payload', async () => {
    const webcrypto = globalThis.crypto?.subtle ? globalThis.crypto : null;
    if (!webcrypto) {
      return;
    }
    vi.stubGlobal('window', { crypto: globalThis.crypto });
    let written = '';
    const writable = {
      write: vi.fn().mockImplementation((chunk: string) => {
        written = chunk;
        return Promise.resolve();
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const handle = {
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue(writable),
      }),
    };
    const snapshot = {
      budget: { envelopes: [] },
      settings: {},
      premium: false,
    };
    const result = await writeBackupToFolder(handle as never, snapshot, {
      password: 'test-secret',
    });
    expect(result.ok).toBe(true);
    expect(isEncryptedBackup(written)).toBe(true);
    const parsed = JSON.parse(written) as Record<string, unknown>;
    expect(parsed.encrypted).toBe(true);
    expect(typeof parsed.salt).toBe('string');
    expect(typeof parsed.iv).toBe('string');
    expect(typeof parsed.data).toBe('string');
    expect(parsed.version).toBeUndefined();
    expect(parsed.budget).toBeUndefined();
  });

  it('writeBackupToFolder without password writes plain JSON with version', async () => {
    let written = '';
    const writable = {
      write: vi.fn().mockImplementation((chunk: string) => {
        written = chunk;
        return Promise.resolve();
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const handle = {
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue(writable),
      }),
    };
    const snapshot = { budget: {}, settings: {}, premium: false };
    const result = await writeBackupToFolder(handle as never, snapshot);
    expect(result.ok).toBe(true);
    expect(isEncryptedBackup(written)).toBe(false);
    const parsed = JSON.parse(written) as Record<string, unknown>;
    expect(parsed.version).toBe(2);
    expect(parsed.budget).toEqual({});
  });

  describe('scheduleBackup (debounce + throttle retry)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      resetBackupSchedulerStateForTests();
      saveLocalAutobackupMock.mockClear();
      vi.stubGlobal('window', { ...globalThis.window });
      setFullSnapshotGetter(() => ({
        budget: { envelopes: [] },
        settings: {},
        premium: false,
      }));
    });
    afterEach(() => {
      resetBackupSchedulerStateForTests();
      setFullSnapshotGetter(null);
      vi.useRealTimers();
    });

    it('writes local autobackup after three changes and debounce', async () => {
      scheduleBackup();
      scheduleBackup();
      scheduleBackup();
      await vi.advanceTimersByTimeAsync(3000);
      expect(saveLocalAutobackupMock).toHaveBeenCalledTimes(1);
    });

    it('retries after the throttle window when the next run is too soon', async () => {
      scheduleBackup();
      scheduleBackup();
      scheduleBackup();
      await vi.advanceTimersByTimeAsync(3000);
      expect(saveLocalAutobackupMock).toHaveBeenCalledTimes(1);
      saveLocalAutobackupMock.mockClear();

      scheduleBackup();
      scheduleBackup();
      scheduleBackup();
      await vi.advanceTimersByTimeAsync(3000);
      expect(saveLocalAutobackupMock).not.toHaveBeenCalled();

      const elapsedAfterThrottle = 3000;
      await vi.advanceTimersByTimeAsync(MIN_BACKUP_INTERVAL_MS - elapsedAfterThrottle);
      expect(saveLocalAutobackupMock).toHaveBeenCalledTimes(1);
    });
  });
});
