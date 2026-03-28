import type { BudgetState } from './budgetTypes';

/**
 * In-memory normalization when transaction shape evolves. Currently a no-op:
 * older rows without import metadata remain valid.
 */
export function migrateBudgetTransactionsIfNeeded(state: BudgetState): BudgetState {
  return state;
}
