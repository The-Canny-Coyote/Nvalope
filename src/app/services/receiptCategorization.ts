/**
 * Receipt categorization: engine selection (capability + install) and suggestCategory.
 * Priority: WebLLM when capable, enabled, and already loaded (optional PWA); else regex.
 * Does not start WebLLM download from receipt scanner.
 */

import { useAppStore } from '@/app/store/appStore';
import { isWebLLMEligible, isWebLLMEngineLoaded, getReceiptCategoryFromWebLLM } from '@/app/services/webLLMAssistant';
import { getReceiptCategoryFromTransformers } from '@/app/services/receiptTransformers';
import {
  suggestCategoryFromRegex,
  type ReceiptCategorySuggestion,
} from '@/app/services/receiptCategoryPatterns';

export type ReceiptCategorizationEngine = 'webllm' | 'transformers' | 'regex';

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
 * Otherwise: WebLLM when capable, enabled, and already loaded (optional PWA); else transformers then regex.
 */
export function getReceiptCategorizationEngine(): ReceiptCategorizationEngine {
  if (useAppStore.getState().receiptCategoryPreferRegex) return 'regex';
  const webLLMEnabled = useAppStore.getState().webLLMEnabled;
  if (isWebLLMEligible() && webLLMEnabled && isWebLLMEngineLoaded()) {
    if (isPWAInstalled()) {
      return 'webllm';
    }
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
  envelopes: Array<{ id: string; name: string }>
): Promise<ReceiptCategoryResult> {
  const engine = getReceiptCategorizationEngine();
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
