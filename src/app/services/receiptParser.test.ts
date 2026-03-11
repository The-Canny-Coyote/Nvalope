import { describe, it, expect } from 'vitest';
import { parseReceiptText, validateReceiptTransaction } from './receiptParser';

describe('parseReceiptText', () => {
  it('extracts total from last TOTAL line', () => {
    const text = `
      SUBTOTAL  44.00
      TAX        2.30
      TOTAL     46.30
    `;
    const r = parseReceiptText(text);
    expect(r.amount).toBe(46.3);
  });

  it('extracts total from TOTAL PURCHASE style', () => {
    const text = `WALMART\nTOTAL PURCHASE  $46.30`;
    const r = parseReceiptText(text);
    expect(r.amount).toBe(46.3);
  });

  it('falls back to last dollar amount when no TOTAL label', () => {
    const text = `Milk 3.99\nBread 2.50\n6.49`;
    const r = parseReceiptText(text);
    expect(r.amount).toBe(6.49);
  });

  it('extracts merchant from first non-header line', () => {
    const text = `RECEIPT\nWALMART #1234\n123 MAIN ST`;
    const r = parseReceiptText(text);
    expect(r.merchant).toBe('WALMART #1234');
  });

  it('defaults merchant to Receipt when no plausible name', () => {
    const text = `12/25/24\n10:30 AM\nTOTAL 5.00`;
    const r = parseReceiptText(text);
    expect(r.merchant).toBe('Receipt');
  });

  it('extracts line items with price at end', () => {
    const text = `
      GV MILK 2%    3.99
      BREAD WHITE   2.50
      TOTAL        6.49
    `;
    const r = parseReceiptText(text);
    expect(r.lineItems).toHaveLength(2);
    expect(r.lineItems[0]).toEqual({ description: 'GV MILK 2%', amount: 3.99 });
    expect(r.lineItems[1]).toEqual({ description: 'BREAD WHITE', amount: 2.5 });
  });

  it('skips header lines and dedupes items', () => {
    const text = `
      ITEM          PRICE
      COFFEE        2.99
      COFFEE        2.99
      TOTAL         2.99
    `;
    const r = parseReceiptText(text);
    expect(r.lineItems).toHaveLength(1);
    expect(r.lineItems[0].description).toBe('COFFEE');
    expect(r.lineItems[0].amount).toBe(2.99);
  });

  it('returns empty lineItems for receipt with only total', () => {
    const text = `STORE\nTOTAL $25.00`;
    const r = parseReceiptText(text);
    expect(r.amount).toBe(25);
    expect(r.lineItems).toHaveLength(0);
  });

  it('extracts total with flexible decimals (46.3 or 46)', () => {
    expect(parseReceiptText('TOTAL 46.3').amount).toBe(46.3);
    expect(parseReceiptText('TOTAL 46').amount).toBe(46);
    expect(parseReceiptText('Items...\nTotal: $123.4').amount).toBe(123.4);
  });

  it('extracts line items with price at start of line', () => {
    const text = `
      3.99  GV MILK 2%
      2.50  BREAD WHITE
      TOTAL  6.49
    `;
    const r = parseReceiptText(text);
    expect(r.lineItems).toHaveLength(2);
    expect(r.lineItems[0]).toEqual({ description: 'GV MILK 2%', amount: 3.99 });
    expect(r.lineItems[1]).toEqual({ description: 'BREAD WHITE', amount: 2.5 });
  });

  it('normalizes messy OCR whitespace', () => {
    const text = '  WALMART   \n\n   TOTAL   46.30  ';
    const r = parseReceiptText(text);
    expect(r.merchant).toBe('WALMART');
    expect(r.amount).toBe(46.3);
  });

  it('extracts total from AMOUNT PAID and TOTAL SALE style labels', () => {
    expect(parseReceiptText('AMOUNT PAID $52.00').amount).toBe(52);
    expect(parseReceiptText('TOTAL SALE  12.99').amount).toBe(12.99);
  });

  it('extracts line item when price is last token without $', () => {
    const text = 'MILK 2%  1  3.99\nBREAD  2.50\nTOTAL  6.49';
    const r = parseReceiptText(text);
    expect(r.lineItems.length).toBeGreaterThanOrEqual(2);
    expect(r.lineItems.some((i) => i.description.includes('MILK') && i.amount === 3.99)).toBe(true);
    expect(r.lineItems.some((i) => i.description.includes('BREAD') && i.amount === 2.5)).toBe(true);
  });

  it('parses European decimal format (12,99 and 1.234,56)', () => {
    const r1 = parseReceiptText('TOTAL 12,99');
    expect(r1.amount).toBe(12.99);
    const r2 = parseReceiptText('STORE\nTOTAL 1.234,56');
    expect(r2.amount).toBe(1234.56);
  });

  it('accepts line item prices with one decimal place (3.9)', () => {
    const text = 'PRODUCT X  3.9\nPRODUCT Y  2.50\nTOTAL  6.40';
    const r = parseReceiptText(text);
    expect(r.lineItems.length).toBeGreaterThanOrEqual(2);
    const amt3_9 = r.lineItems.find((i) => Math.abs(i.amount - 3.9) < 0.01);
    expect(amt3_9).toBeDefined();
    expect(amt3_9!.amount).toBeCloseTo(3.9, 2);
  });

  it('extracts total from last line when it is only a price', () => {
    const text = 'STORE NAME\nItem 1  2.00\nItem 2  3.50\n5.50';
    const r = parseReceiptText(text);
    expect(r.amount).toBe(5.5);
  });

  it('detects refund and sets negative total and change', () => {
    const text = 'STORE\nREFUND\nTOTAL $25.00';
    const r = parseReceiptText(text);
    expect(r.amount).toBe(-25);
    expect(r.isRefund).toBe(true);
    expect(r.change).toBe(25);
    expect(r.total).toBe(-25);
  });

  it('detects refund from CHANGE DUE keyword', () => {
    const text = 'RETURN\nItem  -10.00\nCHANGE DUE  10.00';
    const r = parseReceiptText(text);
    expect(r.isRefund).toBe(true);
    expect(r.amount).toBeLessThanOrEqual(0);
  });

  it('extracts quantity from "2 x" and "3×" prefix on line items', () => {
    const text = '2 x Milk 2%    3.99\n3× BREAD WHITE   2.50\nTOTAL  12.47';
    const r = parseReceiptText(text);
    expect(r.lineItems.length).toBeGreaterThanOrEqual(2);
    const milk = r.lineItems.find((i) => i.description.includes('Milk') && i.amount === 3.99);
    expect(milk?.quantity).toBe(2);
    const bread = r.lineItems.find((i) => i.description.includes('BREAD') && i.amount === 2.5);
    expect(bread?.quantity).toBe(3);
  });

  it('extracts date and time from receipt text', () => {
    const text = '12/25/24\n10:30 AM\nWALMART\nTOTAL 5.00';
    const r = parseReceiptText(text);
    expect(r.date).toBe('2024-12-25');
    expect(r.time).toBeDefined();
    expect(r.time).toMatch(/\d{1,2}:\d{2}/);
  });

  it('extracts subtotal and tax from labeled lines', () => {
    const text = `
      SUBTOTAL  44.00
      TAX        2.30
      TOTAL     46.30
    `;
    const r = parseReceiptText(text);
    expect(r.subtotal).toBe(44);
    expect(r.tax).toBe(2.3);
    expect(r.amount).toBe(46.3);
  });

  it('applies glossary to line item descriptions when provided', () => {
    const text = `
      GV MILK 2%    3.99
      BREAD WHITE   2.50
      TOTAL        6.49
    `;
    const r = parseReceiptText(text, {
      glossary: { 'GV MILK 2%': 'Great Value Milk 2%', 'BREAD WHITE': 'Bread White' },
    });
    expect(r.lineItems).toHaveLength(2);
    expect(r.lineItems[0].description).toBe('Great Value Milk 2%');
    expect(r.lineItems[1].description).toBe('Bread White');
  });

  it('leaves description unchanged when glossary has no match', () => {
    const text = 'UNKNOWN ITEM  1.00\nTOTAL 1.00';
    const r = parseReceiptText(text, { glossary: { 'OTHER': 'Other' } });
    expect(r.lineItems.some((i) => i.description.includes('UNKNOWN'))).toBe(true);
  });

  it('defaults currency to USD when no symbol found', () => {
    const r = parseReceiptText('STORE\nTOTAL 10.00');
    expect(r.currency).toBe('USD');
  });

  it('detects currency from symbol and code', () => {
    expect(parseReceiptText('€ 12.99\nTOTAL 12.99').currency).toBe('EUR');
    expect(parseReceiptText('STORE USD TOTAL 10.00').currency).toBe('USD');
  });

  it('parses subtotal with space instead of decimal (OCR 46 04 as 46.04)', () => {
    const r = parseReceiptText('Walmart\nSUBTOTAL 46 04\nTAX 0.26\nTOTAL 46.30');
    expect(r.subtotal).toBe(46.04);
    expect(r.amount).toBe(46.3);
  });

  it('does not treat CHANGE DUE 0.00 as refund', () => {
    const r = parseReceiptText('SUBTOTAL 46.04\nTOTAL 46.30\nCHANGE DUE: 0.00');
    expect(r.amount).toBe(46.3);
    expect(r.isRefund).toBeFalsy();
  });

  it('excludes TOTAL PURCHASE payment line from line items', () => {
    const text = `
      BREAD    2.88
      46.30 TOTAL PURCHASE
    `;
    const r = parseReceiptText(text);
    expect(r.lineItems).toHaveLength(1);
    expect(r.lineItems[0].description).toBe('BREAD');
    expect(r.lineItems[0].amount).toBe(2.88);
  });

  it('excludes OCR-mangled 107AL PURCHASE from line items', () => {
    const text = `
      BREAD    2.88
      107AL PURCHASE  46.5
    `;
    const r = parseReceiptText(text);
    expect(r.lineItems).toHaveLength(1);
    expect(r.lineItems[0].description).toBe('BREAD');
  });

  it('rescales subtotal when OCR drops decimal (4604 vs total 46.30)', () => {
    const r = parseReceiptText('SUBTOTAL 4604\nTAX 0.26\nTOTAL 46.30');
    expect(r.subtotal).toBe(46.04);
    expect(r.amount).toBe(46.3);
  });
});

