import { describe, expect, it } from 'vitest';
import { computeImportHash, debitAmountToSignedExpense, importHashPayload, sha256HexFromString } from './dedup';
import { DEFAULT_IMPORT_ACCOUNT_ID } from './canonical';

describe('dedup hash', () => {
  it('same inputs produce same hash', async () => {
    const signed = debitAmountToSignedExpense(10);
    const a = await computeImportHash(DEFAULT_IMPORT_ACCOUNT_ID, '2025-01-01', signed, 'Coffee');
    const b = await computeImportHash(DEFAULT_IMPORT_ACCOUNT_ID, '2025-01-01', signed, 'Coffee');
    expect(a).toBe(b);
  });

  it('different payee changes hash', async () => {
    const signed = debitAmountToSignedExpense(10);
    const a = await computeImportHash(DEFAULT_IMPORT_ACCOUNT_ID, '2025-01-01', signed, 'Coffee');
    const b = await computeImportHash(DEFAULT_IMPORT_ACCOUNT_ID, '2025-01-01', signed, 'Tea');
    expect(a).not.toBe(b);
  });

  it('importHashPayload delimiter is stable', () => {
    expect(importHashPayload('a', 'b', -1, 'c')).toBe('a\u001fb\u001f-1\u001fc');
  });

  it('sha256HexFromString is deterministic', async () => {
    const x = await sha256HexFromString('header');
    const y = await sha256HexFromString('header');
    expect(x).toBe(y);
    expect(x.length).toBe(64);
  });
});
