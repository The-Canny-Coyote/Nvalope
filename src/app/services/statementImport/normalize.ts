import type {
  ExistingTransactionForDedupe,
  ImportedStatementRow,
  NormalizeImportedTransactionResult,
  StatementImportClassificationOptions,
  StatementImportDiagnostic,
  StatementImportQueueItem,
} from './types';
import { DEFAULT_IMPORT_ACCOUNT_ID } from './canonical';
import { computeImportHash, debitAmountToSignedExpense } from './dedup';
import { normalizePayee } from './normalizePayee';
import { applyAssignmentRules, sortRulesByPriority } from './ruleEngine';

function normalizedDescription(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200);
}

function exactFingerprint(tx: { date: string; amount: number; description: string }): string {
  return `${tx.date}|${tx.amount.toFixed(2)}|${normalizedDescription(tx.description)}`;
}

function looseFingerprint(tx: { date: string; amount: number }): string {
  return `${tx.date}|${tx.amount.toFixed(2)}`;
}

function findLooseMatch(
  loose: string,
  existingTransactions: readonly ExistingTransactionForDedupe[]
): ExistingTransactionForDedupe | undefined {
  return existingTransactions.find((tx) => looseFingerprint(tx) === loose);
}

function findExactMatch(
  exact: string,
  existingTransactions: readonly ExistingTransactionForDedupe[]
): ExistingTransactionForDedupe | undefined {
  return existingTransactions.find((tx) => exactFingerprint(tx) === exact);
}

function findHashMatch(
  hash: string,
  existingTransactions: readonly ExistingTransactionForDedupe[]
): ExistingTransactionForDedupe | undefined {
  return existingTransactions.find((tx) => tx.importHash === hash);
}

export async function classifyImportedTransactions(
  importedRows: ImportedStatementRow[],
  existingTransactions: ExistingTransactionForDedupe[],
  options?: StatementImportClassificationOptions
): Promise<NormalizeImportedTransactionResult> {
  const importCreditsAsIncome = options?.importCreditsAsIncome === true;
  const rulesSorted = sortRulesByPriority(options?.assignmentRules ?? []);
  const diagnostics: StatementImportDiagnostic[] = [];
  const invalidRows: ImportedStatementRow[] = [];
  const skippedCreditRows: ImportedStatementRow[] = [];
  const skippedAsDuplicates: ImportedStatementRow[] = [];
  const possibleDuplicatesLegacy: ImportedStatementRow[] = [];
  const importQueue: StatementImportQueueItem[] = [];
  const incomeToAdd: Array<{ amount: number; source: string; date: string }> = [];

  const existingExact = new Set(existingTransactions.map((tx) => exactFingerprint(tx)));
  const importedExactAccepted = new Set<string>();
  /** First exact fingerprint seen per import hash in this batch (detect rare hash collisions). */
  const batchHashToFingerprint = new Map<string, string>();

  for (const row of importedRows) {
    const hasWarnings = row.warnings.length > 0;
    const description = row.description?.trim() ?? '';
    const date = row.postedDate ?? '';
    const amount = row.amount;

    if (hasWarnings || !description || !date || !amount || amount <= 0) {
      invalidRows.push(row);
      continue;
    }

    if (row.direction === 'credit') {
      if (!importCreditsAsIncome) {
        skippedCreditRows.push(row);
      } else {
        incomeToAdd.push({
          amount,
          source: description.slice(0, 500),
          date,
        });
      }
      continue;
    }

    const payeeRaw = description.slice(0, 500);
    const exact = exactFingerprint({ date, amount, description: payeeRaw });

    if (importedExactAccepted.has(exact)) {
      skippedAsDuplicates.push(row);
      continue;
    }

    const payeeNormalized = normalizePayee(payeeRaw);
    const accountId = row.accountId?.trim() || DEFAULT_IMPORT_ACCOUNT_ID;
    const signedAmount = debitAmountToSignedExpense(amount);
    const importHash = await computeImportHash(accountId, date, signedAmount, payeeRaw);

    const ruleHit = applyAssignmentRules(payeeNormalized || payeeRaw, rulesSorted);
    const confidenceScore = ruleHit ? 1 : 0.5;

    const prevFpForHash = batchHashToFingerprint.get(importHash);
    let isHashCollision = false;
    if (prevFpForHash !== undefined && prevFpForHash !== exact) {
      isHashCollision = true;
    }
    batchHashToFingerprint.set(importHash, exact);

    let duplicateMatch: StatementImportQueueItem['duplicateMatch'];
    const hashTx = findHashMatch(importHash, existingTransactions);
    if (hashTx) {
      duplicateMatch = { transactionId: hashTx.id, kind: 'exact' };
    } else if (existingExact.has(exact)) {
      const m = findExactMatch(exact, existingTransactions);
      if (m) duplicateMatch = { transactionId: m.id, kind: 'exact' };
    } else {
      const loose = looseFingerprint({ date, amount });
      const looseHit = findLooseMatch(loose, existingTransactions);
      if (looseHit && exactFingerprint(looseHit) !== exact) {
        duplicateMatch = { transactionId: looseHit.id, kind: 'loose' };
        possibleDuplicatesLegacy.push(row);
      }
    }

    importedExactAccepted.add(exact);

    const duplicateResolution: StatementImportQueueItem['duplicateResolution'] = duplicateMatch ? 'skip' : 'import';

    importQueue.push({
      amount,
      description: payeeRaw,
      date,
      importHash,
      payeeNormalized: payeeNormalized || payeeRaw,
      confidenceScore,
      sourceFile: row.sourceFile,
      ruleEnvelopeId: ruleHit?.envelopeId,
      duplicateMatch,
      isHashCollision,
      duplicateResolution,
      row,
    });
  }

  if (invalidRows.length > 0) {
    diagnostics.push({
      severity: 'warning',
      message: `${invalidRows.length} rows were skipped because they were invalid.`,
    });
  }
  if (skippedCreditRows.length > 0) {
    diagnostics.push({
      severity: 'info',
      message: `${skippedCreditRows.length} credit rows were skipped. Enable "Import credits as income" to include them.`,
    });
  }
  const dupInQueue = importQueue.filter((q) => q.duplicateMatch).length;
  if (dupInQueue > 0) {
    diagnostics.push({
      severity: 'warning',
      message: `${dupInQueue} row(s) match existing transactions. Choose keep, skip, or replace for each before importing.`,
    });
  }
  const collisions = importQueue.filter((q) => q.isHashCollision).length;
  if (collisions > 0) {
    diagnostics.push({
      severity: 'warning',
      message: `${collisions} row(s) share the same import hash as another row—review carefully.`,
    });
  }

  return {
    importQueue,
    incomeToAdd,
    skippedAsDuplicates,
    possibleDuplicates: possibleDuplicatesLegacy,
    invalidRows,
    skippedCreditRows,
    diagnostics,
    matchedTemplateName: options?.matchedTemplateName ?? null,
  };
}
