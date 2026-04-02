import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import type { BudgetState } from './budgetTypes';
import { getDefaultBudgetState, createBudgetStore } from './budgetStore';
import type { BudgetStoreApi, BudgetSummary } from './budgetStore';
import { getBudget, setBudget } from '@/app/services/budgetIdb';
import { migrateBudgetTransactionsIfNeeded } from './transactionMigration';
import { useAppStore } from './appStore';
import { getPeriodForDate, getPeriodLabel, getDaysLeftInPeriod } from '@/app/utils/date';
import type { PeriodBounds } from '@/app/utils/date';

const BUDGET_LOAD_TIMEOUT_MS = 15_000;
const BUDGET_LOAD_RETRY_COUNT = 2;
const BUDGET_LOAD_RETRY_DELAY_MS = 300;

export interface BudgetSummaryForCurrentPeriod {
  summary: BudgetSummary;
  periodLabel: string;
  period: PeriodBounds | null;
  daysLeftInPeriod: number;
}

interface BudgetContextValue {
  state: BudgetState;
  api: BudgetStoreApi;
  getBudgetSummaryForCurrentPeriod: () => BudgetSummaryForCurrentPeriod;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export type BudgetLoadStatus = 'loading' | 'error' | 'timeout';

export interface BudgetProviderProps {
  children: React.ReactNode;
  budgetStateRef?: React.MutableRefObject<BudgetState | null>;
  onBudgetSaved?: (state: BudgetState) => void;
  /** Called when budget fails to load (for toast). */
  onLoadError?: (message: string) => void;
}

function isLoadStatus(s: BudgetState | BudgetLoadStatus): s is BudgetLoadStatus {
  return s === 'loading' || s === 'error' || s === 'timeout';
}

export function BudgetProvider({ children, budgetStateRef, onBudgetSaved, onLoadError }: BudgetProviderProps) {
  const [state, setState] = useState<BudgetState | BudgetLoadStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadBudget = useCallback(async () => {
    setState('loading');
    setLoadError(null);
    const timeoutId = setTimeout(() => {
      setState('timeout');
      setLoadError('Loading is taking too long. Check if the app has storage access.');
      onLoadError?.('Budget load timed out.');
    }, BUDGET_LOAD_TIMEOUT_MS);
    for (let attempt = 0; attempt <= BUDGET_LOAD_RETRY_COUNT; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, BUDGET_LOAD_RETRY_DELAY_MS));
        }
        const loaded = await getBudget();
        clearTimeout(timeoutId);
        const stateToSet = migrateBudgetTransactionsIfNeeded(loaded ?? getDefaultBudgetState());
        setState(stateToSet);
        return;
      } catch {
        // retry
      }
    }
    clearTimeout(timeoutId);
    const message = 'Failed to load budget. Try again or restore from backup.';
    setLoadError(message);
    setState('error');
    onLoadError?.(message);
  }, [onLoadError]);

  useEffect(() => {
    loadBudget();
  }, [loadBudget]);

  useEffect(() => {
    if (!isLoadStatus(state) && budgetStateRef) {
      budgetStateRef.current = state;
    }
  }, [state, budgetStateRef]);

  const api = useMemo(() => {
    if (isLoadStatus(state)) return null;
    return createBudgetStore(
      () => state,
      setState as (s: BudgetState | ((p: BudgetState) => BudgetState)) => void,
      {
        saveState: (next) => {
          setBudget(next)
            .then(() => {
              onBudgetSaved?.(next);
            })
            .catch(() => {
              onLoadError?.('Failed to save budget. Storage may be full—free space or remove data. Your last saved data has been restored.');
              loadBudget();
            });
        },
        afterPersist: (next) => {
          if (budgetStateRef) budgetStateRef.current = next;
        },
      }
    );
  }, [state, budgetStateRef, onBudgetSaved, onLoadError, loadBudget]);

  const getBudgetSummaryForCurrentPeriod = useCallback(() => {
    if (!api) {
      return {
        summary: { totalIncome: 0, totalBudgeted: 0, totalSpent: 0, uncategorizedSpent: 0, remaining: 0, envelopes: [], recentTransactions: [] },
        periodLabel: '',
        period: null,
        daysLeftInPeriod: 0,
      };
    }
    const app = useAppStore.getState();
    const mode = app.budgetPeriodMode;
    const periodOptions =
      mode === 'biweekly'
        ? { period1StartDay: app.biweeklyPeriod1StartDay ?? 1, period1EndDay: app.biweeklyPeriod1EndDay ?? 14 }
        : mode === 'weekly'
          ? { weekStartDay: app.weekStartDay ?? 0 }
          : {};
    const today = new Date().toISOString().slice(0, 10);
    const period = getPeriodForDate(today, mode, periodOptions);
    if (!period) {
      return {
        summary: api.getBudgetSummary(),
        periodLabel: today,
        period: null,
        daysLeftInPeriod: 0,
      };
    }
    const labelOptions = mode === 'biweekly' ? { period1EndDay: app.biweeklyPeriod1EndDay ?? 14 } : undefined;
    return {
      summary: api.getBudgetSummaryForPeriod(period),
      periodLabel: getPeriodLabel(period, mode, labelOptions),
      period,
      daysLeftInPeriod: getDaysLeftInPeriod(period),
    };
  }, [api]);

  const value = useMemo(
    () =>
      !isLoadStatus(state) && api
        ? { state, api, getBudgetSummaryForCurrentPeriod }
        : null,
    [state, api, getBudgetSummaryForCurrentPeriod]
  );

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading budget">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (state === 'error' || state === 'timeout') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4" role="alert">
        <p className="text-sm font-medium text-destructive">
          {state === 'timeout' ? 'Load timed out' : 'Failed to load budget'}
        </p>
        {loadError && <p className="text-xs text-muted-foreground text-center max-w-md">{loadError}</p>}
        <button
          type="button"
          onClick={loadBudget}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <BudgetContext.Provider value={value}>
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget must be used within BudgetProvider');
  return ctx;
}
