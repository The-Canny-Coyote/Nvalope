import { describe, expect, it } from 'vitest';
import { parseLooseBankTextToRows } from './looseBankTextFromPdf';

describe('parseLooseBankTextToRows', () => {
  it('extracts ISO date, amount, and description from a line', () => {
    const text = '2025-03-15  COFFEE SHOP   -4.75\n';
    const rows = parseLooseBankTextToRows('stmt.pdf', text);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const r = rows[0];
    expect(r.postedDate).toBe('2025-03-15');
    expect(r.amount).toBe(4.75);
    expect(r.direction).toBe('debit');
    expect(r.description).toContain('COFFEE');
  });

  it('parses slash date with debit', () => {
    const text = '03/20/2025 Payment to landlord -1200.00';
    const rows = parseLooseBankTextToRows('x.pdf', text);
    expect(rows.length).toBe(1);
    expect(rows[0].postedDate).toBe('2025-03-20');
    expect(rows[0].amount).toBe(1200);
  });

  it('joins two lines when date and amount are split', () => {
    const text = '01/05/2025\nAMAZON MKTPLACE -23.45\n';
    const rows = parseLooseBankTextToRows('split.pdf', text);
    expect(rows.some((r) => r.description.includes('AMAZON') && r.amount === 23.45)).toBe(true);
  });

  it('parses month name date', () => {
    const text = 'Mar 12, 2025  GROCERY STORE  -15.00';
    const rows = parseLooseBankTextToRows('m.pdf', text);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].postedDate).toBe('2025-03-12');
  });
});
