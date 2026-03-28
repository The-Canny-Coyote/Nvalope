import { describe, it, expect } from 'vitest';
import { suggestCategoryFromRegex, RECEIPT_CATEGORY_LABELS } from './receiptCategoryPatterns';

describe('receiptCategoryPatterns', () => {
  describe('RECEIPT_CATEGORY_LABELS', () => {
    it('includes expected categories', () => {
      expect(RECEIPT_CATEGORY_LABELS).toContain('groceries');
      expect(RECEIPT_CATEGORY_LABELS).toContain('gas');
      expect(RECEIPT_CATEGORY_LABELS).toContain('dining');
      expect(RECEIPT_CATEGORY_LABELS).toContain('shopping');
      expect(RECEIPT_CATEGORY_LABELS).toContain('other');
      expect(RECEIPT_CATEGORY_LABELS).toHaveLength(5);
    });
  });

  describe('suggestCategoryFromRegex', () => {
    it('returns groceries for Walmart receipt text', () => {
      const r = suggestCategoryFromRegex('WALMART\nTOTAL PURCHASE $46.30');
      expect(r.category).toBe('groceries');
      expect(r.confidence).toBe(0.7);
    });

    it('returns groceries for Target and Kroger', () => {
      expect(suggestCategoryFromRegex('TARGET STORE #123\nTotal 25.00').category).toBe('groceries');
      expect(suggestCategoryFromRegex('KROGER\nItems...').category).toBe('groceries');
    });

    it('returns gas for Shell and Exxon', () => {
      expect(suggestCategoryFromRegex('SHELL GAS STATION\nTotal 55.00').category).toBe('gas');
      expect(suggestCategoryFromRegex('EXXON MOBIL\nFuel').category).toBe('gas');
    });

    it('returns dining for Starbucks and McDonald\'s', () => {
      expect(suggestCategoryFromRegex('STARBUCKS COFFEE\nTotal 5.99').category).toBe('dining');
      expect(suggestCategoryFromRegex('MCDONALDS\nBurger meal').category).toBe('dining');
    });

    it('returns shopping for Amazon and Best Buy', () => {
      expect(suggestCategoryFromRegex('AMAZON ORDER\nTotal 29.99').category).toBe('shopping');
      expect(suggestCategoryFromRegex('BEST BUY\nElectronics').category).toBe('shopping');
    });

    it('returns other when no pattern matches', () => {
      const r = suggestCategoryFromRegex('RANDOM VENDOR XYZ\nTotal 10.00');
      expect(r.category).toBe('other');
      expect(r.confidence).toBe(0.7);
    });

    it('matches case-insensitively', () => {
      expect(suggestCategoryFromRegex('walmart').category).toBe('groceries');
      expect(suggestCategoryFromRegex('WALMART').category).toBe('groceries');
      expect(suggestCategoryFromRegex('StArBuCkS').category).toBe('dining');
    });

    it('uses first matching category in order (groceries before gas before dining before shopping)', () => {
      const text = 'Walmart gas station dining'; // has groceries (walmart), gas, dining
      const r = suggestCategoryFromRegex(text);
      expect(r.category).toBe('groceries');
    });

    it('normalizes whitespace (only first 2000 chars)', () => {
      const r = suggestCategoryFromRegex('  \n   WALMART   \n  TOTAL 10  ');
      expect(r.category).toBe('groceries');
    });
  });
});
