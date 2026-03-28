import { describe, expect, it } from 'vitest';
import { classifyImportedTransactions, parseStatementFile } from './index';
import { debitAmountToSignedExpense } from './dedup';
import { DEFAULT_IMPORT_ACCOUNT_ID } from './canonical';
import { computeImportHash } from './dedup';

describe('statement import parsers', () => {
  it('parses CSV with signed amount column', () => {
    const parsed = parseStatementFile(
      'transactions.csv',
      'Date,Description,Amount\n2025-01-01,Coffee,-4.75\n2025-01-02,Paycheck,1500.00'
    );
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].direction).toBe('debit');
    expect(parsed.rows[0].amount).toBe(4.75);
    expect(parsed.rows[1].direction).toBe('credit');
  });

  it('parses semicolon-delimited CSV and European decimal amounts', () => {
    const parsed = parseStatementFile(
      'transactions.csv',
      'Date;Description;Amount\n2025-01-01;Coffee;-4,75\n2025-01-02;Paycheck;1500,00'
    );
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].amount).toBe(4.75);
    expect(parsed.rows[0].direction).toBe('debit');
    expect(parsed.rows[1].amount).toBe(1500);
    expect(parsed.rows[1].direction).toBe('credit');
  });

  it('parses European thousands with decimal comma (semicolon CSV so amount is one field)', () => {
    const parsed = parseStatementFile(
      'transactions.csv',
      'Date;Description;Amount\n2025-01-01;Rent;-1.234,56'
    );
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].amount).toBe(1234.56);
    expect(parsed.rows[0].direction).toBe('debit');
  });

  it('parses comma CSV with quoted amount containing decimal comma', () => {
    const parsed = parseStatementFile(
      'transactions.csv',
      'Date,Description,Amount\n2025-01-01,Rent,"-1.234,56"'
    );
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].amount).toBe(1234.56);
    expect(parsed.rows[0].direction).toBe('debit');
  });

  it('parses OFX rows', () => {
    const parsed = parseStatementFile(
      'bank.ofx',
      '<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20250201120000<TRNAMT>-12.34<NAME>Lunch<FITID>abc</STMTTRN></BANKTRANLIST></OFX>'
    );
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].postedDate).toBe('2025-02-01');
    expect(parsed.rows[0].description).toBe('Lunch');
    expect(parsed.rows[0].direction).toBe('debit');
  });

  it('parses QIF rows', () => {
    const parsed = parseStatementFile(
      'bank.qif',
      '!Type:Bank\nD01/31/2025\nT-56.20\nPGroceries\n^\nD02/01/2025\nT1200.00\nPPayroll\n^'
    );
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].direction).toBe('debit');
    expect(parsed.rows[1].direction).toBe('credit');
  });
});

describe('import hash and OFX → canonical fields', () => {
  it('computes stable SHA-256 for import hash payload', async () => {
    const signed = debitAmountToSignedExpense(12.34);
    const h1 = await computeImportHash(DEFAULT_IMPORT_ACCOUNT_ID, '2025-02-01', signed, 'Lunch');
    const h2 = await computeImportHash(DEFAULT_IMPORT_ACCOUNT_ID, '2025-02-01', signed, 'Lunch');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('statement import dedupe classification', () => {
  it('classifies rows into import queue, duplicate, possible duplicate, and invalid', async () => {
    const parsed = parseStatementFile(
      'transactions.csv',
      'Date,Description,Amount\n2025-01-10,Coffee,-4.75\n2025-01-10,COFFEE,-4.75\n2025-01-12,Gas,-45.00\n2025-01-11,LooseDupHint,-45.00\n2025-01-13,Refund,20.00\nbad-date,Nope,-10.00'
    );
    const result = await classifyImportedTransactions(parsed.rows, [
      { id: 'x0', date: '2025-01-10', amount: 4.75, description: 'Coffee' },
      { id: 'x1', date: '2025-01-11', amount: 45, description: 'Different description' },
    ]);
    const ready = result.importQueue.filter((q) => q.duplicateResolution === 'import');
    expect(ready).toHaveLength(1);
    expect(ready[0].description).toBe('Gas');
    expect(result.skippedAsDuplicates.length).toBeGreaterThanOrEqual(1);
    expect(result.possibleDuplicates.length).toBeGreaterThanOrEqual(1);
    expect(result.invalidRows).toHaveLength(1);
    expect(result.skippedCreditRows).toHaveLength(1);
    expect(result.incomeToAdd).toHaveLength(0);
  });

  it('imports credit rows as income when enabled', async () => {
    const parsed = parseStatementFile(
      'transactions.csv',
      'Date,Description,Amount\n2025-01-11,Payroll,1500.00\n2025-01-12,Gas,-45.00'
    );
    const result = await classifyImportedTransactions(parsed.rows, [], { importCreditsAsIncome: true });
    const debits = result.importQueue.filter((q) => q.duplicateResolution === 'import');
    expect(debits).toHaveLength(1);
    expect(result.incomeToAdd).toHaveLength(1);
    expect(result.skippedCreditRows).toHaveLength(0);
    expect(result.incomeToAdd[0]).toEqual({
      amount: 1500,
      source: 'Payroll',
      date: '2025-01-11',
    });
  });
});
