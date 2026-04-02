import { getDevicePerformanceTier, type PerformanceTier } from '@/app/utils/deviceCapabilities';
import { formatMoney } from '@/app/utils/format';
import { truncate } from '@/app/utils/truncate';

/** Strip newlines, carriage returns, and control characters from user-supplied
 *  strings before they are interpolated into the WebLLM system prompt.
 *  Prevents prompt injection via crafted envelope names or transaction descriptions. */
function sanitizeForPrompt(value: string, maxLength = 120): string {
  let cleaned = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13 || code < 32 || code === 127) {
      cleaned += ' ';
    } else {
      cleaned += value[i];
    }
  }
  return cleaned.replace(/\s{2,}/g, ' ').trim().slice(0, maxLength);
}

/** Minimal transaction shape for the WebLLM system prompt (envelope name resolved by caller). */
export type WebLLMRecentTransaction = { amount: number; description: string; envelopeName?: string };

export type WebLLMBudgetSummary = {
  totalIncome: number;
  totalBudgeted: number;
  totalSpent: number;
  remaining: number;
  envelopes: Array<{ name: string; limit: number; spent: number; remaining: number }>;
  analyticsInsight?: string;
  /** When set, amounts are for this period (e.g. "Period 1 (Jan 1–14)"). */
  periodLabel?: string;
  /** Recent transactions for the current period (capped in buildSystemPrompt). */
  recentTransactions?: WebLLMRecentTransaction[];
};

export type WebLLMChatMessage = { role: 'user' | 'assistant'; content: string };

export type WebLLMEngineLoadProgress = { text: string; progress?: number };

/** On-device signals for support and troubleshooting (no network; stays in the UI). */
export type WebLLMRuntimeSnapshot = {
  secureContext: boolean;
  webGpuPresent: boolean;
  crossOriginIsolated: boolean;
  performanceTier: PerformanceTier;
  engineLoaded: boolean;
};

/**
 * Plain-language blockers for showing local AI in Settings or the assistant.
 * Empty array means the device is eligible for WebLLM (same as `reasons.length === 0`).
 */
export function getWebLLMBlockReasons(): string[] {
  if (typeof navigator === 'undefined') {
    return ['In-browser AI isn’t available in this environment.'];
  }
  const reasons: string[] = [];
  if (globalThis.isSecureContext === false) {
    reasons.push('Open the app over HTTPS or localhost. Browsers require a secure page for WebGPU and local AI.');
  }
  const tier = getDevicePerformanceTier();
  if (tier === 'low') {
    reasons.push('This device is below the minimum memory/CPU profile for local AI.');
  }
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
  if (gpu == null) {
    reasons.push('WebGPU isn’t available. Use a recent Chrome, Edge, or another WebGPU-capable browser.');
  }
  return reasons;
}

/** Snapshot for user-visible troubleshooting (Settings / assistant). No logging or telemetry. */
export function getWebLLMEnvironmentSnapshot(): WebLLMRuntimeSnapshot {
  const tier = typeof navigator === 'undefined' ? ('low' as PerformanceTier) : getDevicePerformanceTier();
  const g = globalThis as typeof globalThis & { isSecureContext?: boolean; crossOriginIsolated?: boolean };
  const secureContext = g.isSecureContext !== false;
  const gpu = typeof navigator !== 'undefined' ? (navigator as Navigator & { gpu?: unknown }).gpu : undefined;
  const crossOriginIsolated = g.crossOriginIsolated === true;
  return {
    secureContext,
    webGpuPresent: gpu != null,
    crossOriginIsolated,
    performanceTier: tier,
    engineLoaded: isWebLLMEngineLoaded(),
  };
}

