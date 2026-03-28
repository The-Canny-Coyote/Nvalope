import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getBackupFolderHandle, maybeShowBackupReminder } from '@/app/services/externalBackup';

/**
 * Tracks whether a backup folder is chosen and shows throttled reminder toasts (see maybeShowBackupReminder).
 */
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

  useEffect(() => {
    if (hasBackupFolder !== false) return;
    maybeShowBackupReminder((msg) => toast.info(msg, { duration: 6000 }));
  }, [hasBackupFolder]);

  useEffect(() => {
    if (selectedWheelSection !== 6 || hasBackupFolder !== false) return;
    maybeShowBackupReminder((msg) => toast.info(msg, { duration: 6000 }));
  }, [selectedWheelSection, hasBackupFolder]);

  return hasBackupFolder;
}
