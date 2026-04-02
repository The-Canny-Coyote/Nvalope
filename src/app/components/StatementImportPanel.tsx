import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Envelope } from '@/app/store/budgetTypes';
import type {
  CsvColumnMapping,
  DuplicateResolution,
  NormalizeImportedTransactionResult,
  ParsedStatementFile,
} from '@/app/services/statementImport';
import {
  buildImportQueueDrafts,
  suggestionGroupKey,
  type StatementImportTransactionDraft,
} from '@/app/services/statementImport/suggestEnvelope';
import { Checkbox } from '@/app/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { Label } from '@/app/components/ui/label';
import { delayedToast } from '@/app/services/delayedToast';
import { toast } from 'sonner';
import { Info } from 'lucide-react';

const SESSION_TX_HINT_KEY = 'nvalope-statement-import-tx-hint-shown';
const MIXED_MERCHANTS = /walmart|target|costco|sam's\s*club|amazon|kmart/i;

const dataMgmtBtn =
  'inline-flex items-center gap-2 py-2 px-4 border border-primary/30 rounded-lg text-sm font-medium text-foreground transition-colors hover:bg-primary/5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-w-0';

export type StatementImportMode = 'quick' | 'review';

function confidenceBadgeClass(score: number): string {
  if (score >= 0.8) return 'bg-emerald-600/20 text-emerald-800 dark:text-emerald-200 border-emerald-600/40';
  if (score >= 0.5) return 'bg-amber-500/20 text-amber-900 dark:text-amber-100 border-amber-500/40';
  return 'bg-red-600/20 text-red-900 dark:text-red-100 border-red-600/40';
}

export interface StatementImportPanelProps {
  fileName: string;
  parsed: ParsedStatementFile;
  classification: NormalizeImportedTransactionResult;
  envelopes: Envelope[];
  statementImportCreditsAsIncome: boolean;
  onCreditsAsIncomeChange: (value: boolean) => void;
  onCsvMappingChange: (mapping: CsvColumnMapping) => void;
  enabledModules: string[];
  onCancel: () => void;
  onImported: (summary: {
    transactionCount: number;
    incomeCount: number;
    skippedDuplicates: number;
    possibleDuplicates: number;
    skippedCreditRows: number;
    invalidRows: number;
  }) => void;
  addTransactions: (
    txs: Array<{
      amount: number;
      description: string;
      date: string;
      envelopeId?: string;
      importHash?: string;
      importSourceFile?: string;
      importConfidence?: number;
      payeeNormalized?: string;
    }>
  ) => void;
  addIncome: (income: { amount: number; source: string; date: string }) => void;
  deleteTransaction: (id: string) => void;
  onSaveCsvTemplate?: (bankName: string, columnMap: CsvColumnMapping) => void | Promise<void>;
}