const DEFAULT_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
const FALLBACK_MODEL_IDS: string[] = [
  DEFAULT_MODEL_ID,
  // Smaller/alternate models to reduce reliance on a single upstream host path.
  'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  'TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC',
  'phi-1_5-q4f16_1-MLC',
];
const MAX_CONTEXT_MESSAGES = 6;
/** Max length for the latest user message sent to WebLLM (prompt-injection / token limit). */
export const MAX_USER_MESSAGE_LENGTH = 2000;
/** Max length for each prior chat message in WebLLM context. */
const MAX_CONTEXT_MESSAGE_LENGTH = 2000;

let engineInstance: Awaited<ReturnType<typeof loadWebLLMEngine>> | null = null;
let loadPromise: Promise<import('@mlc-ai/web-llm').MLCEngineInterface> | null = null;

/** Whether the WebLLM engine is already loaded (and ready to use). */
export function isWebLLMEngineLoaded(): boolean {
  return engineInstance != null;
}

/** Build system prompt from budget summary; mode differentiates Standard vs Premium. */
export function buildSystemPrompt(
  summary: WebLLMBudgetSummary,
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
      (e) => `- ${sanitizeForPrompt(e.name)}: limit ${formatMoney(e.limit)}, spent ${formatMoney(e.spent)}, remaining ${formatMoney(e.remaining)}`
    ),
  ];
  if (summary.analyticsInsight) {
    lines.push("", "Analytics insight: " + sanitizeForPrompt(summary.analyticsInsight ?? '', 200));
  }
  const maxRecentTx = 20;
  const maxRecentTxChars = 2000;
  if (summary.recentTransactions && summary.recentTransactions.length > 0) {
    const txs = summary.recentTransactions.slice(0, maxRecentTx);
    let txText = txs
      .map(
        (t) =>
          `- ${formatMoney(t.amount)}: ${sanitizeForPrompt((t.description || '').trim() || 'No description', 80)}${t.envelopeName ? ` (${sanitizeForPrompt(t.envelopeName)})` : ''}`
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
  onProgress?: (report: WebLLMEngineLoadProgress) => void
): Promise<import('@mlc-ai/web-llm').MLCEngineInterface> {
  if (engineInstance) return engineInstance;
  if (loadPromise) return loadPromise;
  if (getWebLLMBlockReasons().length > 0) {
    throw new Error('WebLLM not eligible');
  }
  loadPromise = (async () => {
    const webllm = await import('@mlc-ai/web-llm');
    const initProgressCallback = (report: { text?: string; progress?: number }) => {
      onProgress?.({ text: report.text ?? '', progress: report.progress });
    };
    let lastErr: unknown;
    for (let idx = 0; idx < FALLBACK_MODEL_IDS.length; idx++) {
      const modelId = FALLBACK_MODEL_IDS[idx];
      if (idx > 0) {
        onProgress?.({
          text: 'Retrying local AI model download with a smaller fallback…',
          progress: undefined,
        });
      }
      try {
        const engine = await webllm.CreateMLCEngine(
          modelId,
          {
            initProgressCallback,
            logLevel: 'WARN',
          },
          { context_window_size: 2048 }
        );
        engineInstance = engine;
        loadPromise = null;
        return engine;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error('WebLLM model load failed');
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
  summary: WebLLMBudgetSummary,
  messages: WebLLMChatMessage[],
  userMessage: string,
  aiMode: 'basic' | 'advanced'
): Promise<string> {
  const engine = engineInstance;
  if (!engine) throw new Error('WebLLM engine not loaded');

  const truncatedUserMessage = truncate(userMessage, MAX_USER_MESSAGE_LENGTH);

  const systemPrompt = buildSystemPrompt(summary, aiMode);
  const recent = messages.slice(-MAX_CONTEXT_MESSAGES);
  const chatMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...recent.map((m) => ({ role: m.role, content: truncate(m.content, MAX_CONTEXT_MESSAGE_LENGTH) })),
    { role: 'user', content: truncatedUserMessage },
  ];

  const response = await engine.chat.completions.create({
    messages: chatMessages,
    temperature: 0.3,
    max_tokens: 512,
    stream: false,
  });

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

