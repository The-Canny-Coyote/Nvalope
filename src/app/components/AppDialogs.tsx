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
import { BackupFolderPrompt } from '@/app/components/BackupFolderPrompt';

export interface AppDialogsProps {
  // Backup folder prompt
  showBackupFolderPrompt: boolean;
  onBackupFolderPromptOpenChange: (open: boolean) => void;
  onBackupChooseFolder: () => Promise<boolean>;
  onBackupNoThanks: () => void;

  // Advanced AI download notice
  showAdvancedAIDownloadNotice: boolean;
  onAdvancedAIDownloadNoticeOpenChange: (open: boolean) => void;
  onAdvancedAIDownloadNoticeAck: () => void;
}

export function AppDialogs({
  showBackupFolderPrompt,
  onBackupFolderPromptOpenChange,
  onBackupChooseFolder,
  onBackupNoThanks,
  showAdvancedAIDownloadNotice,
  onAdvancedAIDownloadNoticeOpenChange,
  onAdvancedAIDownloadNoticeAck,
}: AppDialogsProps) {
  return (
    <>
      <BackupFolderPrompt
        open={showBackupFolderPrompt}
        onOpenChange={onBackupFolderPromptOpenChange}
        onChooseFolder={onBackupChooseFolder}
        onNoThanks={onBackupNoThanks}
      />
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
