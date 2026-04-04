/**
 * Tracks whether a backup folder is chosen.
 */

import { useEffect, useState } from 'react';
import { getBackupFolderHandle } from '@/app/services/externalBackup';

export function useBackupFolderReminders(selectedWheelSection: number | null, showAdvancedAIDownloadNotice: boolean) {
  const [hasBackupFolder, setHasBackupFolder] = useState<boolean | null>(null);

  useEffect(() => {
    const refresh = () => {
      getBackupFolderHandle().then((handle) => {
        setHasBackupFolder(!!handle);
      });
    };
    refresh();
    const onBackupFolderUpdated = () => refresh();
    window.addEventListener('nvalope-backup-folder-updated', onBackupFolderUpdated);
    return () => {
      window.removeEventListener('nvalope-backup-folder-updated', onBackupFolderUpdated);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getBackupFolderHandle().then((handle) => {
      if (!cancelled) setHasBackupFolder(!!handle);
    });
    return () => {
      cancelled = true;
    };
  }, [showAdvancedAIDownloadNotice]);

  // selectedWheelSection param kept for caller API compat
  void selectedWheelSection;

  return hasBackupFolder;
}
