"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";

export interface BackupPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the entered password. Caller is responsible for clearing sensitive state. */
  onSubmit: (password: string) => void;
  title: string;
  description: string;
  submitLabel?: string;
  /** When true, show a second field to confirm password (for "Set backup password" flow). */
  confirmPassword?: boolean;
}

export function BackupPasswordDialog({
  open,
  onOpenChange,
  onSubmit,
  title,
  description,
  submitLabel = "Continue",
  confirmPassword = false,
}: BackupPasswordDialogProps) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password.trim()) {
      setError("Enter a password.");
      return;
    }
    if (confirmPassword) {
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 8) {
        setError("Use at least 8 characters.");
        return;
      }
    }
    onSubmit(password);
    setPassword("");
    setConfirm("");
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPassword("");
      setConfirm("");
      setError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <p id="backup-password-desc">{description}</p>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backup-password">Password</Label>
            <Input
              id="backup-password"
              type="password"
              autoComplete={confirmPassword ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="backup-password-desc"
              aria-invalid={!!error}
            />
          </div>
          {confirmPassword && (
            <div className="space-y-2">
              <Label htmlFor="backup-password-confirm">Confirm password</Label>
              <Input
                id="backup-password-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={!!error}
              />
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
