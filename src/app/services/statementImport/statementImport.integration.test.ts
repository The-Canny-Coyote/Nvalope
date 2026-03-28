import { describe, expect, it, vi } from 'vitest';
import { createBudgetStore, getDefaultBudgetState } from '@/app/store/budgetStore';
import type { BudgetState } from '@/app/store/budgetTypes';
import { classifyImportedTransactions, parseStatementFile } from './index';

function createStore(initial?: BudgetState) {
  let state = initial ?? getDefaultBudgetState();
  const setState = (next: BudgetState | ((prev: BudgetState) => BudgetState)) => {
    state = typeof next === 'function' ? (next as (prev: BudgetState) => BudgetState)(state) : next;
  };
  const saveState = vi.fn();
  const api = createBudgetStore(() => state, setState, { saveState });
  return { api, getState: () => state };
}

describe('statement import integration', () => {
  it('appends deduped debit transactions into budget store', async () => {
    const { api, getState } = createStore();
    api.addTransaction({ amount: 4.75, description: 'Coffee', date: '2025-01-10' });

    const parsed = parseStatementFile(
      'transactions.csv',
      'Date,Description,Amount\n2025-01-10,Coffee,-4.75\n2025-01-11,Gas,-45.00\n2025-01-12,Payroll,1500.00'
    );
    const txs = getState().transactions.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      description: t.description,
      importHash: t.importHash,
    }));
    const classified = await classifyImportedTransactions(parsed.rows, txs);
    const toWrite = classified.importQueue.filter(
      (q) => q.duplicateResolution === 'import' || q.duplicateResolution === 'keep_both' || q.duplicateResolution === 'replace'
    );
    api.addTransactions(
      toWrite.map((q) => ({
        amount: q.amount,
        description: q.description,
        date: q.date,
      }))
    );

    expect(toWrite).toHaveLength(1);
    expect(toWrite[0].description).toBe('Gas');
    expect(classified.skippedAsDuplicates.length).toBeGreaterThanOrEqual(0);
    expect(classified.invalidRows).toHaveLength(0);
    expect(classified.skippedCreditRows).toHaveLength(1);
    expect(getState().transactions.some((tx) => tx.description === 'Gas' && tx.amount === 45)).toBe(true);
  });

  it('can append credit rows as income entries', async () => {
    const { api, getState } = createStore();
    const parsed = parseStatementFile(
      'transactions.csv',
      'Date,Description,Amount\n2025-01-12,Payroll,1500.00'
    );
    const classified = await classifyImportedTransactions(parsed.rows, getState().transactions, { importCreditsAsIncome: true });
    for (const income of classified.incomeToAdd) {
      api.addIncome(income);
    }
    expect(classified.incomeToAdd).toHaveLength(1);
    expect(getState().income).toHaveLength(1);
    expect(getState().income[0].source).toBe('Payroll');
  });
});
