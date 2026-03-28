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
                  A new version is ready. A backup copy is saved on this device every 3 changes. For an extra copy elsewhere, use <strong>Download full backup</strong> or (Chrome/Edge) set a backup folder in Settings → Data Management.
                </p>
                <p>
                  You can <strong>Reload now</strong> to update. Your data and settings in this browser will remain after the reload. You can also close this and update later when you’re ready.
                </p>
                {hasBackupFolder === true && (
                  <p className="text-muted-foreground">
                    You have a backup folder set; your data is also saved there.
                  </p>
                )}
                {hasBackupFolder === false && isExternalBackupSupported && (
                  <p className="text-muted-foreground">
                    In Chrome or Edge you can set a backup folder in Settings → Data Management so a file is also saved there every 3 changes.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={onUpdateReload}>Reload now</AlertDialogAction>
            <button
              type="button"
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => onUpdateAvailableOpenChange(false)}
            >
              Close and update later
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showAdvancedAIDownloadNotice} onOpenChange={(open) => { if (!open) onAdvancedAIDownloadNoticeOpenChange(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Advanced AI — one-time download</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>
                  You will need to allow the app to download files for the new AI model. The app only reaches out to the server for this one task; after that, everything runs offline.
                </p>
                <p>
                  Please do not clear your browser cache or site data for this app, or the AI model and your data may be lost.
                </p>
                {hasBackupFolder === true && (
                  <p>
                    You have a backup folder set. One file there is updated every 3 changes. The files in that folder are on your disk and are not deleted if you clear &quot;cookies and other site data&quot;—you would only need to choose the folder again in Settings after clearing.
                  </p>
                )}
                {hasBackupFolder === false && (
                  <p>
                    A backup copy is saved on this device every 3 changes. If you clear &quot;cookies and other site data&quot; in your browser, that copy and all app data are removed. To keep a copy outside the app (e.g. on a USB drive), download a full backup from Settings → Data Management or set a backup folder (Chrome/Edge).
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={onAdvancedAIDownloadNoticeAck}>
              I understand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
