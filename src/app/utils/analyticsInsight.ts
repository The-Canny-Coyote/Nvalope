/**
 * Derives a one-line analytics insight from budget state for the AI assistant.
 * No network calls; all data stays on-device.
 */

import type { BudgetState } from '@/app/store/budgetTypes';
import { formatMoney } from '@/app/utils/format';

export function getAnalyticsInsight(state: BudgetState): string {
  const { envelopes } = state;
  if (envelopes.length === 0) return '';

  const withSpend = envelopes.filter((e) => e.spent > 0);
  if (withSpend.length === 0) return '';

  const top = withSpend.sort((a, b) => b.spent - a.spent)[0];
  const overspend = envelopes.filter((e) => e.limit > 0 && e.spent > e.limit);
  const worst = overspend.sort((a, b) => (b.spent - b.limit) - (a.spent - a.limit))[0];

  if (worst) {
    const pct = Math.round((worst.spent / worst.limit) * 100);
    return `Largest overspend vs limit: ${worst.name} (${pct}%).`;
  }
  return `Top spending envelope: ${top.name} (${formatMoney(top.spent)}).`;
}
