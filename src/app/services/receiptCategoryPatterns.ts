export const RECEIPT_CATEGORY_LABELS = ['groceries', 'gas', 'dining', 'shopping', 'other'] as const;
export type ReceiptCategoryLabel = (typeof RECEIPT_CATEGORY_LABELS)[number];

const PATTERNS: Record<ReceiptCategoryLabel, RegExp> = {
  groceries: /walmart|target|kroger|aldi|costco|safeway|publix|whole\s*foods|trader\s*joe|heb|food\s*lion|giant|stop\s*&\s*shop|wegmans|sprouts|winco|hy-vee|meijer|shoprite|acme|harris\s*teeter|kings|grocery|supermarket|market\s*basket/i,
  gas: /shell|exxon|chevron|bp|mobil|texaco|marathon|citgo|sunoco|valero|phillips\s*66|conoco|arco|casey's|kwik\s*trip|speedway|circle\s*k|gas\s*station|fuel|petrol/i,
  dining: /mcdonald|mcdonalds|burger\s*king|wendy's|taco\s*bell|starbucks|dunkin|subway|chipotle|pizza\s*hut|domino|papa\s*johns|kfc|popeyes|chick-fil-a|chickfila|panda\s*express|panera|dining|restaurant|cafe|coffee\s*shop|fast\s*food|grubhub|doordash|uber\s*eats/i,
  shopping: /amazon|best\s*buy|home\s*depot|lowes|walgreens|cvs|dollar\s*general|dollar\s*tree|tj\s*maxx|marshalls|ross|nordstrom|macy's|kohl's|bed\s*bath|ikea|staples|office\s*depot|gamestop|petco|petsmart|ulta|sephora|bath\s*&\s*body/i,
  other: /./,
};

const DEFAULT_CONFIDENCE = 0.7;

export interface ReceiptCategorySuggestion {
  category: ReceiptCategoryLabel;
  confidence: number;
}

/**
 * Suggest a receipt category from raw OCR text (merchant + first lines).
 * Uses regex patterns; confidence is fixed. Returns 'other' if no pattern matches.
 */
export function suggestCategoryFromRegex(receiptText: string): ReceiptCategorySuggestion {
  const text = receiptText.slice(0, 2000).replace(/\s+/g, ' ');
  const order: ReceiptCategoryLabel[] = ['groceries', 'gas', 'dining', 'shopping'];
  for (const cat of order) {
    if (PATTERNS[cat].test(text)) {
      return { category: cat, confidence: DEFAULT_CONFIDENCE };
    }
  }
  return { category: 'other', confidence: DEFAULT_CONFIDENCE };
}
