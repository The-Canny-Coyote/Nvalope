/**
 * Transformers.js receipt category suggestion (lazy-loaded).
 * Used when WebLLM is not available. On load or inference failure, caller falls back to regex.
 * Models are downloaded from Hugging Face Hub and cached in the browser; no data is sent off-device.
 */

import type { ReceiptCategoryLabel } from '@/app/services/receiptCategoryPatterns';

const CANDIDATE_LABELS: ReceiptCategoryLabel[] = ['groceries', 'gas', 'dining', 'shopping', 'other'];

export interface TransformersCategoryResult {
  category: ReceiptCategoryLabel;
  confidence: number;
}

/**
 * Suggest receipt category using Transformers.js zero-shot classification.
 * Lazy-loads @huggingface/transformers; throws on failure so caller can fall back to regex.
 */
export async function getReceiptCategoryFromTransformers(
  receiptText: string
): Promise<TransformersCategoryResult> {
  const text = receiptText.slice(0, 2000).trim();
  if (!text) {
    return { category: 'other', confidence: 0.5 };
  }
  const { pipeline } = await import('@huggingface/transformers');
  const classifier = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli', {
    dtype: 'q8',
  });
  const result = await classifier(text, CANDIDATE_LABELS, { multi_label: false });
  const single = Array.isArray(result) ? result[0] : result;
  const labels = single?.labels != null && Array.isArray(single.labels) ? single.labels : [];
  const scores = single?.scores != null && Array.isArray(single.scores) ? single.scores : [];
  const idx = labels.findIndex((l: string) => CANDIDATE_LABELS.includes(l as ReceiptCategoryLabel));
  const category = (idx >= 0 ? labels[idx] : 'other') as ReceiptCategoryLabel;
  const confidence = idx >= 0 && typeof scores[idx] === 'number' ? scores[idx] : 0.5;
  return { category, confidence };
}
