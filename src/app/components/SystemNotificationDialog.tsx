"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";

interface SystemNotificationDialogProps {
  open: boolean;
  message: string | null;
  onAcknowledge: () => void;
}

/** Shows one system notification at a time; user must click Acknowledge to dismiss and see the next. */
export function SystemNotificationDialog({
  open,
  message,
  onAcknowledge,
}: SystemNotificationDialogProps) {
  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Notification</DialogTitle>
          <DialogDescription className="text-left pt-1">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onAcknowledge}>Acknowledge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
