/**
 * WebLLM adapter for Cache assistant: in-browser LLM inference when device has
 * sufficient specs and WebGPU. All data stays on-device; no cloud API.
 */

import { getDevicePerformanceTier } from '@/app/utils/deviceCapabilities';
import { formatMoney } from '@/app/utils/format';

/** Minimal transaction shape for the WebLLM system prompt (envelope name resolved by caller). */
export type RecentTransactionForWebLLM = { amount: number; description: string; envelopeName?: string };

export type BudgetSummaryForWebLLM = {
  totalIncome: number;
  totalBudgeted: number;
  totalSpent: number;
  remaining: number;
  envelopes: Array<{ name: string; limit: number; spent: number; remaining: number }>;
  analyticsInsight?: string;
  /** When set, amounts are for this period (e.g. "Period 1 (Jan 1–14)"). */
  periodLabel?: string;
  /** Recent transactions for the current period (capped in buildSystemPrompt). */
  recentTransactions?: RecentTransactionForWebLLM[];
};

export type ChatMessageForWebLLM = { role: 'user' | 'assistant'; content: string };

export type WebLLMProgressReport = { text: string; progress?: number };

/** Whether the device is eligible for WebLLM (medium/high tier + WebGPU). */
export function isWebLLMEligible(): boolean {
  if (typeof navigator === 'undefined') return false;
  const tier = getDevicePerformanceTier();
  if (tier === 'low') return false;
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
  return gpu != null;
}

const DEFAULT_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
const MAX_CONTEXT_MESSAGES = 10;
/** Cap user message length to limit prompt-injection surface and token/memory use. */
export const MAX_USER_MESSAGE_LENGTH = 2000;
/** Cap each message in context (history) to limit token/memory and injection surface. */
const MAX_CONTEXT_MESSAGE_LENGTH = 2000;

/** Truncate user message for WebLLM (for testing and single use in getWebLLMReply). */
export function capUserMessageForWebLLM(userMessage: string): string {
  return userMessage.length > MAX_USER_MESSAGE_LENGTH
    ? userMessage.slice(0, MAX_USER_MESSAGE_LENGTH) + '…'
    : userMessage;
}

function capMessageContent(content: string): string {
  return content.length > MAX_CONTEXT_MESSAGE_LENGTH
    ? content.slice(0, MAX_CONTEXT_MESSAGE_LENGTH) + '…'
    : content;
}

let engineInstance: Awaited<ReturnType<typeof loadWebLLMEngine>> | null = null;
let loadPromise: Promise<import('@mlc-ai/web-llm').MLCEngineInterface> | null = null;

/** Whether the WebLLM engine is already loaded (and ready to use). */
export function isWebLLMEngineLoaded(): boolean {
  return engineInstance != null;
}

/** Build system prompt from budget summary; mode differentiates Standard vs Premium. */
export function buildSystemPrompt(
  summary: BudgetSummaryForWebLLM,
  aiMode: 'basic' | 'advanced'
): string {
  const lines: string[] = [
    "You are Cache the AI Assistant, a friendly budget assistant. You help the user understand their envelope budget. All data you see is real and local; do not make up numbers.",
    "",
    ...(summary.periodLabel ? [`Current period: ${summary.periodLabel}. Amounts below are for this period.`, ""] : []),
    "Budget summary:",
    `- Total income: ${formatMoney(summary.totalIncome)}`,
    `- Total budgeted: ${formatMoney(summary.totalBudgeted)}`,
    `- Total spent: ${formatMoney(summary.totalSpent)}`,
    `- Remaining: ${formatMoney(summary.remaining)}`,
    "",
    "Envelopes (name, limit, spent, remaining):",
    ...summary.envelopes.map(
      (e) => `- ${e.name}: limit ${formatMoney(e.limit)}, spent ${formatMoney(e.spent)}, remaining ${formatMoney(e.remaining)}`
    ),
  ];
  if (summary.analyticsInsight) {
    lines.push("", "Analytics insight: " + summary.analyticsInsight);
  }
  const maxRecentTx = 20;
  const maxRecentTxChars = 2000;
  if (summary.recentTransactions && summary.recentTransactions.length > 0) {
    const txs = summary.recentTransactions.slice(0, maxRecentTx);
    let txText = txs
      .map(
        (t) =>
          `- ${formatMoney(t.amount)}: ${(t.description || '').trim() || 'No description'}${t.envelopeName ? ` (${t.envelopeName})` : ''}`
      )
      .join("\n");
    if (txText.length > maxRecentTxChars) {
      txText = txText.slice(0, maxRecentTxChars) + "\n…";
    }
    lines.push("", "Recent transactions:", txText);
  }
  if (aiMode === 'advanced') {
    lines.push(
      "",
      "Use the recent conversation to resolve references like 'there', 'that one', or 'that envelope' to the last envelope discussed. If the user asks a short follow-up (e.g. 'How much?' or 'And Dining Out?'), infer they mean the same kind of question about the mentioned envelope or the new one."
    );
  }
  lines.push("", "Reply in plain language. You can use **bold** for amounts. Keep answers concise. Do not give financial, tax, or investment advice.");
  return lines.join("\n");
}

