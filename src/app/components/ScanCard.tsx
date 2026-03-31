import { useState } from 'react';
import type { ReceiptLineItem as ParserLineItem } from '@/app/services/receiptParser';
import { delayedToast } from '@/app/services/delayedToast';
import { formatMoney, getCurrencySymbol } from '@/app/utils/format';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog';
import { allocateTotalProportionally } from '@/app/services/receiptAllocation';

const CREATE_ENVELOPE_VALUE = '__create__';
const EXCLUDE_ENVELOPE_VALUE = '__exclude__';

/** Round to 2 decimal places for money. */
export function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export type ReceiptLineItem = ParserLineItem & { originalDescription?: string };

export interface ReceiptScanResult {
  id: string;
  amount: number | null;
  description: string;
  rawText: string;
  date: string;
  lineItems?: ReceiptLineItem[];
  addedToEnvelope?: boolean;
  /** From parser when present */
  time?: string;
  currency?: string;
  subtotal?: number;
  tax?: number;
  change?: number;
  isRefund?: boolean;
  /** Derived at parse time when subtotal and tax exist (tax / subtotal); used to recalculate tax when line items change. */
  taxRate?: number;
  /** Amount the user actually paid (e.g. cash, or total after tip). Stored with the receipt for records. */
  amountPaid?: number | null;
  /** In-memory only: original image data URL for saving to archive (compressed on save). */
  imageDataUrl?: string;
  /** Parsed merchant name (OCR); used to learn store name when user edits and saves. */
  parsedMerchant?: string;
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `scan-${crypto.randomUUID()}`;
  }
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface ScanCardProps {
  scan: ReceiptScanResult;
  hasEnvelopes: boolean;
  envelopes: { id: string; name: string }[];
  onUpdate: (updates: Partial<Pick<ReceiptScanResult, 'amount' | 'description' | 'lineItems' | 'date' | 'time' | 'subtotal' | 'tax' | 'amountPaid'>>) => void;
  onSave?: (scan: ReceiptScanResult) => void;
  onRemoveScan?: (id: string) => void;
  onAddEnvelope?: (name: string, limit: number) => { id: string; name: string };
  glossary?: Record<string, string>;
  isSaving?: boolean;
}

/** Height to show ~8 line item rows (each row ~2.5rem). */
export const LINE_ITEMS_VISIBLE_HEIGHT = '20rem';

