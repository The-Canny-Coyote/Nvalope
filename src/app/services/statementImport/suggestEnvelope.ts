import type { Envelope } from '@/app/store/budgetTypes';
import {
  suggestCategoryFromRegex,
  type ReceiptCategoryLabel,
} from '@/app/services/receiptCategoryPatterns';
import type { DuplicateResolution, StatementImportQueueItem } from '@/app/services/statementImport/types';

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Keywords on envelope names that align with receipt category labels. */
const LABEL_NAME_HINTS: Record<ReceiptCategoryLabel, readonly string[]> = {
  groceries: ['grocery', 'groceries', 'food'],
  gas: ['gas', 'fuel', 'petrol', 'auto'],
  dining: ['dining', 'restaurant', 'eat out', 'takeout', 'coffee'],
  shopping: ['shopping', 'retail', 'misc', 'general'],
  other: [],
};

export interface EnvelopeSuggestion {
  suggestionLabel: ReceiptCategoryLabel;
  suggestedEnvelopeId?: string;
  suggestedEnvelopeName?: string;
}

function scoreEnvelopeForLabel(envelope: Envelope, label: ReceiptCategoryLabel): number {
  const name = norm(envelope.name);
  if (label === 'other') return 0;
  if (name === label) return 100;
  if (name.includes(label)) return 85;
  for (const hint of LABEL_NAME_HINTS[label]) {
    if (name.includes(hint)) return 70;
  }
  return 0;
}

/**
 * Suggest a budget envelope from transaction description using receipt keyword patterns,
 * then match to the user's envelope names.
 */
export function suggestEnvelopeForDescription(
  description: string,
  envelopes: readonly Envelope[]
): EnvelopeSuggestion {
  const { category } = suggestCategoryFromRegex(description);
  let best: Envelope | undefined;
  let bestScore = 0;
  for (const env of envelopes) {
    const s = scoreEnvelopeForLabel(env, category);
    if (s > bestScore) {
      bestScore = s;
      best = env;
    }
  }
  if (best && bestScore > 0) {
    return {
      suggestionLabel: category,
      suggestedEnvelopeId: best.id,
      suggestedEnvelopeName: best.name,
    };
  }
  const desc = norm(description);
  for (const env of envelopes) {
    const n = norm(env.name);
    if (n.length >= 3 && desc.includes(n)) {
      return {
        suggestionLabel: category,
        suggestedEnvelopeId: env.id,
        suggestedEnvelopeName: env.name,
      };
    }
  }
  return { suggestionLabel: category };
}

export interface StatementImportTransactionDraft {
  amount: number;
  description: string;
  date: string;
  suggestionLabel: ReceiptCategoryLabel;
  suggestedEnvelopeId?: string;
  /** User-selected envelope id, or undefined for uncategorized. */
  chosenEnvelopeId?: string;
  importHash: string;
  confidenceScore: number;
  duplicateMatch?: { transactionId: string; kind: 'exact' | 'loose' };
  isHashCollision?: boolean;
  duplicateResolution: DuplicateResolution;
  /** Envelope from assignment rules (quick import uses this when set). */
  sourceRuleEnvelopeId?: string;
}

/**
 * Build review drafts from classified debit transactions and current envelopes.
 */
export function buildTransactionDrafts(
  transactions: ReadonlyArray<{ amount: number; description: string; date: string }>,
  envelopes: readonly Envelope[]
): StatementImportTransactionDraft[] {
  return transactions.map((tx) => {
    const s = suggestEnvelopeForDescription(tx.description, envelopes);
    return {
      amount: tx.amount,
      description: tx.description,
      date: tx.date,
      suggestionLabel: s.suggestionLabel,
      suggestedEnvelopeId: s.suggestedEnvelopeId,
      chosenEnvelopeId: s.suggestedEnvelopeId,
      importHash: '',
      confidenceScore: 0.5,
      duplicateResolution: 'import',
      sourceRuleEnvelopeId: undefined,
    };
  });
}

/** Build review drafts from classified import queue (rules + keyword suggestions). */
export function buildImportQueueDrafts(
  queue: readonly StatementImportQueueItem[],
  envelopes: readonly Envelope[]
): StatementImportTransactionDraft[] {
  return queue.map((item) => {
    const s = suggestEnvelopeForDescription(item.description, envelopes);
    const ruleId = item.ruleEnvelopeId;
    const ruleOk = ruleId && envelopes.some((e) => e.id === ruleId);
    const suggested = ruleOk ? ruleId : s.suggestedEnvelopeId;
    return {
      amount: item.amount,
      description: item.description,
      date: item.date,
      suggestionLabel: s.suggestionLabel,
      suggestedEnvelopeId: suggested,
      chosenEnvelopeId: suggested,
      importHash: item.importHash,
      confidenceScore: item.confidenceScore,
      duplicateMatch: item.duplicateMatch,
      isHashCollision: item.isHashCollision,
      duplicateResolution: item.duplicateResolution,
      sourceRuleEnvelopeId: item.ruleEnvelopeId,
    };
  });
}

/** Group key for clustered review UI: stable id for suggested bucket. */
export function suggestionGroupKey(draft: StatementImportTransactionDraft): string {
  return draft.suggestedEnvelopeId ?? `uncategorized:${draft.suggestionLabel}`;
}
