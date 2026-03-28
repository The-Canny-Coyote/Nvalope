import { describe, expect, it } from 'vitest';
import {
  buildTransactionDrafts,
  suggestEnvelopeForDescription,
  suggestionGroupKey,
} from './suggestEnvelope';
import type { Envelope } from '@/app/store/budgetTypes';

const envelopes: Envelope[] = [
  { id: 'e1', name: 'Groceries', limit: 400, spent: 0 },
  { id: 'e2', name: 'Gas & fuel', limit: 200, spent: 0 },
  { id: 'e3', name: 'Fun money', limit: 100, spent: 0 },
];

describe('suggestEnvelopeForDescription', () => {
  it('maps grocery merchant text to Groceries envelope', () => {
    const s = suggestEnvelopeForDescription('KROGER #1234', envelopes);
    expect(s.suggestedEnvelopeId).toBe('e1');
    expect(s.suggestionLabel).toBe('groceries');
  });

  it('maps gas station text to Gas envelope', () => {
    const s = suggestEnvelopeForDescription('SHELL OIL 5743', envelopes);
    expect(s.suggestedEnvelopeId).toBe('e2');
  });

  it('returns label only when no envelope matches', () => {
    const s = suggestEnvelopeForDescription('RANDOM VENDOR XYZ', []);
    expect(s.suggestedEnvelopeId).toBeUndefined();
    expect(s.suggestionLabel).toBe('other');
  });
});

describe('buildTransactionDrafts and suggestionGroupKey', () => {
  it('builds drafts with chosen envelope defaulting to suggestion', () => {
    const drafts = buildTransactionDrafts(
      [{ amount: 10, description: 'Walmart food', date: '2025-01-01' }],
      envelopes
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].chosenEnvelopeId).toBe(drafts[0].suggestedEnvelopeId);
    expect(suggestionGroupKey(drafts[0])).toMatch(/e1|uncategorized/);
  });
});
