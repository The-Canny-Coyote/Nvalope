import {
  suggestCategoryFromRegex,
  type ReceiptCategorySuggestion,
} from '@/app/services/receiptCategoryPatterns';

export type ReceiptCategorizationEngine = 'regex';

export interface ReceiptCategoryResult {
  envelopeId?: string;
  category: string;
  confidence: number;
  engine: ReceiptCategorizationEngine;
}

function categoryToEnvelopeId(
  category: string,
  envelopes: Array<{ id: string; name: string }>
): string | undefined {
  const norm = category.toLowerCase().trim();
  const match = envelopes.find(
    (e) =>
      e.name.toLowerCase().trim() === norm ||
      e.name.toLowerCase().replace(/\s+/g, ' ').includes(norm)
  );
  return match?.id;
}

/**
 * Suggest a category (and optional envelope id) for receipt text.
 * Suggests a category (and optional envelope id) for receipt text using regex patterns.
 */
export async function suggestCategory(
  receiptText: string,
  envelopes: Array<{ id: string; name: string }>,
  _config: { preferRegex: boolean }
): Promise<ReceiptCategoryResult> {
  const result: ReceiptCategorySuggestion = suggestCategoryFromRegex(receiptText);
  const envelopeId = categoryToEnvelopeId(result.category, envelopes);
  return { envelopeId, category: result.category, confidence: result.confidence, engine: 'regex' };
}
