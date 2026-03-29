"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";

const BACKUP_PROMPT_SEEN_KEY = "nvalope-backup-prompt-seen";

export function getBackupPromptSeen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(BACKUP_PROMPT_SEEN_KEY) === "true";
  } catch {
    return true;
  }
}

export function setBackupPromptSeen(): void {
  try {
    localStorage.setItem(BACKUP_PROMPT_SEEN_KEY, "true");
  } catch {
    // ignore
  }
}

interface BackupFolderPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseFolder: () => Promise<boolean>;
  onNoThanks: () => void;
}

export function BackupFolderPrompt({
  open,
  onOpenChange,
  onChooseFolder,
  onNoThanks,
}: BackupFolderPromptProps) {
  const handleYes = async () => {
    const ok = await onChooseFolder();
    setBackupPromptSeen();
    onOpenChange(false);
    if (ok) {
      onNoThanks(); // no-op, but could show success toast from parent
    }
  };

  const handleNo = () => {
    setBackupPromptSeen();
    onOpenChange(false);
    onNoThanks();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Set autobackup folder?</AlertDialogTitle>
          <AlertDialogDescription>
            You can save your budget and settings to a folder on your device (or on an external storage device such as a USB drive or external disk). The app keeps one backup file there and updates it when autobackup runs (after about three changes you make, at most once per minute). If you clear &quot;cookies and other site data&quot; in your browser, the app&apos;s data and the local backup copy are deleted—but the <strong>files in your backup folder stay on your disk</strong> and are not removed. You would only need to choose the folder again in Settings so the app can write to it. You can turn on encrypted backups in Settings → Data Management so files are password-protected. Do you want to choose a folder now?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleNo}>No thanks</AlertDialogCancel>
          <AlertDialogAction onClick={handleYes}>Choose folder</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
