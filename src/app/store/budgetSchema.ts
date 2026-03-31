/**
 * Zod schemas for BudgetState and backup validation.
 * Used by parseBudgetBackup for exhaustive validation; errors mapped to a single user-facing message.
 */

import { z } from 'zod';

export const envelopeSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(200),
  limit: z.number(),
  spent: z.number(),
});

export const transactionSchema = z.object({
  id: z.string().max(100),
  amount: z.number(),
  envelopeId: z.string().max(100).optional(),
  description: z.string().max(1000),
  date: z.string().max(20),
  createdAt: z.string().max(40),
  importHash: z.string().max(100).optional(),
  importSourceFile: z.string().max(500).optional(),
  importConfidence: z.number().optional(),
  payeeNormalized: z.string().max(500).optional(),
  matchedReceiptId: z.string().max(100).optional(),
});

export const incomeEntrySchema = z.object({
  id: z.string().max(100),
  amount: z.number(),
  source: z.string().max(500),
  date: z.string().max(20),
  createdAt: z.string().max(40),
});

export const savingsGoalSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(200),
  targetAmount: z.number(),
  targetDate: z.string(),
  monthlyContribution: z.number(),
  currentAmount: z.number(),
  createdAt: z.string(),
});

export const billDueDateSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(200),
  dueDate: z.string().max(20),
  amount: z.number().optional(),
  repeatMonthly: z.boolean().optional(),
  envelopeId: z.string().optional(),
});

export const budgetStateSchema = z.object({
  envelopes: z.array(envelopeSchema).max(500),
  transactions: z.array(transactionSchema).max(50000),
  income: z.array(incomeEntrySchema).max(5000),
  savingsGoals: z.array(savingsGoalSchema).max(200),
  bills: z.array(billDueDateSchema).max(500).optional(),
});

/** Map Zod error to a single user-facing message (no raw payload). */
export function budgetValidationErrorMessage(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return 'Invalid backup.';
  const path = first.path.length > 0 ? first.path.join('.') + ': ' : '';
  const msg = first.message ?? 'invalid';
  return `Invalid backup: ${path}${msg}`;
}
