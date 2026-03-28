import { describe, expect, it } from 'vitest';
import { normalizePayee } from './normalizePayee';

describe('normalizePayee', () => {
  it('strips long digit runs and common bank tokens', () => {
    expect(normalizePayee('AMZN MKTP 1234567890123 POS')).not.toMatch(/\d{7,}/);
    expect(normalizePayee('ACH PAYMENT TO VENDOR')).not.toMatch(/\bACH\b/i);
    expect(normalizePayee('CHECKCARD WALMART')).not.toMatch(/CHECKCARD/i);
    expect(normalizePayee('TFR FROM SAVINGS')).not.toMatch(/\bTFR\b/i);
  });

  it('removes date-like fragments and collapses whitespace', () => {
    expect(normalizePayee('COFFEE  01/15/2025  PURCHASE')).not.toMatch(/01\/15\/2025/);
    expect(normalizePayee('a   b    c')).toBe('A B C');
  });

  it('title-cases remaining words', () => {
    expect(normalizePayee('whole foods market')).toBe('Whole Foods Market');
  });

  it('handles ten real-world noisy strings without empty output', () => {
    const dirty = [
      'UBER   *TRIP 4155552677 CA',
      'TST*SQ COFFEE - 12345678901234',
      'POS PURCHASE TARGET T-1842 00000987654321',
      'ACH WEB PAYMENT ELECTRIC CO 20250201',
      'CHECKCARD 0315 MCDONLDS #4521',
      'VENMO PAYMENT 0987654321 FOR DINNER',
      'APPLE.COM/BILL 866-712-7753 CA',
      'PAYPAL *MERCHANT 12/31/2025 USD',
      'RECURRING PMT NETFLIX.COM 4029357733',
      'DEBIT CARD PURCHASE SHELL 5555555555555555',
    ];
    for (const s of dirty) {
      const o = normalizePayee(s);
      expect(o.length).toBeGreaterThan(2);
      expect(o).not.toMatch(/\d{7,}/);
    }
  });
});
