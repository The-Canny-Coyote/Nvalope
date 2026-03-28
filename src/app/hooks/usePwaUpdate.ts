/**
 * PWA update detection: registers the service worker and exposes state/callbacks
 * for "update available" and "ready to work offline" prompts.
 *
 * When the user confirms reload, the plugin's callback runs: it tells the new
 * service worker to take over (skipWaiting) and then reloads the page. The next
 * load uses the new worker and cached assets. localStorage/IndexedDB (budget,
 * settings, app store) are not touched, so user data and settings stay intact.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UsePwaUpdateReturn {
  updateAvailable: boolean;
  setUpdateAvailable: (v: boolean) => void;
  offlineReady: boolean;
  setOfflineReady: (v: boolean) => void;
  checkingForUpdate: boolean;
  checkForUpdates: () => void;
  handleUpdateReload: () => void;
}

export function usePwaUpdate(): UsePwaUpdateReturn {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [checkingForUpdate, setCheckingForUpdate] = useState(false);
  const updateSWRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    import('virtual:pwa-register').then(({ registerSW }) => {
      const updateSW = registerSW({
        onNeedRefresh: () => setUpdateAvailable(true),
        onOfflineReady: () => setOfflineReady(true),
      });
      updateSWRef.current = updateSW;
    });
  }, []);

  /** Ask the browser to check for a new service worker. If one is found, it installs and onNeedRefresh runs, so we show the update dialog. */
  const checkForUpdates = useCallback(() => {
    if (!('serviceWorker' in navigator)) return;
    setCheckingForUpdate(true);
    const clearChecking = () => setCheckingForUpdate(false);
    // If ready never resolves (e.g. dev with no active SW), clear after 10s so the UI doesn't stay stuck on "Checking…"
    const timeoutId = setTimeout(clearChecking, 10_000);
    navigator.serviceWorker.ready
      .then((reg) => {
        clearTimeout(timeoutId);
        reg.update();
        clearChecking();
      })
      .catch(() => {
        clearTimeout(timeoutId);
        clearChecking();
      });
  }, []);

  /** Activate the waiting service worker, then reload only after it takes control so the new version actually loads. */
  const handleUpdateReload = useCallback(() => {
    setUpdateAvailable(false);
    if (!('serviceWorker' in navigator)) {
      window.location.reload();
      return;
    }
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        let didReload = false;
        const reloadOnce = () => {
          if (didReload) return;
          didReload = true;
          window.location.reload();
        };
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);
        // Fallback: if controllerchange doesn't fire within 3s, reload anyway
        setTimeout(reloadOnce, 3000);
      } else {
        updateSWRef.current?.();
      }
    }).catch(() => {
      updateSWRef.current?.();
    });
  }, []);

  return {
    updateAvailable,
    setUpdateAvailable,
    offlineReady,
    setOfflineReady,
    checkingForUpdate,
    checkForUpdates,
    handleUpdateReload,
  };
}
