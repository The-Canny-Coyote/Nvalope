import { describe, it, expect } from 'vitest';
import { parseBudgetBackup } from './budgetTypes';
import type { BudgetState } from './budgetTypes';

const validState: BudgetState = {
  envelopes: [{ id: 'e1', name: 'Groceries', limit: 400, spent: 0 }],
  transactions: [],
  income: [],
  savingsGoals: [],
  bills: [],
};

describe('parseBudgetBackup', () => {
  it('accepts valid BudgetState object', () => {
    const result = parseBudgetBackup(validState);
    expect(result.envelopes).toHaveLength(1);
    expect(result.envelopes[0].name).toBe('Groceries');
  });

  it('accepts backup wrapper with data key', () => {
    const wrapped = { version: 2, exportDate: new Date().toISOString(), data: validState };
    const result = parseBudgetBackup(wrapped);
    expect(result.envelopes).toEqual(validState.envelopes);
  });

  it('accepts full backup snapshot with budget key', () => {
    const fullSnapshot = { budget: validState, settings: { layoutScale: 80 }, premium: false, appData: {} };
    const result = parseBudgetBackup(fullSnapshot);
    expect(result.envelopes).toEqual(validState.envelopes);
  });

  it('throws on null or non-object', () => {
    expect(() => parseBudgetBackup(null)).toThrow('Invalid backup');
    expect(() => parseBudgetBackup(undefined)).toThrow('Invalid backup');
    expect(() => parseBudgetBackup('string')).toThrow('Invalid backup');
  });

  it('throws on missing envelopes', () => {
    expect(() => parseBudgetBackup({ ...validState, envelopes: undefined })).toThrow('envelopes');
    expect(() => parseBudgetBackup({ ...validState, envelopes: 'not-array' })).toThrow('envelopes');
  });

  it('throws on missing transactions', () => {
    expect(() => parseBudgetBackup({ ...validState, transactions: undefined })).toThrow('transactions');
  });

  it('throws on missing income', () => {
    expect(() => parseBudgetBackup({ ...validState, income: undefined })).toThrow('income');
  });

  it('defaults bills to empty array when missing', () => {
    const noBills = {
      envelopes: validState.envelopes,
      transactions: [],
      income: [],
      savingsGoals: [],
      bills: [],
    };
    const result = parseBudgetBackup(noBills as BudgetState);
    expect(result.bills).toEqual([]);
  });

  it('throws when full backup has empty budget object', () => {
    expect(() => parseBudgetBackup({ budget: {}, settings: {}, version: 2 })).toThrow();
  });

  it('throws when object has neither budget nor data key with valid state', () => {
    expect(() => parseBudgetBackup({ exportDate: new Date().toISOString(), version: 1 })).toThrow();
  });

  it('accepts full backup with appData and premium', () => {
    const full = {
      budget: validState,
      settings: { layoutScale: 90, wheelScale: 100 },
      premium: true,
      appData: { assistantMessages: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }] },
    };
    const result = parseBudgetBackup(full);
    expect(result.envelopes).toEqual(validState.envelopes);
    expect(result.transactions).toEqual(validState.transactions);
  });

  it('throws on malformed envelope shape', () => {
    expect(() =>
      parseBudgetBackup({
        envelopes: [{ id: 'e1', name: 'X', limit: 100 }],
        transactions: [],
        income: [],
        savingsGoals: [],
        bills: [],
      })
    ).toThrow();
  });
});
