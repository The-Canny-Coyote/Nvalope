import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDefaultBudgetState, createBudgetStore } from './budgetStore';
import type { BudgetState } from './budgetTypes';

/** State with one envelope, for tests that need an envelope. */
const stateWithOneEnvelope: BudgetState = {
  ...getDefaultBudgetState(),
  envelopes: [{ id: 'env-1', name: 'Test', limit: 100, spent: 0 }],
};

describe('getDefaultBudgetState', () => {
  it('returns empty envelopes and empty arrays', () => {
    const state = getDefaultBudgetState();
    expect(state.envelopes).toHaveLength(0);
    expect(state.transactions).toEqual([]);
    expect(state.income).toEqual([]);
    expect(state.savingsGoals).toEqual([]);
    expect(state.bills).toEqual([]);
  });
});

describe('createBudgetStore', () => {
  const saveState = vi.fn();
  const afterPersist = vi.fn();

  function createStore(initial: BudgetState = stateWithOneEnvelope) {
    let state = initial;
    const setState = (next: BudgetState | ((prev: BudgetState) => BudgetState)) => {
      state = typeof next === 'function' ? (next as (p: BudgetState) => BudgetState)(state) : next;
    };
    const api = createBudgetStore(() => state, setState, { saveState, afterPersist });
    return { getState: () => state, api, setState: (s: BudgetState) => setState(s) };
  }

  beforeEach(() => {
    saveState.mockClear();
    afterPersist.mockClear();
  });

  it('addTransaction updates envelope spent and calls saveState', () => {
    const { api, getState } = createStore();
    const envId = getState().envelopes[0].id;
    const tx = api.addTransaction({
      amount: 50,
      envelopeId: envId,
      description: 'Test',
      date: '2025-01-15',
    });
    expect(tx.amount).toBe(50);
    expect(tx.envelopeId).toBe(envId);
    expect(getState().envelopes[0].spent).toBe(50);
    expect(getState().transactions).toHaveLength(1);
    expect(saveState).toHaveBeenCalledTimes(1);
  });

  it('getBudgetSummary returns totals and envelope list', () => {
    const { api, getState } = createStore();
    const summary = api.getBudgetSummary();
    expect(summary.totalBudgeted).toBe(100);
    expect(summary.totalSpent).toBe(0);
    expect(summary.remaining).toBe(summary.totalIncome - summary.totalSpent);
    expect(summary.envelopes).toHaveLength(getState().envelopes.length);
    expect(summary.recentTransactions).toEqual([]);
  });

  it('addEnvelope appends a new envelope', () => {
    const { api, getState } = createStore(getDefaultBudgetState());
    const env = api.addEnvelope('Dining', 100);
    expect(env.name).toBe('Dining');
    expect(env.limit).toBe(100);
    expect(env.spent).toBe(0);
    expect(getState().envelopes).toHaveLength(1);
    expect(saveState).toHaveBeenCalled();
  });

  it('addTransaction throws on invalid amount', () => {
    const { api, getState } = createStore();
    const envId = getState().envelopes[0].id;
    expect(() =>
      api.addTransaction({ amount: Number.NaN, envelopeId: envId, description: 'Test', date: '2025-01-15' })
    ).toThrow(/valid amount/);
    expect(() =>
      api.addTransaction({ amount: Infinity, envelopeId: envId, description: 'Test', date: '2025-01-15' })
    ).toThrow(/valid amount/);
    expect(() =>
      api.addTransaction({ amount: 0, envelopeId: envId, description: 'Test', date: '2025-01-15' })
    ).toThrow(/valid amount/);
    expect(() =>
      api.addTransaction({ amount: -5, envelopeId: envId, description: 'Test', date: '2025-01-15' })
    ).toThrow(/valid amount/);
    expect(getState().transactions).toHaveLength(0);
    expect(saveState).not.toHaveBeenCalled();
  });

  it('addTransaction throws on invalid date', () => {
    const { api, getState } = createStore();
    const envId = getState().envelopes[0].id;
    expect(() =>
      api.addTransaction({ amount: 10, envelopeId: envId, description: 'Test', date: 'not-a-date' })
    ).toThrow(/date/);
    expect(getState().transactions).toHaveLength(0);
  });

  it('addEnvelope throws on invalid name or limit', () => {
    const { api, getState } = createStore(getDefaultBudgetState());
    expect(() => api.addEnvelope('', 100)).toThrow(/name/);
    expect(() => api.addEnvelope('OK', Number.NaN)).toThrow(/limit|amount/);
    expect(() => api.addEnvelope('OK', -1)).toThrow(/valid amount/);
    expect(getState().envelopes).toHaveLength(0);
  });

  it('addIncome throws on invalid params', () => {
    const { api } = createStore(getDefaultBudgetState());
    expect(() => api.addIncome({ amount: -1, source: 'Job', date: '2025-01-15' })).toThrow(/valid income amount/);
    expect(() => api.addIncome({ amount: 100, source: '', date: '2025-01-15' })).toThrow(/source/);
    expect(() => api.addIncome({ amount: 100, source: 'Job', date: 'bad' })).toThrow(/date/);
  });

  it('setEnvelopeLimit updates limit', () => {
    const { api, getState } = createStore();
    const envId = getState().envelopes[0].id;
    api.setEnvelopeLimit(envId, 500);
    expect(getState().envelopes[0].limit).toBe(500);
  });

  it('updateEnvelope updates name and/or limit', () => {
    const { api, getState } = createStore();
    const envId = getState().envelopes[0].id;
    const _origName = getState().envelopes[0].name;
    const origLimit = getState().envelopes[0].limit;
    api.updateEnvelope(envId, { name: 'New Name' });
    expect(getState().envelopes[0].name).toBe('New Name');
    expect(getState().envelopes[0].limit).toBe(origLimit);
    api.updateEnvelope(envId, { limit: 300 });
    expect(getState().envelopes[0].name).toBe('New Name');
    expect(getState().envelopes[0].limit).toBe(300);
    api.updateEnvelope(envId, { name: 'Both', limit: 100 });
    expect(getState().envelopes[0].name).toBe('Both');
    expect(getState().envelopes[0].limit).toBe(100);
    expect(() => api.updateEnvelope(envId, { name: '   ' })).toThrow(/name/);
  });

  it('deleteEnvelope removes envelope and uncategorizes its transactions', () => {
    const { api, getState } = createStore();
    const envId = getState().envelopes[0].id;
    api.addTransaction({ amount: 10, envelopeId: envId, description: 'X', date: '2025-01-01' });
    expect(getState().transactions[0].envelopeId).toBe(envId);
    api.deleteEnvelope(envId);
    expect(getState().envelopes.some((e) => e.id === envId)).toBe(false);
    expect(getState().transactions).toHaveLength(1);
    expect(getState().transactions[0].envelopeId).toBeUndefined();
  });

  it('importData replaces state and persists', () => {
    const { api, getState } = createStore();
    const newState: BudgetState = {
      envelopes: [{ id: 'e1', name: 'One', limit: 10, spent: 0 }],
      transactions: [],
      income: [],
      savingsGoals: [],
      bills: [],
    };
    api.importData(newState);
    expect(getState().envelopes).toHaveLength(1);
    expect(getState().envelopes[0].name).toBe('One');
    expect(saveState).toHaveBeenCalledWith(newState);
  });

  it('deleteTransaction removes tx and decrements envelope spent', () => {
    const { api, getState } = createStore();
    const envId = getState().envelopes[0].id;
    const tx = api.addTransaction({ amount: 30, envelopeId: envId, description: 'X', date: '2025-01-01' });
    expect(getState().envelopes[0].spent).toBe(30);
    api.deleteTransaction(tx.id);
    expect(getState().transactions).toHaveLength(0);
    expect(getState().envelopes[0].spent).toBe(0);
  });

  it('updateTransactionEnvelope moves amount between envelopes', () => {
    const { api, getState, setState } = createStore();
    setState({
      ...getState(),
      envelopes: [
        { id: 'e1', name: 'E1', limit: 100, spent: 0 },
        { id: 'e2', name: 'E2', limit: 100, spent: 0 },
      ],
    });
    const [e1, e2] = getState().envelopes;
    const tx = api.addTransaction({ amount: 20, envelopeId: e1.id, description: 'Y', date: '2025-01-01' });
    api.updateTransactionEnvelope(tx.id, e2.id);
    expect(getState().envelopes.find((e) => e.id === e1.id)?.spent).toBe(0);
    expect(getState().envelopes.find((e) => e.id === e2.id)?.spent).toBe(20);
    expect(getState().transactions.find((t) => t.id === tx.id)?.envelopeId).toBe(e2.id);
  });

  it('updateTransaction updates amount and adjusts envelope spent', () => {
    const { api, getState } = createStore();
    const envId = getState().envelopes[0].id;
    const tx = api.addTransaction({ amount: 25, envelopeId: envId, description: 'Item', date: '2025-01-01' });
    expect(getState().envelopes[0].spent).toBe(25);
    api.updateTransaction(tx.id, { amount: 30 });
    expect(getState().envelopes[0].spent).toBe(30);
    expect(getState().transactions.find((t) => t.id === tx.id)?.amount).toBe(30);
  });

  it('updateTransaction throws when amount is zero or negative', () => {
    const { api, getState } = createStore();
    const envId = getState().envelopes[0].id;
    const tx = api.addTransaction({ amount: 25, envelopeId: envId, description: 'Item', date: '2025-01-01' });
    expect(() => api.updateTransaction(tx.id, { amount: 0 })).toThrow(/valid amount/);
    expect(() => api.updateTransaction(tx.id, { amount: -1 })).toThrow(/valid amount/);
  });

  it('updateTransaction can change date and description', () => {
    const { api, getState } = createStore();
    const envId = getState().envelopes[0].id;
    const tx = api.addTransaction({ amount: 10, envelopeId: envId, description: 'A', date: '2025-01-01' });
    api.updateTransaction(tx.id, { description: 'Updated', date: '2025-01-15' });
    const updated = getState().transactions.find((t) => t.id === tx.id);
    expect(updated?.description).toBe('Updated');
    expect(updated?.date).toBe('2025-01-15');
  });

  it('addIncome appends income and getBudgetSummary includes it', () => {
    const { api, getState } = createStore();
    api.addIncome({ amount: 3000, source: 'Job', date: '2025-01-15' });
    expect(getState().income).toHaveLength(1);
    expect(getState().income[0].amount).toBe(3000);
    const summary = api.getBudgetSummary();
    expect(summary.totalIncome).toBe(3000);
  });

  it('createSavingsGoal adds goal', () => {
    const { api, getState } = createStore();
    const goal = api.createSavingsGoal({ name: 'Emergency', targetAmount: 5000, monthlyContribution: 200 });
    expect(goal.name).toBe('Emergency');
    expect(goal.targetAmount).toBe(5000);
    expect(getState().savingsGoals).toHaveLength(1);
  });

  it('addBill adds bill', () => {
    const { api, getState } = createStore();
    const bill = api.addBill({ name: 'Rent', dueDate: '2025-01-05', amount: 1200 });
    expect(bill.name).toBe('Rent');
    expect(getState().bills).toHaveLength(1);
  });

  it('updateBill updates bill fields', () => {
    const { api, getState } = createStore();
    const bill = api.addBill({ name: 'Rent', dueDate: '2025-01-05' });
    api.updateBill(bill.id, { amount: 1300 });
    expect(getState().bills[0].amount).toBe(1300);
  });

  it('deleteBill removes bill', () => {
    const { api, getState } = createStore();
    const bill = api.addBill({ name: 'Rent', dueDate: '2025-01-05' });
    api.deleteBill(bill.id);
    expect(getState().bills).toHaveLength(0);
  });

  it('getBudgetSummary returns correct totals with income and transactions', () => {
    const { api, getState } = createStore(); // stateWithOneEnvelope
    const envId = getState().envelopes[0].id;
    api.addIncome({ amount: 4000, source: 'Job', date: '2025-01-01' });
    api.addTransaction({ amount: 100, envelopeId: envId, description: 'Food', date: '2025-01-10' });
    const summary = api.getBudgetSummary();
    expect(summary.totalIncome).toBe(4000);
    expect(summary.totalSpent).toBe(100);
    expect(summary.remaining).toBe(summary.totalIncome - summary.totalSpent);
    expect(summary.recentTransactions).toHaveLength(1);
  });

  it('getBudgetSummaryForPeriod filters by date range', () => {
    const { api, getState } = createStore();
    const envId = getState().envelopes[0].id;
    api.addIncome({ amount: 3000, source: 'Job', date: '2025-01-05' });
    api.addIncome({ amount: 2000, source: 'Side', date: '2025-01-20' });
    api.addTransaction({ amount: 50, envelopeId: envId, description: 'A', date: '2025-01-10' });
    api.addTransaction({ amount: 30, envelopeId: envId, description: 'B', date: '2025-01-25' });
    const period1 = api.getBudgetSummaryForPeriod({ start: '2025-01-01', end: '2025-01-14' });
    expect(period1.totalIncome).toBe(3000);
    expect(period1.totalSpent).toBe(50);
    expect(period1.envelopes[0].spent).toBe(50);
    expect(period1.envelopes[0].remaining).toBe(50);
    const period2 = api.getBudgetSummaryForPeriod({ start: '2025-01-15', end: '2025-01-31' });
    expect(period2.totalIncome).toBe(2000);
    expect(period2.totalSpent).toBe(30);
    expect(period2.envelopes[0].spent).toBe(30);
  });

  it('uncategorized transactions are included in totalSpent', () => {
    const { api, getState } = createStore();
    const envId = getState().envelopes[0].id;
    api.addTransaction({ amount: 40, envelopeId: envId, description: 'categorized', date: '2025-02-01' });
    api.addTransaction({ amount: 25, description: 'uncategorized', date: '2025-02-01' });

    const summary = api.getBudgetSummary();
    expect(summary.uncategorizedSpent).toBe(25);
    expect(summary.totalSpent).toBe(65);

    const period = api.getBudgetSummaryForPeriod({ start: '2025-02-01', end: '2025-02-28' });
    expect(period.uncategorizedSpent).toBe(25);
    expect(period.totalSpent).toBe(65);
  });

  it('importData recomputes envelope spent from positive categorized transactions', () => {
    const { api, getState } = createStore(getDefaultBudgetState());
    const imported: BudgetState = {
      envelopes: [
        { id: 'e1', name: 'One', limit: 200, spent: 999 },
        { id: 'e2', name: 'Two', limit: 200, spent: 999 },
      ],
      transactions: [
        { id: 't1', amount: 10, envelopeId: 'e1', description: 'A', date: '2025-01-01', createdAt: '2025-01-01T00:00:00.000Z' },
        { id: 't2', amount: 25, envelopeId: 'e1', description: 'B', date: '2025-01-02', createdAt: '2025-01-02T00:00:00.000Z' },
        { id: 't3', amount: 15, envelopeId: 'e2', description: 'C', date: '2025-01-03', createdAt: '2025-01-03T00:00:00.000Z' },
        { id: 't4', amount: -50, envelopeId: 'e2', description: 'Legacy bad', date: '2025-01-04', createdAt: '2025-01-04T00:00:00.000Z' },
        { id: 't5', amount: 100, description: 'Uncategorized', date: '2025-01-05', createdAt: '2025-01-05T00:00:00.000Z' },
      ],
      income: [],
      savingsGoals: [],
      bills: [],
    };
    api.importData(imported);
    expect(getState().envelopes.find((e) => e.id === 'e1')?.spent).toBe(35);
    expect(getState().envelopes.find((e) => e.id === 'e2')?.spent).toBe(15);
  });
});