describe('validateReceiptTransaction', () => {
  const validDate = () => new Date().toISOString().slice(0, 10);

  it('accepts valid params', () => {
    const r = validateReceiptTransaction({
      amount: 25.99,
      description: 'Groceries',
      date: validDate(),
    });
    expect(r.valid).toBe(true);
    expect(r.error).toBeUndefined();
  });

  it('accepts negative amount (refund)', () => {
    const r = validateReceiptTransaction({
      amount: -10,
      description: 'Refund',
      date: validDate(),
    });
    expect(r.valid).toBe(true);
  });

  it('rejects description longer than 500 chars', () => {
    const r = validateReceiptTransaction({
      amount: 10,
      description: 'a'.repeat(501),
      date: validDate(),
    });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/too long/i);
  });

  it('rejects amount exceeding max', () => {
    const r = validateReceiptTransaction({
      amount: 1_000_001,
      description: 'Big',
      date: validDate(),
    });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/range|large|smaller/i);
  });

  it('rejects amount below -max', () => {
    const r = validateReceiptTransaction({
      amount: -1_000_001,
      description: 'Refund',
      date: validDate(),
    });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/range|large|smaller/i);
  });

  it('rejects invalid date format', () => {
    const r = validateReceiptTransaction({
      amount: 10,
      description: 'Test',
      date: '12/25/2024',
    });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/date|invalid|range/i);
  });

  it('rejects date before 2000', () => {
    const r = validateReceiptTransaction({
      amount: 10,
      description: 'Test',
      date: '1999-12-31',
    });
    expect(r.valid).toBe(false);
  });

  it('rejects date too far in future', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 11);
    const r = validateReceiptTransaction({
      amount: 10,
      description: 'Test',
      date: future.toISOString().slice(0, 10),
    });
    expect(r.valid).toBe(false);
  });

  it('rejects NaN amount', () => {
    const validDate = new Date().toISOString().slice(0, 10);
    const r = validateReceiptTransaction({ amount: Number.NaN, description: 'Test', date: validDate });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/valid amount|invalid/i);
  });

  it('rejects Infinity amount', () => {
    const validDate = new Date().toISOString().slice(0, 10);
    expect(validateReceiptTransaction({ amount: Infinity, description: 'Test', date: validDate }).valid).toBe(false);
    expect(validateReceiptTransaction({ amount: -Infinity, description: 'Test', date: validDate }).valid).toBe(false);
  });

  it('rejects invalid date format', () => {
    const r = validateReceiptTransaction({ amount: 10, description: 'Test', date: 'not-a-date' });
    expect(r.valid).toBe(false);
  });
});
