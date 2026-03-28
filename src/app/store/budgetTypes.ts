/**
 * Budget data types for Nvalope. All data stays on-device (localStorage).
 */

import { budgetStateSchema, budgetValidationErrorMessage } from './budgetSchema';

export interface Envelope {
  id: string;
  name: string;
  limit: number; // monthly limit in dollars
  spent: number;
}

export interface Transaction {
  id: string;
  amount: number;
  /** Envelope (category) for this transaction. Omitted when uncategorized (e.g. receipt saved before envelopes exist). */
  envelopeId?: string;
  description: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO string for ordering
  /** Optional metadata from bank statement import (backward compatible when absent). */
  importHash?: string;
  importSourceFile?: string;
  importConfidence?: number;
  payeeNormalized?: string;
  matchedReceiptId?: string;
}

export interface IncomeEntry {
  id: string;
  amount: number;
  source: string;
  date: string;
  createdAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  monthlyContribution: number;
  currentAmount: number;
  createdAt: string;
}

/** Bill due date: optional amount and envelope; can repeat monthly. */
export interface BillDueDate {
  id: string;
  name: string;
  amount?: number; // optional reminder amount
  dueDate: string; // YYYY-MM-DD
  repeatMonthly?: boolean; // show on this day of every month
  envelopeId?: string; // optional link to envelope
}

/** Calendar view event: transaction, income, or bill for a given date. */
export type CalendarEvent =
  | { type: 'transaction'; id: string; date: string; amount: number; description: string; envelopeId?: string; envelopeName: string }
  | { type: 'income'; id: string; date: string; amount: number; source: string }
  | { type: 'bill'; id: string; billId: string; date: string; name: string; amount?: number; envelopeId?: string };

export interface BudgetState {
  envelopes: Envelope[];
  transactions: Transaction[];
  income: IncomeEntry[];
  savingsGoals: SavingsGoal[];
  bills: BillDueDate[];
}

export const BUDGET_STORAGE_KEY = 'nvalope-budget';

/** Default envelopes for new users (empty — all screens start with no data). */
export const DEFAULT_ENVELOPES: Envelope[] = [];

/** Backup file may include export metadata */
export interface BudgetBackup {
  exportDate?: string;
  version?: number;
  data: BudgetState;
}

/**
 * Validates parsed JSON as BudgetState (or BudgetBackup with data). Throws with a message if invalid.
 * Uses Zod for exhaustive validation when possible; falls back to manual checks for older runtimes.
 */
export function parseBudgetBackup(raw: unknown): BudgetState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid backup: not an object.');
  }
  const obj = raw as Record<string, unknown>;
  let data: unknown = obj;
  if ('budget' in obj && obj.budget && typeof obj.budget === 'object') {
    data = obj.budget as Record<string, unknown>;
  } else if ('data' in obj && obj.data && typeof obj.data === 'object') {
    data = obj.data as Record<string, unknown>;
  }

  const parsed = budgetStateSchema.safeParse({
    ...(data as Record<string, unknown>),
    bills: Array.isArray((data as Record<string, unknown>).bills)
      ? (data as Record<string, unknown>).bills
      : [],
  });
  if (parsed.success) {
    return parsed.data as BudgetState;
  }
  throw new Error(budgetValidationErrorMessage(parsed.error));
}