export function StatementImportPanel({
  fileName,
  parsed,
  classification,
  envelopes,
  statementImportCreditsAsIncome,
  onCreditsAsIncomeChange,
  onCsvMappingChange,
  enabledModules,
  onCancel,
  onImported,
  addTransactions,
  addIncome,
  deleteTransaction,
  onSaveCsvTemplate,
}: StatementImportPanelProps) {
  const [importMode, setImportMode] = useState<StatementImportMode>('review');
  const [reviewLayout, setReviewLayout] = useState<'grouped' | 'perRow'>('grouped');
  const [templateBankName, setTemplateBankName] = useState('My bank');

  const queue = classification.importQueue;
  const queueFingerprint = useMemo(
    () => queue.map((t) => `${t.date}|${t.amount}|${t.description}|${t.duplicateResolution}`).join('\n'),
    [queue]
  );
  const [drafts, setDrafts] = useState<StatementImportTransactionDraft[]>(() => buildImportQueueDrafts(queue, envelopes));

  useEffect(() => {
    setDrafts(buildImportQueueDrafts(queue, envelopes));
    setImportMode('review');
    setReviewLayout('grouped');
  }, [fileName, queueFingerprint, envelopes, queue]);

  useEffect(() => {
    if (!enabledModules.includes('transactions') && typeof sessionStorage !== 'undefined') {
      if (!sessionStorage.getItem(SESSION_TX_HINT_KEY)) {
        sessionStorage.setItem(SESSION_TX_HINT_KEY, '1');
        toast.message('Turn on Transaction history', {
          description:
            'Imported expenses appear in your budget, but the Transactions list is off by default. Enable it under Settings → Optional features → Transactions.',
          duration: 12_000,
        });
      }
    }
  }, [enabledModules]);

  const lowConfidenceCount = useMemo(() => drafts.filter((d) => d.confidenceScore < 0.7).length, [drafts]);

  const groups = useMemo(() => {
    const map = new Map<string, StatementImportTransactionDraft[]>();
    for (const d of drafts) {
      const k = suggestionGroupKey(d);
      const arr = map.get(k) ?? [];
      arr.push(d);
      map.set(k, arr);
    }
    return map;
  }, [drafts]);

  const setGroupEnvelope = useCallback((groupKey: string, envelopeId: string | undefined) => {
    setDrafts((prev) =>
      prev.map((d) => (suggestionGroupKey(d) === groupKey ? { ...d, chosenEnvelopeId: envelopeId } : d))
    );
  }, []);

  const setRowEnvelope = useCallback((index: number, envelopeId: string | undefined) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, chosenEnvelopeId: envelopeId } : d)));
  }, []);

  const setRowDuplicateResolution = useCallback((index: number, resolution: DuplicateResolution) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, duplicateResolution: resolution } : d)));
  }, []);

  const bulkEnvelopeId = useCallback((envelopeId: string | undefined) => {
    setDrafts((prev) => prev.map((d) => (!d.chosenEnvelopeId ? { ...d, chosenEnvelopeId: envelopeId } : d)));
  }, []);

  const envelopeOptions = useMemo(
    () =>
      envelopes.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      )),
    [envelopes]
  );

  const willImportAny = useMemo(
    () =>
      drafts.some(
        (d) => d.duplicateResolution === 'import' || d.duplicateResolution === 'keep_both' || d.duplicateResolution === 'replace'
      ),
    [drafts]
  );

  const handleConfirm = () => {
    const incomeToAdd = classification.incomeToAdd;

    if (!willImportAny && incomeToAdd.length === 0) {
      delayedToast.error('No entries are ready to import. Change duplicate actions, mapping, or pick a different file.');
      return;
    }

    const txs: Array<{
      amount: number;
      description: string;
      date: string;
      envelopeId?: string;
      importHash?: string;
      importSourceFile?: string;
      importConfidence?: number;
      payeeNormalized?: string;
    }> = [];

    for (let i = 0; i < drafts.length; i += 1) {
      const d = drafts[i];
      const q = classification.importQueue[i];
      if (d.duplicateResolution === 'skip') continue;
      if (d.duplicateResolution === 'replace' && d.duplicateMatch) {
        deleteTransaction(d.duplicateMatch.transactionId);
      }
      if (d.duplicateResolution === 'import' || d.duplicateResolution === 'keep_both' || d.duplicateResolution === 'replace') {
        const envelopeId =
          importMode === 'quick' ? d.sourceRuleEnvelopeId ?? undefined : d.chosenEnvelopeId || undefined;
        txs.push({
          amount: d.amount,
          description: d.description,
          date: d.date,
          envelopeId,
          importHash: d.importHash || undefined,
          importSourceFile: fileName,
          importConfidence: d.confidenceScore,
          payeeNormalized: q?.payeeNormalized,
        });
      }
    }

    if (txs.length > 0) {
      addTransactions(txs);
    }

    for (const income of incomeToAdd) {
      addIncome(income);
    }

    const skippedDup = drafts.filter((d) => d.duplicateResolution === 'skip' && d.duplicateMatch).length;

    onImported({
      transactionCount: txs.length,
      incomeCount: incomeToAdd.length,
      skippedDuplicates: skippedDup + classification.skippedAsDuplicates.length,
      possibleDuplicates: classification.possibleDuplicates.length,
      skippedCreditRows: classification.skippedCreditRows.length,
      invalidRows: classification.invalidRows.length,
    });
  };

  const confirmDisabled = !willImportAny && classification.incomeToAdd.length === 0;

  const groupedEntries = [...groups.entries()];

  const envelopeName = (id: string | undefined) => envelopes.find((e) => e.id === id)?.name;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-3" aria-live="polite">
      <div>
        <p className="text-sm font-medium text-foreground">Statement preview</p>
        <p className="text-xs text-muted-foreground">
          File: {fileName} ({parsed.format.toUpperCase()})
        </p>
        {parsed.format === 'csv' && parsed.csvColumns && (
          <div className="mt-2 rounded-md border border-border bg-background/60 p-2 space-y-2 text-xs text-muted-foreground leading-snug">
            <p className="font-medium text-foreground">CSV exports — how column mapping works</p>
            <p>
              A <strong className="text-foreground">CSV</strong> is a common spreadsheet-style download from your bank: each line is usually one
              transaction, and the <strong className="text-foreground">first line</strong> lists column names (such as Date, Description, or
              Amount). You do not need to open the file in Excel or Numbers—Nvalope reads it here.
            </p>
            <p>
              <strong className="text-foreground">By default</strong>, we <strong className="text-foreground">auto-detect</strong> which column is
              the date, description, and amount by matching those header names. The dropdowns below list your file’s column names; when detection
              works, they are filled in for you.
            </p>
            <p>
              <strong className="text-foreground">If those fields look right</strong> and the transactions in the preview match what you see on
              your bank’s website or PDF, you can usually continue—no need to understand CSV. Saving or importing is fine when auto-detection
              looks correct.
            </p>
            <p>
              <strong className="text-foreground">Change the mapping only if something looks wrong</strong>—for example wrong dates, missing
              amounts, or text in the wrong place. Each dropdown is asking: &quot;Which column in <em>my</em> file holds this piece of
              data?&quot; Pick the matching column name from your bank’s header row. Use either one{' '}
              <strong className="text-foreground">Amount</strong> column (positive and negative in a single column) or separate{' '}
              <strong className="text-foreground">Debit</strong> and <strong className="text-foreground">Credit</strong> columns, whichever
              matches your export.
            </p>
            {classification.matchedTemplateName ? (
              <p>
                <strong className="text-foreground">Saved layout applied:</strong> we used your saved template for{' '}
                <strong className="text-foreground">{classification.matchedTemplateName}</strong>. If your bank changed their export format,
                adjust the dropdowns above; otherwise the defaults should be fine.
              </p>
            ) : (
              <p>
                <strong className="text-foreground">No saved layout for this file’s header yet.</strong> After the auto-detected mapping looks
                good, use <strong className="text-foreground">Save column mapping as template</strong> so the next import from this bank can reuse
                it and skip guessing.
              </p>
            )}
          </div>
        )}
      </div>

      {parsed.format === 'csv' && parsed.csvColumns && onSaveCsvTemplate && (
        <div className="flex flex-wrap items-end gap-2 border border-border rounded-lg p-2 bg-background/40">
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Template name
            <input
              type="text"
              value={templateBankName}
              onChange={(e) => setTemplateBankName(e.target.value)}
              className="rounded-md border border-primary/25 bg-background px-2 py-1 text-sm text-foreground min-w-[140px]"
            />
          </label>
          <button
            type="button"
            className={dataMgmtBtn}
            onClick={() => {
              const map = parsed.csvMapping ?? {};
              void Promise.resolve(onSaveCsvTemplate(templateBankName.trim() || 'My bank', map));
              delayedToast.success('Template saved for future imports.');
            }}
          >
            Save column mapping as template
          </button>
        </div>
      )}

      {parsed.format === 'csv' && parsed.csvColumns && (
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { label: 'Date column', key: 'dateColumn' as const },
            { label: 'Description column', key: 'descriptionColumn' as const },
            { label: 'Amount column (signed)', key: 'amountColumn' as const },
            { label: 'Debit column', key: 'debitColumn' as const },
            { label: 'Credit column', key: 'creditColumn' as const },
          ].map((item) => (
            <label key={item.key} className="text-xs text-muted-foreground">
              {item.label}
              <select
                className="mt-1 w-full rounded-md border border-primary/25 bg-background px-2 py-1 text-sm text-foreground"
                value={parsed.csvMapping?.[item.key] ?? ''}
                onChange={(event) => {
                  const nextMapping: CsvColumnMapping = {
                    ...(parsed.csvMapping ?? {}),
                    [item.key]: event.target.value || undefined,
                  };
                  onCsvMappingChange(nextMapping);
                }}
              >
                <option value="">(none)</option>
                {parsed.csvColumns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {importMode === 'review' && drafts.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 border border-border rounded-lg p-2 bg-background/40">
          <label className="text-xs text-muted-foreground">
            Bulk assign envelope (unmatched rows)
            <select
              className="mt-1 block w-full min-w-[160px] rounded-md border border-primary/25 bg-background px-2 py-1 text-sm text-foreground"
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                bulkEnvelopeId(v === '' ? undefined : v);
                e.target.value = '';
              }}
              aria-label="Bulk assign envelope to rows without a category"
            >
              <option value="">Choose envelope…</option>
              {envelopeOptions}
            </select>
          </label>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground" id="stmt-import-mode-label">
          Debit transactions
        </p>
        <RadioGroup
          value={importMode}
          onValueChange={(v) => setImportMode(v as StatementImportMode)}
          className="flex flex-col gap-2"
          aria-labelledby="stmt-import-mode-label"
        >
          <div className="flex items-start gap-2">
            <RadioGroupItem value="review" id="stmt-mode-review" className="mt-0.5" />
            <Label htmlFor="stmt-mode-review" className="text-xs font-normal cursor-pointer leading-snug">
              Review categories — confirm or change envelope (category) for each group or row before importing.
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="quick" id="stmt-mode-quick" className="mt-0.5" />
            <Label htmlFor="stmt-mode-quick" className="text-xs font-normal cursor-pointer leading-snug">
              Quick import — use rule-based categories when set; otherwise uncategorized. You can assign envelopes later.
            </Label>
          </div>
        </RadioGroup>
      </div>

      {lowConfidenceCount > 0 && (
        <p className="text-xs text-amber-800 dark:text-amber-200 border border-amber-500/40 rounded-md p-2 bg-amber-500/10">
          {lowConfidenceCount} row(s) have confidence below 0.7—double-check amounts and descriptions before confirming.
        </p>
      )}

      {importMode === 'review' && drafts.length > 0 && (
        <div className="space-y-2 border border-primary/15 rounded-lg p-2 bg-background/50">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-foreground">Category review</p>
            <button
              type="button"
              className="text-xs underline text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              onClick={() => setReviewLayout('grouped')}
            >
              Grouped view
            </button>
            <span className="text-xs text-muted-foreground" aria-hidden>
              ·
            </span>
            <button
              type="button"
              className="text-xs underline text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              onClick={() => setReviewLayout('perRow')}
            >
              Per-row view
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Suggestions use keywords and your assignment rules. Duplicate rows can be skipped, kept as new, or used to replace the existing transaction.
          </p>

          {reviewLayout === 'grouped' && (
            <ul className="space-y-2 list-none p-0 m-0 max-h-64 overflow-y-auto" aria-label="Grouped by suggestion">
              {groupedEntries.map(([groupKey, items]) => {
                const first = items[0];
                const label =
                  envelopeName(first.chosenEnvelopeId ?? first.suggestedEnvelopeId) ??
                  (first.suggestionLabel === 'other' ? 'Uncategorized' : `Suggested: ${first.suggestionLabel}`);
                const value = first.chosenEnvelopeId ?? '';
                return (
                  <li key={groupKey} className="rounded border border-border p-2 space-y-1">
                    <p className="text-xs text-foreground">
                      {label} — {items.length} transaction{items.length === 1 ? '' : 's'}
                    </p>
                    <label className="text-xs text-muted-foreground block">
                      Envelope for this group
                      <select
                        className="mt-1 w-full rounded-md border border-primary/25 bg-background px-2 py-1 text-sm text-foreground"
                        value={value}
                        onChange={(e) => {
                          const v = e.target.value;
                          setGroupEnvelope(groupKey, v === '' ? undefined : v);
                        }}
                        aria-label={`Envelope for group ${label}, ${items.length} transactions`}
                      >
                        <option value="">Uncategorized</option>
                        {envelopeOptions}
                      </select>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {reviewLayout === 'perRow' && (
            <div className="max-h-96 overflow-y-auto border border-border rounded-md" role="region" aria-label="Per-row import review">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr>
                    <th className="p-2 font-medium text-foreground">Conf.</th>
                    <th className="p-2 font-medium text-foreground">Date</th>
                    <th className="p-2 font-medium text-foreground">Description</th>
                    <th className="p-2 font-medium text-foreground text-right">Amt</th>
                    <th className="p-2 font-medium text-foreground">Dup</th>
                    <th className="p-2 font-medium text-foreground">Envelope</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d, index) => (
                    <tr key={`${d.importHash}-${index}`} className="border-t border-border">
                      <td className="p-1 align-top">
                        <span
                          className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${confidenceBadgeClass(d.confidenceScore)}`}
                          title={`Confidence ${d.confidenceScore.toFixed(2)}`}
                        >
                          {(d.confidenceScore * 100).toFixed(0)}%
                        </span>
                        {d.isHashCollision ? (
                          <span className="block text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">Hash overlap</span>
                        ) : null}
                      </td>
                      <td className="p-2 align-top whitespace-nowrap text-muted-foreground">{d.date}</td>
                      <td className="p-2 align-top text-foreground break-words max-w-[120px] sm:max-w-[200px]">{d.description}</td>
                      <td className="p-2 align-top text-right whitespace-nowrap">{d.amount.toFixed(2)}</td>
                      <td className="p-2 align-top">
                        {d.duplicateMatch ? (
                          <div className="space-y-1">
                            <span className="inline-block rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[10px]">
                              Duplicate ({d.duplicateMatch.kind})
                            </span>
                            <select
                              className="block w-full min-w-[100px] rounded-md border border-primary/25 bg-background px-1 py-0.5 text-[10px] text-foreground"
                              value={d.duplicateResolution}
                              onChange={(e) => setRowDuplicateResolution(index, e.target.value as DuplicateResolution)}
                              aria-label={`Duplicate action for row ${index + 1}`}
                            >
                              <option value="skip">Skip</option>
                              <option value="keep_both">Keep both</option>
                              <option value="replace">Replace existing</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-2 align-top">
                        <label className="sr-only" htmlFor={`stmt-env-${index}`}>
                          Envelope for row {index + 1}
                        </label>
                        <select
                          id={`stmt-env-${index}`}
                          className="w-full min-w-[90px] rounded-md border border-primary/25 bg-background px-1 py-1 text-xs text-foreground"
                          value={d.chosenEnvelopeId ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRowEnvelope(index, v === '' ? undefined : v);
                          }}
                        >
                          <option value="">Uncategorized</option>
                          {envelopeOptions}
                        </select>
                        {importMode !== 'quick' && MIXED_MERCHANTS.test(d.description) && (
                          <div className="mt-1 text-[10px] text-amber-900 dark:text-amber-100 flex items-start gap-1">
                            <a
                              href="#mixed-merchants"
                              className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label="More info about mixed merchants"
                              title="More info"
                            >
                              <Info className="w-3 h-3" aria-hidden />
                            </a>
                            <span>
                              This merchant often has purchases across multiple categories. Consider splitting this transaction after import.
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          Parsed rows: {parsed.rows.length} · In preview queue: {classification.importQueue.length} debit row(s)
        </p>
        <p>
          Income entries: {classification.incomeToAdd.length} · Same-file skipped: {classification.skippedAsDuplicates.length} ·
          Loose matches flagged: {classification.possibleDuplicates.length} · Invalid rows: {classification.invalidRows.length}
        </p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={statementImportCreditsAsIncome}
          onCheckedChange={(checked) => onCreditsAsIncomeChange(checked === true)}
          aria-label="Import credit rows as income entries"
          className="size-5 shrink-0 rounded"
        />
        <span className="text-xs text-foreground">Import credits as income entries</span>
      </label>
      <p className="text-xs text-muted-foreground">
        Credits usually represent deposits, refunds, and income; review preview counts before confirming import.
      </p>
      <p id="mixed-merchants" className="text-[10px] text-muted-foreground">
        Mixed merchants: stores like Walmart, Target, Costco, and Amazon often include items from many categories. After importing, you can use
        Transaction History → Split to assign parts of a purchase to different envelopes.
      </p>

      {parsed.diagnostics.length > 0 && (
        <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
          {parsed.diagnostics.map((diag, index) => (
            <li key={`${diag.message}-${index}`}>{diag.message}</li>
          ))}
        </ul>
      )}
      {classification.diagnostics.length > 0 && (
        <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
          {classification.diagnostics.map((diag, index) => (
            <li key={`${diag.message}-classification-${index}`}>{diag.message}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirmDisabled}
          className={`${dataMgmtBtn} disabled:opacity-60 disabled:pointer-events-none`}
        >
          Confirm statement import
        </button>
        <button type="button" onClick={onCancel} className={dataMgmtBtn}>
          Cancel
        </button>
      </div>
    </div>
  );
}
