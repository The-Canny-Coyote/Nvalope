/**
 * Deterministic seed budget state for testing and "Load sample data".
 * Uses current month for income and transactions so the assistant and Overview see data.
 * All data stays on-device; this file does not perform any network or storage itself.
 */

import type { BudgetState, Envelope, Transaction, IncomeEntry } from '@/app/store/budgetTypes';

const ENV_GROCERIES = 'seed-env-groceries';
const ENV_DINING = 'seed-env-dining';
const ENV_TRANSPORT = 'seed-env-transport';

function thisMonth(): { start: string; end: string; dates: string[] } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const dates: string[] = [];
  for (let d = 1; d <= Math.min(28, lastDay); d++) {
    dates.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return { start, end, dates };
}

/** Build a valid BudgetState with envelopes, income, and transactions for the current month. */
export function getSeedBudgetState(): BudgetState {
  const { dates } = thisMonth();
  const iso = (d: string) => new Date(d + 'T12:00:00.000Z').toISOString();

  const envelopes: Envelope[] = [
    { id: ENV_GROCERIES, name: 'Groceries', limit: 400, spent: 127 },
    { id: ENV_DINING, name: 'Dining', limit: 200, spent: 45 },
    { id: ENV_TRANSPORT, name: 'Transport', limit: 150, spent: 53 },
  ];

  const transactions: Transaction[] = [
    { id: 'seed-tx-1', amount: 52, envelopeId: ENV_GROCERIES, description: 'Supermarket weekly shop', date: dates[0] ?? dates[1]!, createdAt: iso(dates[0] ?? dates[1]!) },
    { id: 'seed-tx-2', amount: 25, envelopeId: ENV_DINING, description: 'Lunch at café', date: dates[2] ?? dates[1]!, createdAt: iso(dates[2] ?? dates[1]!) },
    { id: 'seed-tx-3', amount: 38, envelopeId: ENV_TRANSPORT, description: 'Gas station', date: dates[3] ?? dates[1]!, createdAt: iso(dates[3] ?? dates[1]!) },
    { id: 'seed-tx-4', amount: 75, envelopeId: ENV_GROCERIES, description: 'Farmers market', date: dates[5] ?? dates[1]!, createdAt: iso(dates[5] ?? dates[1]!) },
    { id: 'seed-tx-5', amount: 20, envelopeId: ENV_DINING, description: 'Coffee and pastry', date: dates[7] ?? dates[1]!, createdAt: iso(dates[7] ?? dates[1]!) },
    { id: 'seed-tx-6', amount: 15, envelopeId: ENV_TRANSPORT, description: 'Bus fare', date: dates[8] ?? dates[1]!, createdAt: iso(dates[8] ?? dates[1]!) },
  ];

  const income: IncomeEntry[] = [
    { id: 'seed-inc-1', amount: 3200, source: 'Salary', date: dates[0] ?? dates[1]!, createdAt: iso(dates[0] ?? dates[1]!) },
    { id: 'seed-inc-2', amount: 200, source: 'Freelance', date: dates[10] ?? dates[1]!, createdAt: iso(dates[10] ?? dates[1]!) },
  ];

  return {
    envelopes,
    transactions,
    income,
    savingsGoals: [],
    bills: [],
  };
}
