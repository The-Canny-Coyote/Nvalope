/**
 * Refs and helper to save/restore the main scroll position after layout changes.
 * Restore effect (with deps) stays in the consumer; this hook provides refs and saveScrollForRestore.
 * Restore should clamp scrollTop to [0, maxScroll] to avoid layout thrash.
 */

import { useRef, useCallback } from 'react';

export interface UseScrollRestoreReturn {
  /** Ref to attach to the main scroll container (overflow-y-auto). */
  mainScrollRef: React.RefObject<HTMLDivElement | null>;
  /** Ref holding the scroll top to restore (set by saveScrollForRestore). */
  scrollTopToRestoreRef: React.MutableRefObject<number | null>;
  /** Scroll height at save (for ratio-based restore when anchor is missing). */
  scrollHeightAtSaveRef: React.MutableRefObject<number | null>;
  /** Call before updating state that changes layout so scroll can be restored after. */
  saveScrollForRestore: () => void;
}

export function useScrollRestore(): UseScrollRestoreReturn {
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTopToRestoreRef = useRef<number | null>(null);
  const scrollHeightAtSaveRef = useRef<number | null>(null);

  const saveScrollForRestore = useCallback(() => {
    if (mainScrollRef.current != null) {
      const el = mainScrollRef.current;
      scrollTopToRestoreRef.current = el.scrollTop;
      scrollHeightAtSaveRef.current = el.scrollHeight;
    }
  }, []);

  return {
    mainScrollRef,
    scrollTopToRestoreRef,
    scrollHeightAtSaveRef,
    saveScrollForRestore,
  };
}
