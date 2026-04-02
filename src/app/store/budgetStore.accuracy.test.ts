import { describe, expect, it } from 'vitest';
import { createBudgetStore, getDefaultBudgetState } from '@/app/store/budgetStore';
import type { BudgetState } from '@/app/store/budgetTypes';

function createTestStore(initialState?: BudgetState) {
  let state: BudgetState = initialState ?? getDefaultBudgetState();
  const api = createBudgetStore(
    () => state,
    (next) => {
      state = typeof next === 'function' ? next(state) : next;
    },
    {
      saveState: () => {
        // no-op for unit tests
      },
    }
  );
  return { api, getState: () => state };
}

function sumSpentByEnvelope(state: BudgetState): Record<string, number> {
  const by: Record<string, number> = {};
  for (const e of state.envelopes) by[e.id] = 0;
  for (const tx of state.transactions) {
    if (!tx.envelopeId) continue;
    by[tx.envelopeId] = (by[tx.envelopeId] ?? 0) + tx.amount;
  }
  return by;
}

describe('budgetStore accuracy invariants', () => {
  it('envelope.spent equals sum of transactions per envelope after add/update/delete', () => {
    const { api, getState } = createTestStore();
    const e1 = api.addEnvelope('Food', 100);
    const e2 = api.addEnvelope('Gas', 50);

    const t1 = api.addTransaction({
      amount: 10.25,
      envelopeId: e1.id,
      description: 'Groceries',
      date: '2026-03-01',
    });
    const t2 = api.addTransaction({
      amount: 5.75,
      envelopeId: e1.id,
      description: 'Snack',
      date: '2026-03-02',
    });
    const t3 = api.addTransaction({
      amount: 20,
      envelopeId: e2.id,
      description: 'Fill up',
      date: '2026-03-03',
    });

    api.updateTransaction(t2.id, { amount: 6.0 });
    api.updateTransaction(t3.id, { envelopeId: e1.id });
    api.deleteTransaction(t1.id);

    const s = getState();
    const by = sumSpentByEnvelope(s);
    for (const env of s.envelopes) {
      expect(env.spent).toBeCloseTo(by[env.id] ?? 0, 10);
    }
  });

  it('addTransactions updates envelope spent consistently (single persist path)', () => {
    const { api, getState } = createTestStore();
    const e1 = api.addEnvelope('Dining', 100);
    const e2 = api.addEnvelope('Utilities', 200);

    api.addTransactions([
      { amount: 12.34, envelopeId: e1.id, description: 'Lunch', date: '2026-03-10' },
      { amount: 45.67, envelopeId: e2.id, description: 'Electric', date: '2026-03-11' },
      { amount: 1.23, envelopeId: e1.id, description: 'Coffee', date: '2026-03-12' },
    ]);

    const s = getState();
    const by = sumSpentByEnvelope(s);
    for (const env of s.envelopes) {
      expect(env.spent).toBeCloseTo(by[env.id] ?? 0, 10);
    }
  });

  it('importData recomputes envelope spent from transactions (ignores stale envelope.spent)', () => {
    const { api, getState } = createTestStore();
    const state = getDefaultBudgetState();
    state.envelopes = [{ id: 'e', name: 'E', limit: 100, spent: 999 }] as BudgetState['envelopes'];
    state.transactions = [
      {
        id: 't',
        amount: 12.34,
        envelopeId: 'e',
        description: 'x',
        date: '2026-03-01',
        createdAt: new Date().toISOString(),
      },
    ];

    api.importData(state);
    expect(getState().envelopes[0]?.spent).toBeCloseTo(12.34, 10);
  });

  it('getBudgetSummaryForPeriod totals match sums of tx/income within period', () => {
    const { api } = createTestStore();
    const e = api.addEnvelope('Food', 100);
    api.addIncome({ amount: 1000, source: 'Pay', date: '2026-03-01' });
    api.addIncome({ amount: 1000, source: 'Pay', date: '2026-04-01' });
    api.addTransaction({ amount: 10, envelopeId: e.id, description: 'A', date: '2026-03-10' });
    api.addTransaction({ amount: 20, envelopeId: e.id, description: 'B', date: '2026-04-10' });

    const march = api.getBudgetSummaryForPeriod({ start: '2026-03-01', end: '2026-03-31' });
    expect(march.totalIncome).toBe(1000);
    expect(march.totalSpent).toBe(10);

    const april = api.getBudgetSummaryForPeriod({ start: '2026-04-01', end: '2026-04-30' });
    expect(april.totalIncome).toBe(1000);
    expect(april.totalSpent).toBe(20);
  });
}
);

