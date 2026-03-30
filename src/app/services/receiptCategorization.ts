import { getWebLLMBlockReasons, isWebLLMEngineLoaded, getReceiptCategoryFromWebLLM } from '@/app/services/webLLMAssistant';
import { getReceiptCategoryFromTransformers } from '@/app/services/receiptTransformers';
import {
  suggestCategoryFromRegex,
  type ReceiptCategorySuggestion,
} from '@/app/services/receiptCategoryPatterns';

export type ReceiptCategorizationEngine = 'webllm' | 'transformers' | 'regex';

/** User settings that affect engine selection; supplied by React callers (not read from the store here). */
export type ReceiptCategorizationConfig = {
  preferRegex: boolean;
  webLLMEnabled: boolean;
  hasPremiumAi?: boolean;
};

const PWA_INSTALLED_KEY = 'nvalopePWAInstalled';

function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PWA_INSTALLED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Determine which engine to use for receipt categorization.
 * If user chose "keyword matching only" in Settings, always use regex.
 * Otherwise: WebLLM when capable, enabled, premium_ai, and already loaded (optional PWA); else transformers then regex.
 */
export function getReceiptCategorizationEngine(config: ReceiptCategorizationConfig): ReceiptCategorizationEngine {
  if (config.preferRegex) return 'regex';
  const webLLMEnabled = config.webLLMEnabled;
  if (
    !config.preferRegex &&
    getWebLLMBlockReasons().length === 0 &&
    webLLMEnabled &&
    isWebLLMEngineLoaded() &&
    config.hasPremiumAi === true &&
    isPWAInstalled()
  ) {
    return 'webllm';
  }
  return 'transformers';
}

export interface ReceiptCategoryResult {
  envelopeId?: string;
  category: string;
  confidence: number;
  engine: ReceiptCategorizationEngine;
}

function categoryToEnvelopeId(category: string, envelopes: Array<{ id: string; name: string }>): string | undefined {
  const norm = category.toLowerCase().trim();
  const match = envelopes.find(
    (e) => e.name.toLowerCase().trim() === norm || e.name.toLowerCase().replace(/\s+/g, ' ').includes(norm)
  );
  return match?.id;
}

/**
 * Suggest a category (and optional envelope id) for receipt text.
 * WebLLM when engine is webllm; then Transformers.js (lazy); on any failure falls back to regex. Maps category to envelope by name.
 */
export async function suggestCategory(
  receiptText: string,
  envelopes: Array<{ id: string; name: string }>,
  config: ReceiptCategorizationConfig
): Promise<ReceiptCategoryResult> {
  const engine = getReceiptCategorizationEngine(config);
  if (engine === 'webllm') {
    try {
      const { category, confidence } = await getReceiptCategoryFromWebLLM(receiptText);
      const envelopeId = categoryToEnvelopeId(category, envelopes);
      return { envelopeId, category, confidence, engine: 'webllm' };
    } catch {
      const fallback: ReceiptCategorySuggestion = suggestCategoryFromRegex(receiptText);
      const envelopeId = categoryToEnvelopeId(fallback.category, envelopes);
      return { envelopeId, category: fallback.category, confidence: fallback.confidence, engine: 'regex' };
    }
  }
  if (engine === 'transformers') {
    try {
      const { category, confidence } = await getReceiptCategoryFromTransformers(receiptText);
      const envelopeId = categoryToEnvelopeId(category, envelopes);
      return { envelopeId, category, confidence, engine: 'transformers' };
    } catch {
      const fallback: ReceiptCategorySuggestion = suggestCategoryFromRegex(receiptText);
      const envelopeId = categoryToEnvelopeId(fallback.category, envelopes);
      return { envelopeId, category: fallback.category, confidence: fallback.confidence, engine: 'regex' };
    }
  }
  const result: ReceiptCategorySuggestion = suggestCategoryFromRegex(receiptText);
  const envelopeId = categoryToEnvelopeId(result.category, envelopes);
  return { envelopeId, category: result.category, confidence: result.confidence, engine: 'regex' };
}
