import React, { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Progress } from '@/app/components/ui/progress';

/**
 * Wraps PWA update check with a loading toast and a short minimum display time for the result.
 */
export function useCheckUpdatesToast(
  checkForUpdates: () => void,
  checkingForUpdate: boolean,
  updateAvailable: boolean
) {
  const checkForUpdatesToastShownRef = useRef(false);
  const checkForUpdatesStartTimeRef = useRef(0);

  const handleCheckForUpdates = useCallback(() => {
    checkForUpdatesToastShownRef.current = true;
    checkForUpdatesStartTimeRef.current = Date.now();
    toast.loading('Checking for updates…', {
      id: 'check-updates',
      description: React.createElement(Progress, { value: 0, className: 'mt-1.5 h-2.5 w-full min-w-[160px]' }),
    });
    checkForUpdates();
  }, [checkForUpdates]);

  useEffect(() => {
    if (!checkingForUpdate && checkForUpdatesToastShownRef.current) {
      checkForUpdatesToastShownRef.current = false;
      const elapsed = Date.now() - checkForUpdatesStartTimeRef.current;
      const minDisplayMs = 600;
      const delayDismiss = Math.max(0, minDisplayMs - elapsed);
      const dismissAndShowResult = () => {
        toast.dismiss('check-updates');
        if (!updateAvailable) toast.info("You're up to date.");
      };
      if (delayDismiss > 0) setTimeout(dismissAndShowResult, delayDismiss);
      else dismissAndShowResult();
    }
  }, [checkingForUpdate, updateAvailable]);

  return { handleCheckForUpdates };
}
