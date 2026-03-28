import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { createCompletionMock, CreateMLCEngineMock } = vi.hoisted(() => {
  const createCompletionMock = vi.fn();
  const CreateMLCEngineMock = vi.fn(async () => ({
    chat: {
      completions: {
        create: createCompletionMock,
      },
    },
    unload: vi.fn().mockResolvedValue(undefined),
  }));
  return { createCompletionMock, CreateMLCEngineMock };
});

vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: CreateMLCEngineMock,
}));

import {
  buildSystemPrompt,
  getWebLLMBlockReasons,
  getWebLLMEnvironmentSnapshot,
  getWebLLMReply,
  loadWebLLMEngine,
  unloadWebLLMEngine,
} from './webLLMAssistant';

describe('webLLMAssistant', () => {
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

  describe('getWebLLMReply', () => {
    const minimalSummary = {
      totalIncome: 0,
      totalBudgeted: 0,
      totalSpent: 0,
      remaining: 0,
      envelopes: [] as Array<{ name: string; limit: number; spent: number; remaining: number }>,
      periodLabel: undefined,
    };

    let navigatorSnapshot: Navigator | undefined;

    beforeEach(async () => {
      navigatorSnapshot = globalThis.navigator;
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          hardwareConcurrency: 8,
          deviceMemory: 8,
          gpu: {},
        },
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, 'isSecureContext', {
        value: true,
        configurable: true,
        writable: true,
      });
      await unloadWebLLMEngine();
      createCompletionMock.mockReset();
      CreateMLCEngineMock.mockClear();
    });

    afterEach(async () => {
      await unloadWebLLMEngine();
      if (navigatorSnapshot !== undefined) {
        Object.defineProperty(globalThis, 'navigator', {
          value: navigatorSnapshot,
          configurable: true,
          writable: true,
        });
      }
    });

    it('returns trimmed content from OpenAI-like shape', async () => {
      createCompletionMock.mockResolvedValue({
        choices: [{ message: { content: '  You have $100 left.  ' } }],
      });
      await loadWebLLMEngine();
      const reply = await getWebLLMReply(minimalSummary, [], 'Hello', 'basic');
      expect(reply).toBe('You have $100 left.');
    });

    it('returns content from alternate shape (message.content)', async () => {
      createCompletionMock.mockResolvedValue({
        message: { content: 'Your total spent is $500.' },
      });
      await loadWebLLMEngine();
      const reply = await getWebLLMReply(minimalSummary, [], 'Hello', 'basic');
      expect(reply).toBe('Your total spent is $500.');
    });

    it('throws on missing or non-string content', async () => {
      await loadWebLLMEngine();
      const cases: unknown[] = [
        {},
        { choices: [] },
        { choices: [{}] },
        { choices: [{ message: {} }] },
        { choices: [{ message: { content: 123 } }] },
      ];
      for (const payload of cases) {
        createCompletionMock.mockResolvedValueOnce(payload);
        await expect(getWebLLMReply(minimalSummary, [], 'Hello', 'basic')).rejects.toThrow('Invalid WebLLM response');
      }
    });

    it('throws on empty or whitespace-only content', async () => {
      await loadWebLLMEngine();
      createCompletionMock.mockResolvedValueOnce({ choices: [{ message: { content: '' } }] });
      await expect(getWebLLMReply(minimalSummary, [], 'Hello', 'basic')).rejects.toThrow('WebLLM returned empty reply');
      createCompletionMock.mockResolvedValueOnce({ choices: [{ message: { content: '   \n  ' } }] });
      await expect(getWebLLMReply(minimalSummary, [], 'Hello', 'basic')).rejects.toThrow('WebLLM returned empty reply');
    });
  });

  describe('getWebLLMBlockReasons', () => {
    it('returns an array (empty means no blockers)', () => {
      const reasons = getWebLLMBlockReasons();
      expect(Array.isArray(reasons)).toBe(true);
    });

    it('includes HTTPS guidance when globalThis.isSecureContext is false', () => {
      const had = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext');
      try {
        Object.defineProperty(globalThis, 'isSecureContext', {
          value: false,
          configurable: true,
          writable: true,
        });
        const reasons = getWebLLMBlockReasons();
        expect(reasons.some((r) => /HTTPS|localhost/i.test(r))).toBe(true);
      } finally {
        if (had) Object.defineProperty(globalThis, 'isSecureContext', had);
        else Reflect.deleteProperty(globalThis, 'isSecureContext');
      }
    });
  });

  describe('getWebLLMEnvironmentSnapshot', () => {
    it('returns a snapshot object with expected keys', () => {
      const snap = getWebLLMEnvironmentSnapshot();
      expect(snap).toMatchObject({
        secureContext: expect.any(Boolean),
        webGpuPresent: expect.any(Boolean),
        crossOriginIsolated: expect.any(Boolean),
        performanceTier: expect.stringMatching(/^(low|medium|high)$/),
        engineLoaded: expect.any(Boolean),
      });
    });
  });
});
