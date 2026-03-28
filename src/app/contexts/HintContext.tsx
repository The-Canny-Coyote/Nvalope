'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_MASTER = 'nvalope-hints-master';
const STORAGE_DISABLED = 'nvalope-hints-disabled';

function loadMaster(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_MASTER);
    if (v === 'false') return false;
    if (v === 'true') return true;
  } catch { /* ignore */ }
  return true;
}

function loadDisabled(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DISABLED);
    if (raw) {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr) && arr.every((x) => typeof x === 'string')) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveDisabled(disabled: Set<string>) {
  try {
    localStorage.setItem(STORAGE_DISABLED, JSON.stringify([...disabled]));
  } catch { /* ignore */ }
}

interface HintContextValue {
  masterEnabled: boolean;
  setMasterEnabled: (v: boolean) => void;
  isDisabled: (id: string) => boolean;
  disableHint: (id: string) => void;
}

const HintContext = createContext<HintContextValue | null>(null);

export function HintProvider({ children }: { children: React.ReactNode }) {
  const [masterEnabled, setMasterState] = useState(loadMaster);
  const [disabled, setDisabled] = useState(loadDisabled);

  const setMasterEnabled = useCallback((v: boolean) => {
    setMasterState(v);
    try {
      localStorage.setItem(STORAGE_MASTER, v ? 'true' : 'false');
    } catch { /* ignore */ }
  }, []);

  const isDisabled = useCallback((id: string) => disabled.has(id), [disabled]);

  const disableHint = useCallback((id: string) => {
    setDisabled((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDisabled(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      masterEnabled,
      setMasterEnabled,
      isDisabled,
      disableHint,
    }),
    [masterEnabled, setMasterEnabled, isDisabled, disableHint]
  );

  return <HintContext.Provider value={value}>{children}</HintContext.Provider>;
}

export function useHint(): HintContextValue {
  const ctx = useContext(HintContext);
  if (!ctx) throw new Error('useHint must be used within HintProvider');
  return ctx;
}
