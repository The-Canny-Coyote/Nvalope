import { toast } from "sonner";

type ToastType = "success" | "error" | "info";

let blocking = true;
const queue: Array<{ type: ToastType; message: string }> = [];

/** Base duration (ms); extra time per toast when multiple are shown. */
const BASE_DURATION_MS = 4000;
const EXTRA_DURATION_PER_TOAST_MS = 2500;

function processQueue() {
  if (blocking) return;
  const count = queue.length;
  const durationMs = BASE_DURATION_MS + count * EXTRA_DURATION_PER_TOAST_MS;
  while (queue.length > 0) {
    const item = queue.shift()!;
    toast[item.type](item.message, { duration: durationMs });
  }
}

/** Call from App when system-notification dialog open state changes. */
export function setToastBlocking(blocked: boolean) {
  blocking = blocked;
  processQueue();
}

/** Use instead of toast() so timer toasts only run after blocking dialogs are closed. */
export const delayedToast = {
  success: (message: string) => {
    queue.push({ type: "success", message });
    processQueue();
  },
  error: (message: string) => {
    queue.push({ type: "error", message });
    processQueue();
  },
  info: (message: string) => {
    queue.push({ type: "info", message });
    processQueue();
  },
};
