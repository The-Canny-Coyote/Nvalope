export type CanonicalTransactionType = 'debit' | 'credit' | 'fee' | 'transfer';

export interface CanonicalTransaction {
  id: string;
  accountId: string;
  postedDate: string;
  valueDate?: string;
  amount: number;
  currency: string;
  runningBalance?: number;
  payeeRaw: string;
  payeeNormalized: string;
  envelopeId?: string;
  transactionType: CanonicalTransactionType;
  sourceFile: string;
  confidenceScore: number;
  matchedReceiptId?: string;
  isDuplicate?: boolean;
}

export const DEFAULT_IMPORT_ACCOUNT_ID = 'default';
export const DEFAULT_IMPORT_CURRENCY = 'USD';
