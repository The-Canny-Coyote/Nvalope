/**
 * Allows Analytics (or other modules) to request opening the Transactions section
 * with an initial filter (e.g. by envelope). TransactionsContent reads the initial
 * filter on mount and applies it, then clears it.
 */

import { createContext, useContext, useCallback, useState } from 'react';

export interface TransactionFilter {
  envelopeId?: string;
}

interface TransactionFilterContextValue {
  initialFilter: TransactionFilter | null;
  requestViewTransactions: (filter: TransactionFilter) => void;
  clearInitialFilter: () => void;
}

const TransactionFilterContext = createContext<TransactionFilterContextValue | null>(null);

export function TransactionFilterProvider({
  children,
  onSwitchToTransactions,
}: {
  children: React.ReactNode;
  onSwitchToTransactions: () => void;
}) {
  const [initialFilter, setInitialFilter] = useState<TransactionFilter | null>(null);

  const requestViewTransactions = useCallback(
    (filter: TransactionFilter) => {
      setInitialFilter(filter);
      onSwitchToTransactions();
    },
    [onSwitchToTransactions]
  );

  const clearInitialFilter = useCallback(() => setInitialFilter(null), []);

  const value: TransactionFilterContextValue = {
    initialFilter,
    requestViewTransactions,
    clearInitialFilter,
  };

  return (
    <TransactionFilterContext.Provider value={value}>
      {children}
    </TransactionFilterContext.Provider>
  );
}

export function useTransactionFilter(): TransactionFilterContextValue | null {
  return useContext(TransactionFilterContext);
}
