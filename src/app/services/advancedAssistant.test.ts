import { describe, it, expect } from 'vitest';
import { getAdvancedAssistantReply } from './advancedAssistant';
import type { BudgetSummary, ChatMessage } from './advancedAssistant';

function mockSummary(overrides: Partial<BudgetSummary> = {}): BudgetSummary {
  return {
    totalIncome: 3000,
    totalBudgeted: 750,
    totalSpent: 200,
    remaining: 550,
    envelopes: [
      { id: 'e1', name: 'Groceries', limit: 400, spent: 100, remaining: 300 },
      { id: 'e2', name: 'Transportation', limit: 150, spent: 50, remaining: 100 },
      { id: 'e3', name: 'Entertainment', limit: 200, spent: 50, remaining: 150 },
    ],
    recentTransactions: [],
    ...overrides,
  };
}

describe('getAdvancedAssistantReply', () => {
  it('answers total spent', () => {
    const getSummary = () => mockSummary();
    const reply = getAdvancedAssistantReply([], 'How much have I spent?', getSummary);
    expect(reply).toContain('$200');
    expect(reply).toContain('spent');
  });

  it('answers remaining', () => {
    const getSummary = () => mockSummary();
    const reply = getAdvancedAssistantReply([], "What's left?", getSummary);
    expect(reply).toContain('$550');
    expect(reply).toContain('remaining');
  });

  it('lists envelopes when asked', () => {
    const getSummary = () => mockSummary();
    const reply = getAdvancedAssistantReply([], 'What envelopes do I have?', getSummary);
    expect(reply).toContain('Groceries');
    expect(reply).toContain('Transportation');
    expect(reply).toContain('Entertainment');
  });

  it('answers about a specific envelope by name', () => {
    const getSummary = () => mockSummary();
    const reply = getAdvancedAssistantReply([], 'How much is left in Groceries?', getSummary);
    expect(reply).toContain('Groceries');
    expect(reply).toContain('$300');
  });

  it('uses context for follow-up "first one"', () => {
    const getSummary = () => mockSummary();
    const messages: ChatMessage[] = [
      { role: 'assistant', content: 'Your envelopes:\n• **Groceries**: $100 / $400 ($300 left)\n• **Transportation**: ...' },
    ];
    const reply = getAdvancedAssistantReply(messages, 'What about the first one?', getSummary);
    expect(reply).toContain('Groceries');
  });

  it('suggests help when unclear', () => {
    const getSummary = () => mockSummary();
    const reply = getAdvancedAssistantReply([], 'xyz random', getSummary);
    expect(reply).toMatch(/not sure|Try asking|budget/i);
  });

  it('resolves "there" to last-mentioned envelope (Groceries)', () => {
    const getSummary = () => mockSummary();
    const messages: ChatMessage[] = [
      { role: 'user', content: 'How much is in Groceries?' },
      { role: 'assistant', content: '**Groceries**: $100 spent of $400 ($300 left).' },
    ];
    const reply = getAdvancedAssistantReply(messages, 'How much did I spend there?', getSummary);
    expect(reply).toContain('Groceries');
    expect(reply).toContain('$100');
  });

  it('resolves "How much?" with context to last envelope', () => {
    const getSummary = () => mockSummary();
    const messages: ChatMessage[] = [
      { role: 'assistant', content: '**Groceries**: $100 spent of $400 ($300 left).' },
    ];
    const reply = getAdvancedAssistantReply(messages, 'How much?', getSummary);
    expect(reply).toContain('Groceries');
    expect(reply).toContain('$300');
  });

  it('returns next step after add-expense how-to when user says what next', () => {
    const getSummary = () => mockSummary();
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: 'Go to **Envelopes & Expenses**, pick an envelope in the dropdown, enter the amount and description, then click **Add Expense**.',
      },
    ];
    const reply = getAdvancedAssistantReply(messages, 'What next?', getSummary);
    expect(reply).toMatch(/Add Expense|amount|description/i);
  });
});
