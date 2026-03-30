/**
 * NVALOPE PREMIUM — RESTRICTED USE
 *
 * This file is part of the Nvalope Premium feature set.
 * Licensed under MIT + Commons Clause. See LICENSE in the project root for full terms.
 *
 * You may read, fork, and modify this file for personal or self-hosted non-commercial use.
 * You may NOT use this file, or any derivative of it, as part of a product or service
 * that is sold or monetized without a separate commercial license from the author.
 *
 * To inquire about a commercial license: support@nvalope.com
 */

import { formatMoney } from '@/app/utils/format';

export type BudgetSummary = {
  totalIncome: number;
  totalBudgeted: number;
  totalSpent: number;
  remaining: number;
  envelopes: Array<{ id: string; name: string; limit: number; spent: number; remaining: number }>;
  recentTransactions: { amount: number; envelopeId?: string; description: string }[];
  /** Optional one-line analytics insight (e.g. top spending envelope, largest overspend). */
  analyticsInsight?: string;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export interface AdvancedAssistantContext {
  lastAssistantContent?: string;
  lastUserContent?: string;
}

/** Extract last mentioned envelope name from assistant message (e.g. "**Groceries**: $50" or "• **Name**"). */
function getLastMentionedEnvelopeName(content: string | undefined, summary: BudgetSummary): typeof summary.envelopes[0] | undefined {
  if (!content) return undefined;
  const names: string[] = [];
  const boldMatch = content.matchAll(/\*\*([^*]+)\*\*/g);
  for (const m of boldMatch) {
    const name = m[1].trim();
    if (name && summary.envelopes.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      names.push(name);
    }
  }
  if (names.length === 0) return undefined;
  const lastName = names[names.length - 1];
  return summary.envelopes.find((e) => e.name.toLowerCase() === lastName.toLowerCase());
}

/** Resolve "the first one", "groceries", "that envelope", "it", "there" from context. */
function resolveEnvelopeFromContext(
  message: string,
  summary: BudgetSummary,
  lastAssistantContent: string | undefined
): typeof summary.envelopes[0] | undefined {
  const q = message.trim().toLowerCase();

  // Direct name in current message: "groceries", "how much in dining"
  for (const env of summary.envelopes) {
    if (q.includes(env.name.toLowerCase())) return env;
  }

  const lastListedEnvelopes = lastAssistantContent?.toLowerCase().includes("your envelopes:");

  // Ordinals: "the first one", "second one", or "first", "second" after envelope list
  const ordinalWords = ["first", "second", "third", "fourth", "fifth", "1st", "2nd", "3rd"];
  for (let i = 0; i < ordinalWords.length; i++) {
    const hasOrdinal = q.includes(ordinalWords[i]);
    const hasOneOrEnvelope = q.includes("one") || q.includes("envelope") || q.includes("it") || q.includes("that");
    if (hasOrdinal && (hasOneOrEnvelope || lastListedEnvelopes)) {
      const idx = i < 3 ? i : Math.min(i, summary.envelopes.length - 1);
      return summary.envelopes[idx];
    }
  }

  // After list: "the first" alone or "one" / "it" / "that" -> first envelope
  if (lastListedEnvelopes && (q.includes("one") || q.includes("it") || q.includes("that"))) {
    return summary.envelopes[0];
  }

  // Pronouns / "there": resolve to last mentioned envelope in last assistant message
  const pronounPhrases = [" it ", " it?", " that one", " that envelope", " there", " there?", "there "];
  const isPronounOnly = pronounPhrases.some((p) => q.includes(p)) || q === "it" || q === "there" || q === "that one";
  if (isPronounOnly && lastAssistantContent) {
    const lastEnv = getLastMentionedEnvelopeName(lastAssistantContent, summary);
    if (lastEnv) return lastEnv;
  }

  return undefined;
}

/** Detect if last assistant message was a how-to (add expense or add income). */
function getHowToNextStep(lastAssistantContent: string | undefined, currentMessage: string): string | undefined {
  const q = currentMessage.trim().toLowerCase();
  if (!/what next|next step|and then|what do i do next/i.test(q)) return undefined;
  if (!lastAssistantContent) return undefined;
  const lower = lastAssistantContent.toLowerCase();
  if (lower.includes("envelopes & expenses") && lower.includes("add expense")) {
    return "Enter the amount and description in the form, then click **Add Expense** to record it.";
  }
  if (lower.includes("income") && lower.includes("add income")) {
    return "Enter the amount and source, then click **Add Income** to save it.";
  }
  return undefined;
}

/**
 * Advanced reply: uses full conversation context and natural language to answer.
 */
export function getAdvancedAssistantReply(
  messages: ChatMessage[],
  currentMessage: string,
  getSummary: () => BudgetSummary,
  context?: AdvancedAssistantContext
): string {
  const summary = getSummary();
  const trimmed = currentMessage.trim();
  const q = trimmed.toLowerCase();
  const lastAssistantContent = context?.lastAssistantContent ?? [...messages].reverse().find((m) => m.role === "assistant")?.content;
  const _lastUserContent = context?.lastUserContent;

  // Multi-step: "what next?" after a how-to
  const nextStep = getHowToNextStep(lastAssistantContent, trimmed);
  if (nextStep) return nextStep;

  // Resolve envelope from context (pronouns, ordinals, last-mentioned, or direct name)
  let contextEnvelope = resolveEnvelopeFromContext(trimmed, summary, lastAssistantContent);
  // Ambiguous "how much?" / "how much did I spend there?" with no envelope in message: use last-mentioned
  if (!contextEnvelope && (q === "how much?" || q === "how much" || /how much\s*(did i spend)?\s*(there|in it)?\s*\??$/i.test(trimmed))) {
    contextEnvelope = getLastMentionedEnvelopeName(lastAssistantContent, summary);
  }

  // ——— Envelope-specific (with context) ———
  if (contextEnvelope) {
    if (
      q.includes("left") ||
      q.includes("remain") ||
      q.includes("how much") ||
      q.includes("what about") ||
      q.includes("that one") ||
      q.includes("status") ||
      q === "how much?" ||
      q === "how much"
    ) {
      return `**${contextEnvelope.name}**: ${formatMoney(contextEnvelope.spent)} spent of ${formatMoney(contextEnvelope.limit)} (${formatMoney(contextEnvelope.remaining)} left).`;
    }
    if (q.includes("spent") || q.includes("spend") || /how much.*there|there.*spend/i.test(trimmed)) {
      return `You've spent **${formatMoney(contextEnvelope.spent)}** in **${contextEnvelope.name}** so far.`;
    }
  }

  // ——— Natural language: "how much is left in X", "what did I spend on Y" ———
  for (const env of summary.envelopes) {
    const name = env.name.toLowerCase();
    if (q.includes(name)) {
      if (q.includes("left") || q.includes("remain") || q.includes("how much")) {
        return `**${env.name}**: ${formatMoney(env.remaining)} remaining (${formatMoney(env.spent)} of ${formatMoney(env.limit)} spent).`;
      }
      if (q.includes("spent") || q.includes("spend")) {
        return `You've spent **${formatMoney(env.spent)}** in **${env.name}**.`;
      }
      return `**${env.name}**: ${formatMoney(env.spent)} / ${formatMoney(env.limit)} (${formatMoney(env.remaining)} left).`;
    }
  }

  // ——— Analytics insight: overspend / top spending ———
  if (
    (q.includes("overspend") || q.includes("over spend") || q.includes("top spend") || q.includes("most spend") || q.includes("where am i overspend")) &&
    summary.analyticsInsight
  ) {
    return summary.analyticsInsight;
  }

  // ——— Global: spent / left / income (natural phrasing) ———
  if (
    q.includes("spent") ||
    (q.includes("how much") && (q.includes("spend") || q.includes("spent"))) ||
    q.includes("total spend") ||
    q.includes("spending so far")
  ) {
    return `You've spent **${formatMoney(summary.totalSpent)}** total across all envelopes.`;
  }
  if (
    q.includes("left") ||
    q.includes("remaining") ||
    q.includes("remain") ||
    q.includes("how much do i have") ||
    q.includes("what do i have left")
  ) {
    return `You have **${formatMoney(summary.remaining)}** remaining in your budget (total budgeted minus spent).`;
  }
  if (q.includes("income") || q.includes("earn") || q.includes("make")) {
    return `Your total income recorded is **${formatMoney(summary.totalIncome)}**.`;
  }
  if (q.includes("budgeted") || q.includes("total budget")) {
    return `Your total budgeted amount is **${formatMoney(summary.totalBudgeted)}**.`;
  }

  // ——— Envelopes list (natural: "list envelopes", "what envelopes", "categories") ———
  if (
    q.includes("envelope") ||
    q.includes("categor") ||
    q.includes("list my") ||
    q.includes("what envelopes") ||
    q.includes("what categories")
  ) {
    if (summary.envelopes.length === 0) {
      return "You don't have any envelopes yet. Go to **Envelopes & Expenses** and create one at the bottom of the page.";
    }
    const list = summary.envelopes
      .map(
        (e) =>
          `• **${e.name}**: ${formatMoney(e.spent)} / ${formatMoney(e.limit)} (${formatMoney(e.remaining)} left)`
      )
      .join("\n");
    return `Your envelopes:\n${list}\n\nYou can ask me about a specific one, e.g. "How much is left in Groceries?"`;
  }

  // ——— How-to (natural) ———
  if (
    (q.includes("add") && (q.includes("expense") || q.includes("spend"))) ||
    q.includes("record an expense")
  ) {
    return "Go to **Envelopes & Expenses**, pick an envelope in the dropdown, enter the amount and description, then click **Add Expense**.";
  }
  if ((q.includes("add") && q.includes("income")) || q.includes("record income")) {
    return "Go to **Income**, enter the amount and source, then click **Add Income**.";
  }
  if (q.includes("help") || q.includes("what can") || q.includes("how do") || q.includes("what do you")) {
    return "I can answer questions about your budget: how much you've spent (in total or per envelope), what's left, income, envelopes, and how to add expenses or income. Ask in your own words—e.g. \"What's left in Groceries?\" or \"How much have I spent?\"";
  }
  if (q.length < 2) {
    return "Ask me about your budget—for example, \"How much have I spent?\", \"What's left in Groceries?\", or \"What envelopes do I have?\"";
  }

  // ——— Fallback: friendly, suggest context ———
  return "I'm not sure how to answer that. Try asking about spending (\"How much have I spent?\" or \"What's left in Groceries?\"), your envelopes (\"What envelopes do I have?\"), or how to add expenses or income. All answers use your data from this app—nothing leaves your device.";
}
