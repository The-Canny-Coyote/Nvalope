/**
 * Centralized app-level dialogs: Backup folder prompt and AlertDialogs
 * (update available, offline ready, Advanced AI download). State and handlers
 * stay in App; this component is presentational.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Button } from '@/app/components/ui/button';
import { BackupFolderPrompt } from '@/app/components/BackupFolderPrompt';

export interface AppDialogsProps {
  // Backup folder prompt
  showBackupFolderPrompt: boolean;
  onBackupFolderPromptOpenChange: (open: boolean) => void;
  onBackupChooseFolder: () => Promise<boolean>;
  onBackupNoThanks: () => void;

  // Update available
  updateAvailable: boolean;
  onUpdateAvailableOpenChange: (open: boolean) => void;
  onUpdateReload: () => void;

  // Advanced AI download notice
  showAdvancedAIDownloadNotice: boolean;
  onAdvancedAIDownloadNoticeOpenChange: (open: boolean) => void;
  onAdvancedAIDownloadNoticeAck: () => void;
  hasBackupFolder: boolean | null;
  isExternalBackupSupported: boolean;
}

export function AppDialogs({
  showBackupFolderPrompt,
  onBackupFolderPromptOpenChange,
  onBackupChooseFolder,
  onBackupNoThanks,
  updateAvailable,
  onUpdateAvailableOpenChange,
  onUpdateReload,
  showAdvancedAIDownloadNotice,
  onAdvancedAIDownloadNoticeOpenChange,
  onAdvancedAIDownloadNoticeAck,
  hasBackupFolder,
  isExternalBackupSupported,
}: AppDialogsProps) {
  return (
    <>
      <BackupFolderPrompt
        open={showBackupFolderPrompt}
        onOpenChange={onBackupFolderPromptOpenChange}
        onChooseFolder={onBackupChooseFolder}
        onNoThanks={onBackupNoThanks}
      />
      <AlertDialog open={updateAvailable} onOpenChange={(open) => { if (!open) onUpdateAvailableOpenChange(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update available</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>
                  A new version of Nvalope is ready.
                </p>
                <p>
                  Your data and settings will remain after the reload.
                </p>
                {hasBackupFolder === true && (
                  <p className="text-muted-foreground">
                    You have a backup folder set; your data is also saved there.
                  </p>
                )}
                {hasBackupFolder === false && isExternalBackupSupported && (
                  <p className="text-muted-foreground">
                    In Chrome or Edge you can set a backup folder in Settings → Data Management so a file is also saved there when autobackup runs (3 changes, at most once per minute).
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={onUpdateReload}>Reload now</AlertDialogAction>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onUpdateAvailableOpenChange(false)}
            >
              Close and update later
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showAdvancedAIDownloadNotice} onOpenChange={(open) => { if (!open) onAdvancedAIDownloadNoticeOpenChange(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Local AI model — one-time download</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>
                  The app will download a small AI model to your device. This is a one-time download of several hundred MB. After that, the assistant runs entirely offline.
                </p>
                <p>
                  Note: clearing browser site data will remove the downloaded model and your app data. Use Settings → Data Management to keep an external backup.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={onAdvancedAIDownloadNoticeAck}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