/** Load the WebLLM engine; call when WebLLM is enabled (e.g. on toggle or first message). */
export async function loadWebLLMEngine(
  onProgress?: (report: WebLLMProgressReport) => void
): Promise<import('@mlc-ai/web-llm').MLCEngineInterface> {
  if (engineInstance) return engineInstance;
  if (loadPromise) return loadPromise;
  if (!isWebLLMEligible()) {
    throw new Error('WebLLM not eligible');
  }
  loadPromise = (async () => {
    const webllm = await import('@mlc-ai/web-llm');
    const initProgressCallback = (report: { text?: string; progress?: number }) => {
      onProgress?.({ text: report.text ?? '', progress: report.progress });
    };
    const engine = await webllm.CreateMLCEngine(
      DEFAULT_MODEL_ID,
      {
        initProgressCallback,
        logLevel: 'WARN',
      },
      { context_window_size: 2048 }
    );
    engineInstance = engine;
    loadPromise = null;
    return engine;
  })();
  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null;
    throw err;
  }
}

/** Unload the engine (e.g. when user disables WebLLM). */
export async function unloadWebLLMEngine(): Promise<void> {
  if (!engineInstance) return;
  loadPromise = null;
  try {
    if ('unload' in engineInstance && typeof engineInstance.unload === 'function') {
      await (engineInstance as { unload: () => Promise<void> }).unload();
    }
  } finally {
    engineInstance = null;
  }
}

const CACHE_CLEAR_TIMEOUT_MS = 15_000;

/** Delete WebLLM cached model data from the browser (Cache Storage). Call after unload when user chooses to free space. Next load will redownload. Resolves after work or timeout so UI never hangs. */
export async function clearWebLLMCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(resolve, CACHE_CLEAR_TIMEOUT_MS);
  });
  const clearPromise = (async () => {
    try {
      const names = await caches.keys();
      const toDelete = names.filter((name) => {
        const lower = name.toLowerCase();
        return lower.includes('webllm') || lower.startsWith('mlc-') || lower.includes('mlcengine');
      });
      await Promise.all(toDelete.map((name) => caches.delete(name)));
    } catch {
      // Ignore; cache may be in use or unavailable
    }
  })();
  await Promise.race([clearPromise, timeoutPromise]);
}

/** Get a reply from the WebLLM engine. Call after loadWebLLMEngine has resolved. */
export async function getWebLLMReply(
  summary: BudgetSummaryForWebLLM,
  messages: ChatMessageForWebLLM[],
  userMessage: string,
  aiMode: 'basic' | 'advanced'
): Promise<string> {
  const engine = engineInstance;
  if (!engine) throw new Error('WebLLM engine not loaded');

  const cappedUserMessage = capUserMessageForWebLLM(userMessage);

  const systemPrompt = buildSystemPrompt(summary, aiMode);
  const recent = messages.slice(-MAX_CONTEXT_MESSAGES);
  const chatMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...recent.map((m) => ({ role: m.role, content: capMessageContent(m.content) })),
    { role: 'user', content: cappedUserMessage },
  ];

  const response = await engine.chat.completions.create({
    messages: chatMessages,
    temperature: 0.3,
    max_tokens: 512,
    stream: false,
  });

  const trimmed = extractReplyContentFromResponse(response);
  return trimmed;
}

/**
 * Extract and validate reply content from a chat completion response.
 * Prefers OpenAI-like shape (choices[0].message.content); fallback for alternate library shapes.
 * Exported for unit tests (empty/invalid response handling).
 */
export function extractReplyContentFromResponse(response: unknown): string {
  const choice = (response as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0];
  let content: unknown = choice?.message?.content;
  if (typeof content !== 'string') {
    const msg = (response as { message?: { content?: unknown } }).message?.content;
    if (typeof msg === 'string') content = msg;
  }
  if (typeof content !== 'string') {
    throw new Error('Invalid WebLLM response');
  }
  const trimmed = content.trim();
  if (trimmed === '') {
    throw new Error('WebLLM returned empty reply');
  }
  return trimmed;
}

/** Receipt category labels for WebLLM prompt (must match receiptCategoryPatterns). */
const RECEIPT_CATEGORIES = 'groceries, gas, dining, shopping, other';

/**
 * Get a receipt category suggestion from the WebLLM engine (for receipt scanner).
 * Call only when engine is already loaded (isWebLLMEngineLoaded() === true).
 * Returns category and confidence; on parse failure returns category "other" and confidence 0.5.
 */
export async function getReceiptCategoryFromWebLLM(receiptText: string): Promise<{ category: string; confidence: number }> {
  const engine = engineInstance;
  if (!engine) {
    return { category: 'other', confidence: 0.5 };
  }
  const truncated = receiptText.slice(0, 1500).replace(/"/g, "'");
  const userContent = `Receipt text:\n${truncated}\n\nRespond with only a single JSON object, no other text: {"category": "one of ${RECEIPT_CATEGORIES}", "confidence": number 0-1}`;
  const response = await engine.chat.completions.create({
    messages: [{ role: 'user', content: userContent }],
    temperature: 0.2,
    max_tokens: 80,
    stream: false,
  });
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    return { category: 'other', confidence: 0.5 };
  }
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { category: 'other', confidence: 0.5 };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { category?: string; confidence?: number };
    const category = typeof parsed.category === 'string' ? parsed.category.toLowerCase().trim() : 'other';
    const valid = ['groceries', 'gas', 'dining', 'shopping', 'other'].includes(category)
      ? category
      : 'other';
    const confidence =
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.7;
    return { category: valid, confidence };
  } catch {
    return { category: 'other', confidence: 0.5 };
  }
}
