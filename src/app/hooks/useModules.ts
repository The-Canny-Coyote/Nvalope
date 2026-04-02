/**
 * Enabled feature modules: handlers (enable/disable/cache with animation).
 * State lives in appStore.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/app/store/appStore';

export interface UseModulesParams {
  /** Called before changing modules (e.g. save scroll position). */
  saveScrollForRestore: () => void;
  /** Set to true to show cache-enable animation, then false after delay. */
  setShowCacheAnimation: (show: boolean) => void;
  /** Called when Advanced AI Cache module is disabled (e.g. clear fallback state). */
  onDisableAdvancedAICache?: () => void;
}

export interface UseModulesReturn {
  enabledModules: string[];
  setEnabledModules: React.Dispatch<React.SetStateAction<string[]>>;
  enableModule: (moduleId: string) => void;
  disableModule: (moduleId: string) => void;
  enableCache: () => void;
}

export function useModules({
  saveScrollForRestore,
  setShowCacheAnimation,
  onDisableAdvancedAICache,
}: UseModulesParams): UseModulesReturn {
  const enabledModules = useAppStore((s) => s.enabledModules);
  const setEnabledModules = useAppStore((s) => s.setEnabledModules);
  const cacheAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cacheAnimTimerRef.current !== null) clearTimeout(cacheAnimTimerRef.current);
    };
  }, []);

  const enableCache = useCallback(() => {
    saveScrollForRestore();
    setShowCacheAnimation(true);
    setEnabledModules((prev) =>
      prev.includes('cacheAssistant') ? prev : [...prev, 'cacheAssistant']
    );
    if (cacheAnimTimerRef.current !== null) clearTimeout(cacheAnimTimerRef.current);
    cacheAnimTimerRef.current = setTimeout(() => {
      cacheAnimTimerRef.current = null;
      setShowCacheAnimation(false);
    }, 150);
  }, [saveScrollForRestore, setShowCacheAnimation, setEnabledModules]);

  const enableModule = useCallback(
    (moduleId: string) => {
      if (!enabledModules.includes(moduleId)) {
        saveScrollForRestore();
        setEnabledModules((prev) => [...prev, moduleId]);
      }
    },
    [enabledModules, saveScrollForRestore, setEnabledModules]
  );

  const disableModule = useCallback(
    (moduleId: string) => {
      saveScrollForRestore();
      setEnabledModules((prev) => prev.filter((id) => id !== moduleId));
      if (moduleId === 'advancedAICache') {
        onDisableAdvancedAICache?.();
      }
    },
    [saveScrollForRestore, setEnabledModules, onDisableAdvancedAICache]
  );

  return {
    enabledModules,
    setEnabledModules,
    enableModule,
    disableModule,
    enableCache,
  };
}
