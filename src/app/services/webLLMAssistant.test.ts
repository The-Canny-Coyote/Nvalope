import { describe, it, expect } from 'vitest';
import {
  MAX_USER_MESSAGE_LENGTH,
  capUserMessageForWebLLM,
  buildSystemPrompt,
  isWebLLMEligible,
  extractReplyContentFromResponse,
} from './webLLMAssistant';

describe('webLLMAssistant', () => {
  describe('capUserMessageForWebLLM (security hardening)', () => {
    it('returns short message unchanged', () => {
      const short = 'How much have I spent?';
      expect(capUserMessageForWebLLM(short)).toBe(short);
    });

    it('returns message at exactly MAX_USER_MESSAGE_LENGTH unchanged', () => {
      const exact = 'x'.repeat(MAX_USER_MESSAGE_LENGTH);
      expect(capUserMessageForWebLLM(exact)).toBe(exact);
      expect(capUserMessageForWebLLM(exact).length).toBe(MAX_USER_MESSAGE_LENGTH);
    });

    it('truncates long message to MAX_USER_MESSAGE_LENGTH + ellipsis', () => {
      const long = 'y'.repeat(3000);
      const capped = capUserMessageForWebLLM(long);
      expect(capped.length).toBe(MAX_USER_MESSAGE_LENGTH + 1);
      expect(capped.slice(0, MAX_USER_MESSAGE_LENGTH)).toBe('y'.repeat(MAX_USER_MESSAGE_LENGTH));
      expect(capped.slice(-1)).toBe('…');
    });
  });

  describe('buildSystemPrompt', () => {
    it('includes budget summary and envelope list', () => {
      const summary = {
        totalIncome: 3000,
        totalBudgeted: 2800,
        totalSpent: 500,
        remaining: 2300,
        envelopes: [
          { name: 'Groceries', limit: 400, spent: 100, remaining: 300 },
          { name: 'Dining', limit: 200, spent: 50, remaining: 150 },
        ],
        periodLabel: undefined,
      };
      const prompt = buildSystemPrompt(summary, 'basic');
      expect(prompt).toContain('Total income');
      expect(prompt).toContain('3,000'); // amount from summary (locale may format differently)
      expect(prompt).toContain('Groceries');
      expect(prompt).toContain('Dining');
      expect(prompt).toContain('Reply in plain language');
    });

    it('includes advanced instructions when aiMode is advanced', () => {
      const summary = {
        totalIncome: 0,
        totalBudgeted: 0,
        totalSpent: 0,
        remaining: 0,
        envelopes: [],
        periodLabel: undefined,
      };
      const promptAdvanced = buildSystemPrompt(summary, 'advanced');
      const promptBasic = buildSystemPrompt(summary, 'basic');
      expect(promptAdvanced).toContain('recent conversation');
      expect(promptAdvanced).toContain('that one');
      expect(promptBasic).not.toContain('that one');
    });

    it('does not include Recent transactions when summary has none', () => {
      const summary = {
        totalIncome: 3000,
        totalBudgeted: 2800,
        totalSpent: 500,
        remaining: 2300,
        envelopes: [{ name: 'Groceries', limit: 400, spent: 100, remaining: 300 }],
        periodLabel: undefined,
      };
      const prompt = buildSystemPrompt(summary, 'basic');
      expect(prompt).not.toContain('Recent transactions:');
    });

    it('includes recent transactions when present', () => {
      const summary = {
        totalIncome: 3000,
        totalBudgeted: 2800,
        totalSpent: 500,
        remaining: 2300,
        envelopes: [
          { name: 'Groceries', limit: 400, spent: 100, remaining: 300 },
          { name: 'Dining', limit: 200, spent: 50, remaining: 150 },
        ],
        periodLabel: undefined,
        recentTransactions: [
          { amount: 52, description: 'Supermarket weekly shop', envelopeName: 'Groceries' },
          { amount: 25, description: 'Lunch at café', envelopeName: 'Dining' },
        ],
      };
      const prompt = buildSystemPrompt(summary, 'basic');
      expect(prompt).toContain('Recent transactions:');
      expect(prompt).toContain('52'); // amount (locale may format as 52.00 or 52)
      expect(prompt).toContain('Supermarket weekly shop');
      expect(prompt).toContain('Groceries');
      expect(prompt).toContain('Lunch at café');
      expect(prompt).toContain('Dining');
    });
  });

  describe('extractReplyContentFromResponse', () => {
    it('returns trimmed content from OpenAI-like shape', () => {
      const response = { choices: [{ message: { content: '  You have $100 left.  ' } }] };
      expect(extractReplyContentFromResponse(response)).toBe('You have $100 left.');
    });

    it('returns content from alternate shape (message.content)', () => {
      const response = { message: { content: 'Your total spent is $500.' } };
      expect(extractReplyContentFromResponse(response)).toBe('Your total spent is $500.');
    });

    it('throws on missing or non-string content', () => {
      expect(() => extractReplyContentFromResponse({})).toThrow('Invalid WebLLM response');
      expect(() => extractReplyContentFromResponse({ choices: [] })).toThrow('Invalid WebLLM response');
      expect(() => extractReplyContentFromResponse({ choices: [{}] })).toThrow('Invalid WebLLM response');
      expect(() => extractReplyContentFromResponse({ choices: [{ message: {} }] })).toThrow('Invalid WebLLM response');
      expect(() => extractReplyContentFromResponse({ choices: [{ message: { content: 123 } }] })).toThrow('Invalid WebLLM response');
    });

    it('throws on empty or whitespace-only content', () => {
      expect(() => extractReplyContentFromResponse({ choices: [{ message: { content: '' } }] })).toThrow('WebLLM returned empty reply');
      expect(() => extractReplyContentFromResponse({ choices: [{ message: { content: '   \n  ' } }] })).toThrow('WebLLM returned empty reply');
    });
  });

  describe('isWebLLMEligible', () => {
    it('returns boolean', () => {
      const result = isWebLLMEligible();
      expect(typeof result).toBe('boolean');
    });
  });
});
