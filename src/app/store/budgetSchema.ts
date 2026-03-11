/**
 * Zod schemas for BudgetState and backup validation.
 * Used by parseBudgetBackup for exhaustive validation; errors mapped to a single user-facing message.
 */

import { z } from 'zod';

export const envelopeSchema = z.object({
  id: z.string(),
  name: z.string(),
  limit: z.number(),
  spent: z.number(),
});

export const transactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  envelopeId: z.string().optional(),
  description: z.string(),
  date: z.string(),
  createdAt: z.string(),
});

export const incomeEntrySchema = z.object({
  id: z.string(),
  amount: z.number(),
  source: z.string(),
  date: z.string(),
  createdAt: z.string(),
});

export const savingsGoalSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetAmount: z.number(),
  targetDate: z.string(),
  monthlyContribution: z.number(),
  currentAmount: z.number(),
  createdAt: z.string(),
});

export const billDueDateSchema = z.object({
  id: z.string(),
  name: z.string(),
  dueDate: z.string(),
  amount: z.number().optional(),
  repeatMonthly: z.boolean().optional(),
  envelopeId: z.string().optional(),
});

export const budgetStateSchema = z.object({
  envelopes: z.array(envelopeSchema),
  transactions: z.array(transactionSchema),
  income: z.array(incomeEntrySchema),
  savingsGoals: z.array(savingsGoalSchema),
  bills: z.array(billDueDateSchema).optional(),
});

/** Map Zod error to a single user-facing message (no raw payload). */
export function budgetValidationErrorMessage(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return 'Invalid backup.';
  const path = first.path.length > 0 ? first.path.join('.') + ': ' : '';
  const msg = first.message ?? 'invalid';
  return `Invalid backup: ${path}${msg}`;
}
