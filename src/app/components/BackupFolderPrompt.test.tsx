import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getBackupPromptSeen, setBackupPromptSeen } from './BackupFolderPrompt';
import { STORAGE_KEYS } from '@/app/constants/storageKeys';

const KEY = STORAGE_KEYS.BACKUP_PROMPT_SEEN;

describe('BackupFolderPrompt', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getBackupPromptSeen returns false when not set', () => {
    expect(getBackupPromptSeen()).toBe(false);
  });

  it('setBackupPromptSeen then getBackupPromptSeen returns true', () => {
    setBackupPromptSeen();
    expect(getBackupPromptSeen()).toBe(true);
  });

  it('getBackupPromptSeen returns true when localStorage has value', () => {
    localStorage.setItem(KEY, 'true');
    expect(getBackupPromptSeen()).toBe(true);
  });
});
