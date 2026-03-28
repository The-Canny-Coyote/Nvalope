import { formatMoney } from '@/app/utils/format';
import type { PerformanceTier } from '@/app/utils/deviceCapabilities';

const containsAny = (str: string, keywords: readonly string[]): boolean =>
  keywords.some((k) => str.includes(k));

const SPENDING_KEYWORDS = ['spent', 'spending', 'cost', 'paid', 'outgo', 'purchases'];
const REMAINING_KEYWORDS = ['left', 'remaining', 'balance', 'available', 'limit'];
const INCOME_KEYWORDS = ['income', 'earned', 'salary', 'paycheck', 'deposit'];
const ENVELOPE_KEYWORDS = ['categories', 'envelopes', 'buckets', 'groups'];
const GREETING_KEYWORDS = ['hello', 'hi', 'hey', 'who are you'];
const HOW_TO_KEYWORDS = ['help', 'what can', 'how do', 'where', 'show me', 'tutorial', 'guide'];
const HOW_AM_I_DOING_PHRASES = ['how am i doing', 'spending pace', 'burn rate', 'pace'];

export type BudgetSummary = {
  totalIncome: number;
  totalBudgeted: number;
  totalSpent: number;
  remaining: number;
  envelopes: Array<{ id: string; name: string; limit: number; spent: number; remaining: number }>;
  /** Optional one-line analytics insight (e.g. top spending envelope, largest overspend). */
  analyticsInsight?: string;
};

export function getAssistantReply(
  message: string,
  getSummary: () => BudgetSummary,
  performanceTier: PerformanceTier = 'low'
): string {
  const q = message.trim().toLowerCase();
  const summary = getSummary();

  // Greetings
  if (containsAny(q, GREETING_KEYWORDS) && q.length < 80) {
    return "Hi! I'm Cache, your budget assistant. I can help with spending, what's left, income, envelopes, and how to add expenses or income. All data stays on your device.";
  }

  // Beefed up: burn rate for "how am I doing?" / "spending pace" (medium/high tier only)
  const isBeefedUp = performanceTier === 'medium' || performanceTier === 'high';
  const asksHowAmIDoing = HOW_AM_I_DOING_PHRASES.some((phrase) => q.includes(phrase));
  if (isBeefedUp && asksHowAmIDoing) {
    const dayOfMonth = Math.max(1, new Date().getDate());
    const burnRate = (summary.totalSpent / dayOfMonth) * 30;
    return `You've spent **${formatMoney(summary.totalSpent)}** so far. At this pace you'd spend about **${formatMoney(burnRate)}** this month. You have **${formatMoney(summary.remaining)}** left in your budget.`;
  }
  // Low tier: "how am I doing" → combined summary (no burn rate)
  if (performanceTier === 'low' && asksHowAmIDoing) {
    return `You've spent **${formatMoney(summary.totalSpent)}** total so far and have **${formatMoney(summary.remaining)}** remaining in your budget.`;
  }

  if (containsAny(q, SPENDING_KEYWORDS) || (q.includes('how much') && containsAny(q, ['spend', 'spent']))) {
    return `You've spent **${formatMoney(summary.totalSpent)}** total across all envelopes.`;
  }
  if (containsAny(q, REMAINING_KEYWORDS) || q.includes('remain')) {
    return `You have **${formatMoney(summary.remaining)}** remaining in your budget (total budgeted minus spent).`;
  }
  if (containsAny(q, INCOME_KEYWORDS)) {
    return `Your total income recorded is **${formatMoney(summary.totalIncome)}**.`;
  }
  if (containsAny(q, ENVELOPE_KEYWORDS) || q.includes('envelope') || q.includes('categor')) {
    if (summary.envelopes.length === 0) {
      return "You don't have any envelopes yet. Go to **Envelopes & Expenses** and create one at the bottom of the page.";
    }
    const list = summary.envelopes
      .map((e) => `• **${e.name}**: ${formatMoney(e.spent)} / ${formatMoney(e.limit)} (${formatMoney(e.remaining)} left)`)
      .join('\n');
    return `Your envelopes:\n${list}`;
  }
  if (q.includes('add') && (q.includes('expense') || containsAny(q, ['spend', 'purchases']))) {
    return 'Go to **Envelopes & Expenses**, pick an envelope in the dropdown, enter the amount and description, then click **Add Expense**.';
  }
  if (q.includes('add') && containsAny(q, INCOME_KEYWORDS)) {
    return 'Go to **Income**, enter the amount and source, then click **Add Income**.';
  }
  if ((q.includes('overspend') || q.includes('over spend') || q.includes('top spend') || q.includes('most spend') || q.includes('where am i overspend')) && summary.analyticsInsight) {
    return summary.analyticsInsight;
  }
  if (containsAny(q, HOW_TO_KEYWORDS)) {
    return "I can answer questions about your budget: how much you've spent, what's left, income, envelopes, and how to add expenses or income. Try one of the quick questions below or ask in your own words.";
  }
  if (q.length < 2) {
    return 'Ask me about your budget—for example, "How much have I spent?" or "What\'s left?"';
  }

  // Graceful fallback: suggest by closest keyword or default list
  const suggested = [];
  if (containsAny(q, SPENDING_KEYWORDS) || containsAny(q, REMAINING_KEYWORDS)) suggested.push('spending or what\'s left');
  if (containsAny(q, INCOME_KEYWORDS)) suggested.push('income');
  if (containsAny(q, ENVELOPE_KEYWORDS) || q.includes('envelope')) suggested.push('envelopes');
  if (q.includes('add')) suggested.push('how to add an expense or income');
  const didYouMean = suggested.length > 0
    ? `Did you mean something about ${suggested.join(', ')}? `
    : '';
  return `${didYouMean}Try asking about spending, what's left, income, envelopes, or how to add an expense. I can only answer questions about your budget using the data in this app.`;
}
