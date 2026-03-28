import { describe, it, expect } from 'vitest';
import { getAssistantReply } from './basicAssistant';
import type { BudgetSummary } from './basicAssistant';

function mockSummary(overrides: Partial<BudgetSummary> = {}): BudgetSummary {
  return {
    totalIncome: 3000,
    totalBudgeted: 750,
    totalSpent: 200,
    remaining: 550,
    envelopes: [
      { id: 'e1', name: 'Groceries', limit: 400, spent: 100, remaining: 300 },
      { id: 'e2', name: 'Transportation', limit: 150, spent: 50, remaining: 100 },
    ],
    ...overrides,
  };
}

describe('getAssistantReply (basic)', () => {
  it('replies to spent question', () => {
    const getSummary = () => mockSummary();
    const reply = getAssistantReply('How much have I spent?', getSummary);
    expect(reply).toContain('$200');
    expect(reply).toContain('spent');
  });

  it('replies to remaining/left', () => {
    const getSummary = () => mockSummary();
    const reply = getAssistantReply("What's left?", getSummary);
    expect(reply).toContain('$550');
    expect(reply).toContain('remaining');
  });

  it('replies to income question', () => {
    const getSummary = () => mockSummary();
    const reply = getAssistantReply('How much income do I have?', getSummary);
    expect(reply).toContain('$3,000');
  });

  it('lists envelopes when asked', () => {
    const getSummary = () => mockSummary();
    const reply = getAssistantReply('What envelopes do I have?', getSummary);
    expect(reply).toContain('Groceries');
    expect(reply).toContain('Transportation');
  });

  it('tells user to create envelope when none exist', () => {
    const getSummary = () => mockSummary({ envelopes: [] });
    const reply = getAssistantReply('Envelopes?', getSummary);
    expect(reply).toContain("don't have any envelopes");
    expect(reply).toContain('Envelopes & Expenses');
  });

  it('replies how to add expense', () => {
    const getSummary = () => mockSummary();
    const reply = getAssistantReply('How do I add an expense?', getSummary);
    expect(reply).toContain('Envelopes & Expenses');
    expect(reply).toContain('Add Expense');
  });

  it('replies with total income when question contains income', () => {
    const getSummary = () => mockSummary();
    const reply = getAssistantReply('How much income?', getSummary);
    expect(reply).toContain('income');
    expect(reply).toContain('3,000');
  });

  it('replies to help with suggestions', () => {
    const getSummary = () => mockSummary();
    const reply = getAssistantReply('help', getSummary);
    expect(reply).toMatch(/budget|spent|left|envelope/i);
  });

  it('prompts for more input when message too short', () => {
    const getSummary = () => mockSummary();
    const reply = getAssistantReply('x', getSummary);
    expect(reply).toContain('Ask me about your budget');
  });

  it('fallback for unrecognized input', () => {
    const getSummary = () => mockSummary();
    const reply = getAssistantReply('random gibberish question', getSummary);
    expect(reply).toMatch(/Try asking|Did you mean|budget/i);
    expect(reply).toMatch(/spending|left|income|envelope/i);
  });

  it('replies with burn rate when high tier and user asks how am I doing', () => {
    const getSummary = () => mockSummary();
    const reply = getAssistantReply('how am I doing?', getSummary, 'high');
    expect(reply).toContain('$200');
    expect(reply).toMatch(/left|remaining/);
    expect(reply).toMatch(/pace|this month/i);
  });

  it('replies with combined summary when low tier and user asks how am I doing', () => {
    const getSummary = () => mockSummary();
    const reply = getAssistantReply('how am I doing?', getSummary, 'low');
    expect(reply).toContain('$200');
    expect(reply).toContain('$550');
    expect(reply).toContain('remaining');
  });

  it('replies to greeting with Cache intro', () => {
    const getSummary = () => mockSummary();
    const reply = getAssistantReply('hello', getSummary);
    expect(reply).toContain('Cache');
    expect(reply).toMatch(/budget|spending|left/i);
  });

  it('replies to balance synonym for remaining', () => {
    const getSummary = () => mockSummary();
    const reply = getAssistantReply("What's my balance?", getSummary);
    expect(reply).toContain('$550');
    expect(reply).toContain('remaining');
  });
});
