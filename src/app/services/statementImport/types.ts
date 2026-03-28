import type { Transaction } from '@/app/store/budgetTypes';
import type { AssignmentRule } from './ruleEngine';

export type StatementFormat = 'csv' | 'ofx' | 'qfx' | 'qif' | 'pdf';

/** User choice for rows that match an existing transaction. */
export type DuplicateResolution = 'import' | 'skip' | 'keep_both' | 'replace';

export type ImportSeverity = 'info' | 'warning' | 'error';

export interface StatementImportDiagnostic {
  severity: ImportSeverity;
  message: string;
  rowNumber?: number;
}

export interface ImportedStatementRow {
  sourceFile: string;
  sourceFormat: StatementFormat;
  rowNumber: number;
  externalTransactionId?: string;
  postedDate?: string;
  description?: string;
  memo?: string;
  amount?: number;
  direction?: 'debit' | 'credit';
  accountId?: string;
  accountName?: string;
  warnings: string[];
}

export interface ParsedStatementFile {
  format: StatementFormat;
  rows: ImportedStatementRow[];
  diagnostics: StatementImportDiagnostic[];
  csvColumns?: string[];
  csvMapping?: CsvColumnMapping;
}

export interface CsvColumnMapping {
  dateColumn?: string;
  descriptionColumn?: string;
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
}

/** One debit line in the import preview (may be a duplicate candidate). */
export interface StatementImportQueueItem {
  amount: number;
  description: string;
  date: string;
  importHash: string;
  payeeNormalized: string;
  confidenceScore: number;
  sourceFile: string;
  ruleEnvelopeId?: string;
  duplicateMatch?: { transactionId: string; kind: 'exact' | 'loose' };
  isHashCollision?: boolean;
  duplicateResolution: DuplicateResolution;
  row?: ImportedStatementRow;
}

export interface NormalizeImportedTransactionResult {
  importQueue: StatementImportQueueItem[];
  incomeToAdd: Array<{
    amount: number;
    source: string;
    date: string;
  }>;
  skippedAsDuplicates: ImportedStatementRow[];
  possibleDuplicates: ImportedStatementRow[];
  invalidRows: ImportedStatementRow[];
  skippedCreditRows: ImportedStatementRow[];
  diagnostics: StatementImportDiagnostic[];
  /** Bank format template label when matched from registry. */
  matchedTemplateName?: string | null;
}

export interface StatementImportClassificationOptions {
  importCreditsAsIncome?: boolean;
  assignmentRules?: readonly AssignmentRule[];
  matchedTemplateName?: string | null;
}

export type ExistingTransactionForDedupe = Pick<Transaction, 'id' | 'date' | 'amount' | 'description' | 'importHash'>;