export function ScanCard({ scan, hasEnvelopes, envelopes, onUpdate, onSave, onRemoveScan, onAddEnvelope, glossary = {}, isSaving = false }: ScanCardProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [showBudgetDetails, setShowBudgetDetails] = useState(false);
  const [creatingForLineIndex, setCreatingForLineIndex] = useState<number | null>(null);
  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvLimit, setNewEnvLimit] = useState('');
  const [showRemoveLineItemDialog, setShowRemoveLineItemDialog] = useState(false);
  const [pendingRemoveLineItemIndex, setPendingRemoveLineItemIndex] = useState<number | null>(null);
  const [showRemoveReceiptFromListDialog, setShowRemoveReceiptFromListDialog] = useState(false);
  const amount = scan.amount ?? 0;
  const lineItems = scan.lineItems ?? [];

  const applyLineItemsUpdate = (next: ReceiptLineItem[]) => {
    const nonTaxLines = next.filter((li) => li.isTax !== true);
    const taxLines = next.filter((li) => li.isTax === true);
    const newSubtotal = nonTaxLines.length > 0 ? roundTo2(nonTaxLines.reduce((sum, li) => sum + li.amount, 0)) : next.length > 0 ? 0 : undefined;
    const newTax =
      taxLines.length > 0
        ? roundTo2(taxLines.reduce((sum, li) => sum + li.amount, 0))
        : scan.tax != null
          ? roundTo2(scan.tax)
          : newSubtotal != null && scan.taxRate != null
            ? roundTo2(newSubtotal * scan.taxRate)
            : undefined;
    const shouldUpdateTax = taxLines.length > 0 || scan.tax == null;
    const newAmount = newSubtotal != null && newTax != null ? roundTo2(newSubtotal + newTax) : newSubtotal != null ? newSubtotal : undefined;
    onUpdate({
      lineItems: next,
      ...(newSubtotal != null && { subtotal: newSubtotal }),
      ...(shouldUpdateTax && newTax != null && { tax: newTax }),
      ...(scan.amount == null && newAmount != null && { amount: newAmount }),
    });
  };

  const updateLineItem = (
    index: number,
    updates: Partial<Pick<ReceiptLineItem, 'description' | 'amount' | 'quantity' | 'envelopeId' | 'excludeFromBudget' | 'isTax'>>
  ) => {
    const applied = updates.amount != null ? { ...updates, amount: roundTo2(updates.amount) } : updates;
    const next = (scan.lineItems ?? []).map((item, i) => (i === index ? { ...item, ...applied } : item));
    applyLineItemsUpdate(next);
  };

  const removeLineItem = (index: number) => {
    const next = (scan.lineItems ?? []).filter((_, j) => j !== index);
    applyLineItemsUpdate(next);
  };

  const addLineItem = () => {
    const next = [...(scan.lineItems ?? []), { description: '', amount: 0, envelopeId: undefined }];
    applyLineItemsUpdate(next);
  };

  const nonTaxSum = lineItems.filter((li) => li.isTax !== true).reduce((sum, li) => sum + li.amount, 0);
  const taxLinesSum = lineItems.filter((li) => li.isTax === true).reduce((sum, li) => sum + li.amount, 0);
  const hasTaxLines = lineItems.some((li) => li.isTax === true);
  const hasTax = scan.tax != null && scan.tax > 0;
  const hasAnyTaxLineEnvelope = lineItems.some((li) => li.isTax === true && li.envelopeId);
  const showTaxSpreadNote = hasTax && (!hasTaxLines || !hasAnyTaxLineEnvelope);
  const subtotal = scan.subtotal ?? (lineItems.length > 0 ? roundTo2(nonTaxSum) : null);
  const tax = hasTaxLines ? roundTo2(taxLinesSum) : (scan.tax ?? null);
  const grandTotal = scan.amount ?? (subtotal != null && tax != null ? roundTo2(subtotal + tax) : null);
  const amountPaid = scan.amountPaid ?? null;
  const amountToUse = amountPaid ?? grandTotal;
  const budgetableLines = lineItems.filter(
    (li) =>
      li.excludeFromBudget !== true &&
      li.amount > 0 &&
      Number.isFinite(li.amount) &&
      (li.isTax !== true || li.envelopeId != null)
  );
  const budgetPreviewTotal =
    amountToUse != null && amountToUse > 0 && budgetableLines.length > 0
      ? roundTo2(amountToUse)
      : roundTo2(budgetableLines.reduce((sum, li) => sum + li.amount, 0));
  const budgetPreviewAllocations = budgetableLines.length > 0
    ? allocateTotalProportionally({
        items: budgetableLines.map((li) => ({ amount: li.amount })),
        totalToAllocate: budgetPreviewTotal,
      })
    : [];
  const excludedCount = lineItems.filter((li) => li.excludeFromBudget === true).length;
  const hasBudgetMismatch = amountToUse != null && amountToUse > 0 && budgetableLines.length > 0 && roundTo2(budgetPreviewTotal) !== roundTo2(amountToUse);
  const currency = scan.currency ?? 'USD';
  const currencySymbol = getCurrencySymbol(currency);
  const formatOpts = { currency };

  return (
    <li className="p-3 bg-card border border-border rounded-lg flex flex-col gap-3">
      {/* Store name at top */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Store name</span>
        <input
          type="text"
          value={scan.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Store name"
          className="w-full px-2 py-1 border border-primary/30 rounded-lg bg-background text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
          aria-label="Store name"
        />
      </label>

      {/* Editable date and time */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground shrink-0">Date</span>
          <input
            type="date"
            value={scan.date || ''}
            onChange={(e) => onUpdate({ date: e.target.value || todayISO() })}
            className="px-2 py-1 border border-primary/30 rounded-lg bg-background text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
            aria-label="Receipt date"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground shrink-0">Time</span>
          <input
            type="text"
            value={scan.time ?? ''}
            onChange={(e) => onUpdate({ time: e.target.value || undefined })}
            placeholder="e.g. 10:30 AM"
            className="w-28 px-2 py-1 border border-primary/30 rounded-lg bg-background text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
            aria-label="Receipt time"
          />
        </label>
      </div>

      {/* Line items: add/remove rows, ~8 rows scrollable */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Line items</span>
          <button
            type="button"
            onClick={addLineItem}
            className="text-xs px-2 py-1 rounded border border-primary/50 text-primary hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
            aria-label="Add line item"
          >
            Add line item
          </button>
        </div>
        {lineItems.length > 0 ? (
          <ul
            className="text-xs bg-muted/50 p-2 rounded-lg overflow-y-auto space-y-2"
            style={{ maxHeight: LINE_ITEMS_VISIBLE_HEIGHT }}
            aria-label="Receipt line items (editable)"
          >
            {lineItems.map((item, i) => {
              const displayName = glossary[item.description] ?? item.description;
              return (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateLineItem(i, { description: e.target.value })}
                    placeholder={displayName !== item.description ? displayName : 'Item name'}
                    className="flex-1 min-w-[14ch] w-0 px-2 py-1 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
                    aria-label={`Edit item ${i + 1} description`}
                  />
                  <span className="text-muted-foreground shrink-0" aria-hidden>{currencySymbol}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.amount}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isNaN(v) || v < 0) return;
                      if (v === 0) {
                        setPendingRemoveLineItemIndex(i);
                        setShowRemoveLineItemDialog(true);
                        return;
                      }
                      updateLineItem(i, { amount: roundTo2(v) });
                    }}
                    className="w-20 px-2 py-1 border border-border rounded-lg bg-background text-foreground text-xs tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
                    aria-label={`Edit item ${i + 1} amount`}
                  />
                  {item.isTax === true ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title="Tax line">
                        Tax
                      </span>
                      <button
                        type="button"
                        onClick={() => updateLineItem(i, { isTax: false })}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        aria-label={`Mark item ${i + 1} as not tax`}
                        title="Not tax?"
                      >
                        Not tax?
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.excludeFromBudget === true}
                        onChange={() => updateLineItem(i, { excludeFromBudget: item.excludeFromBudget !== true })}
                        className="rounded border-border"
                        aria-label={`Exclude item ${i + 1} from budget`}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Exclude</span>
                    </label>
                  )}
                  <select
                    value={item.excludeFromBudget === true ? EXCLUDE_ENVELOPE_VALUE : (item.envelopeId ?? '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === CREATE_ENVELOPE_VALUE) {
                        setCreatingForLineIndex(i);
                      } else if (v === EXCLUDE_ENVELOPE_VALUE) {
                        updateLineItem(i, { excludeFromBudget: true, envelopeId: undefined });
                      } else {
                        updateLineItem(i, { envelopeId: v || undefined, excludeFromBudget: false });
                      }
                    }}
                    className="text-xs px-2 py-1 border border-border rounded-lg bg-background text-foreground min-w-[100px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
                    aria-label={`Category for item ${i + 1}`}
                  >
                    <option value="">Category</option>
                    <option value={EXCLUDE_ENVELOPE_VALUE}>Exclude</option>
                    {envelopes.map((env) => (
                      <option key={env.id} value={env.id}>{env.name}</option>
                    ))}
                    {onAddEnvelope && <option value={CREATE_ENVELOPE_VALUE}>Create new envelope…</option>}
                  </select>
                  {displayName !== item.description && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={displayName}>
                      → {displayName}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeLineItem(i)}
                    className="text-xs px-1.5 py-0.5 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 shrink-0"
                    aria-label={`Remove item ${i + 1}`}
                    title="Remove line item"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground py-2">No line items. Click &quot;Add line item&quot; to add one.</p>
        )}
      </div>

      {/* Subtotal, Tax, Grand total — always visible, user edits directly */}
      <div className="flex flex-col gap-2 text-sm">
        {scan.currency && (
          <span className="self-end text-xs text-muted-foreground px-2 py-0.5 bg-muted/60 rounded-full">
            {scan.currency}
          </span>
        )}
        <label className="flex justify-between items-center gap-2 text-muted-foreground">
          <span>Subtotal</span>
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground shrink-0" aria-hidden>{currencySymbol}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={subtotal != null ? subtotal.toFixed(2) : ''}
              onChange={(e) => {
                const v = e.target.value !== '' ? parseFloat(e.target.value) : undefined;
                onUpdate({ subtotal: v != null && !Number.isNaN(v) ? roundTo2(v) : undefined });
              }}
              placeholder="0.00"
              className="w-24 px-2 py-1 border border-border rounded-lg bg-background text-foreground text-sm tabular-nums text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
              aria-label="Subtotal"
            />
          </span>
        </label>
        <label className="flex justify-between items-center gap-2 text-muted-foreground">
          <span>Tax</span>
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground shrink-0" aria-hidden>{currencySymbol}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={tax != null ? tax.toFixed(2) : ''}
              onChange={(e) => {
                const v = e.target.value !== '' ? parseFloat(e.target.value) : undefined;
                onUpdate({ tax: v != null && !Number.isNaN(v) ? roundTo2(v) : undefined });
              }}
              placeholder="0.00"
              className="w-24 px-2 py-1 border border-border rounded-lg bg-background text-foreground text-sm tabular-nums text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
              aria-label="Tax"
            />
          </span>
        </label>
        <p className="text-xs text-muted-foreground">
          Tax is distributed proportionally across your budgeted line items unless you assign it to an envelope or exclude it.
        </p>
        <label className="flex justify-between items-center gap-2 font-medium text-foreground border-t border-border pt-2">
          <span>Grand total</span>
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground shrink-0" aria-hidden>{currencySymbol}</span>
            <input
              type="number"
              step="0.01"
              value={grandTotal != null ? grandTotal.toFixed(2) : ''}
              onChange={(e) => {
                const v = e.target.value !== '' ? parseFloat(e.target.value) : null;
                if (v != null && !Number.isNaN(v) && v === 0 && onRemoveScan) {
                  setShowRemoveReceiptFromListDialog(true);
                  return;
                }
                onUpdate({ amount: v != null && !Number.isNaN(v) ? roundTo2(v) : v });
              }}
              placeholder="0.00"
              className="w-24 px-2 py-1 border border-border rounded-lg bg-background text-foreground text-sm tabular-nums text-right font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
              aria-label="Grand total"
            />
          </span>
        </label>
        <label className="flex justify-between items-center gap-2 text-muted-foreground">
          <span>Amount you paid</span>
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground shrink-0" aria-hidden>{currencySymbol}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountPaid != null ? amountPaid.toFixed(2) : ''}
              onChange={(e) => {
                const v = e.target.value !== '' ? parseFloat(e.target.value) : null;
                onUpdate({ amountPaid: v != null && !Number.isNaN(v) && v >= 0 ? roundTo2(v) : v });
              }}
              placeholder={grandTotal != null ? grandTotal.toFixed(2) : '0.00'}
              className="w-24 px-2 py-1 border border-border rounded-lg bg-background text-foreground text-sm tabular-nums text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
              aria-label="Amount you paid"
            />
          </span>
        </label>
        <p className="text-xs text-muted-foreground">
          Use this when what you paid differs from the receipt total (e.g. cash, tip, or discount). Stored with the receipt for your records.
        </p>
        {scan.change != null && scan.change > 0 && (
          <p className="text-xs text-muted-foreground flex justify-between items-center gap-2 pt-1">
            <span>Change</span>
            <span className="tabular-nums">{formatMoney(scan.change, formatOpts)}</span>
          </p>
        )}
        {amountToUse != null && amountToUse !== 0 && (
          <p className="text-xs text-muted-foreground flex justify-between items-center gap-2 pt-1 border-t border-border">
            <span>{amountToUse > 0 ? 'Total spent' : 'Refund'}</span>
            <span className="tabular-nums font-medium">
              {amountToUse > 0 ? formatMoney(-amountToUse, formatOpts) : formatMoney(Math.abs(amountToUse), formatOpts)}
            </span>
          </p>
        )}
        {budgetPreviewTotal > 0 && (
          <div className="text-xs border-t border-border pt-2 space-y-1">
            <p className="flex justify-between items-center gap-2 text-foreground">
              <span>Will be added to budget</span>
              <span className="tabular-nums font-medium">{formatMoney(-budgetPreviewTotal, formatOpts)}</span>
            </p>
            {showTaxSpreadNote && (
              <p className="text-muted-foreground">
                Includes {formatMoney(scan.tax ?? 0, formatOpts)} tax spread across items.
              </p>
            )}
            <p className="text-muted-foreground">
              {excludedCount > 0
                ? `${excludedCount} line ${excludedCount === 1 ? 'is' : 'lines are'} excluded from budget.`
                : 'All included lines will be allocated proportionally so envelope totals match what you paid.'}
            </p>
            {budgetableLines.length > 0 && (
              <button
                type="button"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
                onClick={() => setShowBudgetDetails((v) => !v)}
                aria-expanded={showBudgetDetails}
                aria-controls={`budget-preview-${scan.id}`}
              >
                {showBudgetDetails ? 'Hide details' : 'Show details'}
              </button>
            )}
            {showBudgetDetails && budgetableLines.length > 0 && (
              <ul id={`budget-preview-${scan.id}`} className="space-y-1 pt-1 text-muted-foreground">
                {budgetableLines.map((li, idx) => (
                  <li key={`${li.description}-${idx}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">{li.description || `Item ${idx + 1}`}</span>
                    <span className="tabular-nums shrink-0">{formatMoney(-budgetPreviewAllocations[idx], formatOpts)}</span>
                  </li>
                ))}
              </ul>
            )}
            {hasBudgetMismatch && (
              <p className="text-amber-600 dark:text-amber-400">
                Budget import total differs from amount paid. Check excluded lines and totals before saving.
              </p>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowRaw((r) => !r)}
        className="text-xs text-muted-foreground hover:text-foreground text-left self-start"
      >
        {showRaw ? 'Hide raw text' : 'Show raw text from receipt'}
      </button>

      {showRaw && (
        <pre className="text-xs text-muted-foreground bg-muted/50 p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap break-words">
          {scan.rawText || '(none)'}
        </pre>
      )}

      {/* One Save button: saves receipt and creates transactions for each line item that has a category */}
      <div className="flex flex-wrap items-center gap-2">
        {onSave && (
          <>
            <button
              type="button"
              onClick={() => onSave(scan)}
              disabled={isSaving}
              aria-busy={isSaving}
              className="text-sm py-1 px-3 rounded-lg border border-primary/30 hover:bg-primary/10 text-foreground disabled:opacity-60"
              aria-label={isSaving ? 'Saving receipt' : 'Save receipt'}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
        {scan.addedToEnvelope && (
          <span className="text-xs text-primary">Saved and added to budget</span>
        )}
      </div>
      {hasEnvelopes && !scan.addedToEnvelope && (
        <p className="text-xs text-muted-foreground">
          Pick a category for each line item you want to add to your budget, then click Save. The app will save the receipt and create those expenses for you.
        </p>
      )}
      {amount === 0 && !scan.addedToEnvelope && (
        <p className="text-xs text-muted-foreground">
          {scan.rawText?.trim() && (scan.amount == null && (scan.lineItems ?? []).length === 0)
            ? 'We couldn\'t detect a total or line items from this image. Enter the Grand total (or use "Show raw text" to see what was read), pick categories for lines, and Save.'
            : 'Enter the Grand total if needed, pick categories for line items, then Save.'}
        </p>
      )}

      <ConfirmDialog
        open={showRemoveLineItemDialog}
        onOpenChange={(open) => {
          setShowRemoveLineItemDialog(open);
          if (!open) setPendingRemoveLineItemIndex(null);
        }}
        title="Remove line item?"
        description="The line will be removed from this receipt."
        confirmLabel="Remove"
        onConfirm={() => {
          if (pendingRemoveLineItemIndex != null) removeLineItem(pendingRemoveLineItemIndex);
          setPendingRemoveLineItemIndex(null);
        }}
      />

      <ConfirmDialog
        open={showRemoveReceiptFromListDialog}
        onOpenChange={setShowRemoveReceiptFromListDialog}
        title="Remove receipt?"
        description="This receipt will be removed from the list."
        confirmLabel="Remove receipt"
        onConfirm={() => {
          if (onRemoveScan) onRemoveScan(scan.id);
        }}
      />

      <Dialog open={creatingForLineIndex !== null} onOpenChange={(open) => { if (!open) { setCreatingForLineIndex(null); setNewEnvName(''); setNewEnvLimit(''); } }}>
        <DialogContent className="sm:max-w-sm" aria-describedby="new-envelope-desc">
          <DialogHeader>
            <DialogTitle>New envelope</DialogTitle>
            <p id="new-envelope-desc" className="text-sm text-muted-foreground">
              Create a category for this line item. It will appear in Envelopes &amp; Expenses.
            </p>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = newEnvName.trim();
              const limit = parseFloat(newEnvLimit);
              if (!name) {
                delayedToast.error('Enter a name for the envelope.');
                return;
              }
              if (Number.isNaN(limit) || limit <= 0) {
                delayedToast.error('Enter a positive amount for the maximum.');
                return;
              }
              if (!onAddEnvelope || creatingForLineIndex === null) return;
              try {
                const env = onAddEnvelope(name, limit);
                updateLineItem(creatingForLineIndex, { envelopeId: env.id });
                setCreatingForLineIndex(null);
                setNewEnvName('');
                setNewEnvLimit('');
              } catch {
                delayedToast.error('Could not create envelope. Please check the name and amount, then try again.');
              }
            }}
            className="space-y-4"
          >
            <label className="block text-sm font-medium text-foreground">
              Name
              <input
                type="text"
                value={newEnvName}
                onChange={(e) => setNewEnvName(e.target.value)}
                placeholder="e.g. Groceries"
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label="Envelope name"
                autoFocus
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Maximum
              <input
                type="number"
                min="0"
                step="0.01"
                value={newEnvLimit}
                onChange={(e) => setNewEnvLimit(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label="Envelope maximum"
              />
            </label>
            <DialogFooter>
              <button
                type="button"
                onClick={() => { setCreatingForLineIndex(null); setNewEnvName(''); setNewEnvLimit(''); }}
                className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted/50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-sm rounded-lg border border-primary/30 hover:bg-primary/10 text-foreground"
              >
                Create
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </li>
  );
}