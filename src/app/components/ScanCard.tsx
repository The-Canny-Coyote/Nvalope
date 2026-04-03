import { useState, useRef } from 'react';
import type { ReceiptLineItem as ParserLineItem } from '@/app/services/receiptParser';
import { delayedToast } from '@/app/services/delayedToast';
import { formatMoney, getCurrencySymbol, roundTo2 } from '@/app/utils/format';
import { todayISO } from '@/app/utils/date';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog';
import { allocateTotalProportionally } from '@/app/services/receiptAllocation';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

const CREATE_ENVELOPE_VALUE = '__create__';
const EXCLUDE_ENVELOPE_VALUE = '__exclude__';


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
  /** Tesseract overall confidence for the best OCR pass (0–100). Used to warn users about low-quality scans. */
  ocrConfidence?: number;
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

// ---------------------------------------------------------------------------
// EnvelopePicker — searchable popover replacing the native <select>
// ---------------------------------------------------------------------------
interface EnvelopePickerProps {
  value: string;
  envelopes: { id: string; name: string }[];
  onSelect: (value: string) => void;
  onCreateNew?: () => void;
  lineIndex: number;
}

function EnvelopePicker({ value, envelopes, onSelect, onCreateNew, lineIndex }: EnvelopePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedName =
    value === EXCLUDE_ENVELOPE_VALUE
      ? 'Excluded'
      : envelopes.find((e) => e.id === value)?.name ?? '';

  const q = search.trim().toLowerCase();
  const filtered = q ? envelopes.filter((e) => e.name.toLowerCase().includes(q)) : envelopes;

  const close = () => { setOpen(false); setSearch(''); };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`text-xs px-2 py-1.5 border rounded-lg min-w-[100px] max-w-[140px] text-left flex items-center justify-between gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors min-h-[2rem] ${
            selectedName ? 'border-primary/40 bg-primary/5 text-foreground' : 'border-border bg-background text-muted-foreground'
          }`}
          aria-label={`Category for item ${lineIndex + 1}: ${selectedName || 'none'}`}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate">{selectedName || 'Category'}</span>
          <ChevronDown className="w-3 h-3 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-52 p-1.5"
        onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
      >
        <input
          ref={inputRef}
          type="search"
          placeholder="Search envelopes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-border rounded-md bg-background text-foreground mb-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          aria-label="Search envelopes"
        />
        <ul role="listbox" aria-label={`Category for item ${lineIndex + 1}`} className="max-h-44 overflow-y-auto space-y-0.5">
          <li>
            <button
              type="button"
              role="option"
              aria-selected={value === ''}
              onClick={() => { onSelect(''); close(); }}
              className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${value === '' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
            >
              No category
            </button>
          </li>
          <li>
            <button
              type="button"
              role="option"
              aria-selected={value === EXCLUDE_ENVELOPE_VALUE}
              onClick={() => { onSelect(EXCLUDE_ENVELOPE_VALUE); close(); }}
              className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${value === EXCLUDE_ENVELOPE_VALUE ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
            >
              Exclude from budget
            </button>
          </li>
          {filtered.length > 0 && (
            <li className="pt-1 pb-0.5">
              <p className="text-[10px] text-muted-foreground px-2 uppercase tracking-wide">Envelopes</p>
            </li>
          )}
          {filtered.map((env) => (
            <li key={env.id}>
              <button
                type="button"
                role="option"
                aria-selected={value === env.id}
                onClick={() => { onSelect(env.id); close(); }}
                className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${value === env.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
              >
                {env.name}
              </button>
            </li>
          ))}
          {q && filtered.length === 0 && (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">No match for "{search}"</li>
          )}
          {!q && envelopes.length === 0 && !onCreateNew && (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">No envelopes yet</li>
          )}
          {onCreateNew && (
            <li className="pt-1 border-t border-border mt-1">
              <button
                type="button"
                onClick={() => { onCreateNew(); close(); }}
                className="w-full text-left px-2 py-1.5 text-xs rounded-md text-primary hover:bg-primary/10 transition-colors"
              >
                + Create new envelope…
              </button>
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// ScanCard
// ---------------------------------------------------------------------------
export function ScanCard({ scan, hasEnvelopes, envelopes, onUpdate, onSave, onRemoveScan, onAddEnvelope, glossary = {}, isSaving = false }: ScanCardProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [showBudgetDetails, setShowBudgetDetails] = useState(false);
  const [creatingForLineIndex, setCreatingForLineIndex] = useState<number | null>(null);
  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvLimit, setNewEnvLimit] = useState('');
  const [showRemoveLineItemDialog, setShowRemoveLineItemDialog] = useState(false);
  const [pendingRemoveLineItemIndex, setPendingRemoveLineItemIndex] = useState<number | null>(null);
  const [showRemoveReceiptFromListDialog, setShowRemoveReceiptFromListDialog] = useState(false);
  // Progressive-disclosure state — initialised from scan data on mount
  const [showLineItems, setShowLineItems] = useState(() => (scan.lineItems ?? []).length > 0);
  const [showTotalsDetail, setShowTotalsDetail] = useState(() => scan.subtotal != null || scan.tax != null);
  const [showAmountPaid, setShowAmountPaid] = useState(() => scan.amountPaid != null);

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
      ...(newAmount != null && { amount: newAmount }),
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
    setShowLineItems(true);
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
  const hasTaxInBudgetable = budgetableLines.some((li) => li.isTax === true && li.envelopeId != null);
  const nonTaxBudgetableSum = roundTo2(
    budgetableLines.filter((li) => li.isTax !== true).reduce((sum, li) => sum + li.amount, 0)
  );
  const effectiveSubtotal = subtotal ?? (nonTaxBudgetableSum > 0 ? nonTaxBudgetableSum : null);
  const totalForPreview = amountPaid != null
    ? amountPaid
    : hasTaxInBudgetable
      ? (grandTotal ?? 0)
      : (effectiveSubtotal ?? grandTotal ?? 0);
  const budgetPreviewTotal =
    totalForPreview > 0 && budgetableLines.length > 0
      ? roundTo2(totalForPreview)
      : roundTo2(budgetableLines.reduce((sum, li) => sum + li.amount, 0));
  const budgetPreviewAllocations = budgetableLines.length > 0
    ? allocateTotalProportionally({
        items: budgetableLines.map((li) => ({ amount: li.amount })),
        totalToAllocate: budgetPreviewTotal,
      })
    : [];
  const excludedCount = lineItems.filter(
    (li) => li.excludeFromBudget === true || (li.isTax === true && !li.envelopeId)
  ).length;
  const hasBudgetMismatch =
    amountToUse != null &&
    amountToUse > 0 &&
    budgetableLines.length > 0 &&
    roundTo2(budgetPreviewTotal) !== roundTo2(amountToUse);
  const currency = scan.currency ?? 'USD';
  const currencySymbol = getCurrencySymbol(currency);
  const formatOpts = { currency };

  return (
    <li className="relative p-3 bg-card border border-border rounded-lg flex flex-col gap-3">

      {/* 1.4 — Dismiss button top-right */}
      {onRemoveScan && !scan.addedToEnvelope && (
        <button
          type="button"
          onClick={() => setShowRemoveReceiptFromListDialog(true)}
          className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Remove this receipt from the list"
          title="Remove receipt"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Low OCR confidence warning */}
      {scan.ocrConfidence != null && scan.ocrConfidence < 60 && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs"
          role="alert"
        >
          <span className="shrink-0 mt-0.5" aria-hidden>⚠</span>
          <span>
            <strong>Low scan quality</strong> — the image was hard to read (confidence {scan.ocrConfidence}%).
            Check all values carefully, especially totals and line item amounts.
          </span>
        </div>
      )}

      {/* Store name — pr-8 keeps text clear of the dismiss button */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Store name</span>
        <input
          type="text"
          value={scan.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Store name"
          className="w-full pr-8 px-2 py-1 border border-primary/30 rounded-lg bg-background text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
          aria-label="Store name"
        />
      </label>

      {/* Date and time */}
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

      {/* 2.1 — Line items with collapse/expand toggle */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowLineItems((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
            aria-expanded={showLineItems}
          >
            {showLineItems ? <ChevronUp className="w-3 h-3" aria-hidden /> : <ChevronDown className="w-3 h-3" aria-hidden />}
            <span>
              {lineItems.length > 0
                ? `${lineItems.length} line item${lineItems.length === 1 ? '' : 's'}`
                : 'Line items'}
            </span>
          </button>
          <button
            type="button"
            onClick={addLineItem}
            className="text-xs px-2 py-1 rounded border border-primary/50 text-primary hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
            aria-label="Add line item"
          >
            + Add
          </button>
        </div>

        {showLineItems && (
          lineItems.length > 0 ? (
            <ul
              className="text-xs bg-muted/50 p-2 rounded-lg overflow-y-auto space-y-2"
              style={{ maxHeight: LINE_ITEMS_VISIBLE_HEIGHT }}
              aria-label="Receipt line items (editable)"
            >
              {lineItems.map((item, i) => {
                const displayName = glossary[item.description] ?? item.description;
                const pickerValue = item.excludeFromBudget === true ? EXCLUDE_ENVELOPE_VALUE : (item.envelopeId ?? '');
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
                        <span className="text-[10px] px-1.5 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium" title="Tax line">
                          Tax
                        </span>
                        <button
                          type="button"
                          onClick={() => updateLineItem(i, { isTax: false })}
                          className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-h-[2rem]"
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
                        <span
                          className="text-xs text-muted-foreground whitespace-nowrap"
                          title="Skip this line when adding to your budget. The receipt is still saved to Archive."
                        >
                          Exclude
                        </span>
                      </label>
                    )}
                    {/* 3.2 — Searchable envelope picker replaces <select> */}
                    <EnvelopePicker
                      value={pickerValue}
                      envelopes={envelopes}
                      lineIndex={i}
                      onSelect={(v) => {
                        if (v === EXCLUDE_ENVELOPE_VALUE) {
                          updateLineItem(i, { excludeFromBudget: true, envelopeId: undefined });
                        } else {
                          updateLineItem(i, { envelopeId: v || undefined, excludeFromBudget: false });
                        }
                      }}
                      onCreateNew={onAddEnvelope ? () => setCreatingForLineIndex(i) : undefined}
                    />
                    {displayName !== item.description && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={displayName}>
                        → {displayName}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeLineItem(i)}
                      className="text-xs px-2 py-1.5 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 shrink-0 min-h-[2rem]"
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
            <p className="text-xs text-muted-foreground py-1.5 text-center">
              No items detected — use <strong>+ Add</strong> to enter them manually.
            </p>
          )
        )}
      </div>

      {/* Totals box */}
      <div className="flex flex-col gap-2 text-sm">
        <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Totals</span>
            {scan.currency && (
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted/60 rounded-full">
                {scan.currency}
              </span>
            )}
          </div>

          {/* 2.3 — Subtotal + tax behind a "Show breakdown" toggle */}
          <button
            type="button"
            onClick={() => setShowTotalsDetail((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded self-start"
            aria-expanded={showTotalsDetail}
          >
            {showTotalsDetail ? <ChevronUp className="w-3 h-3" aria-hidden /> : <ChevronDown className="w-3 h-3" aria-hidden />}
            <span>{showTotalsDetail ? 'Hide breakdown' : 'Show breakdown'}</span>
            {!showTotalsDetail && subtotal != null && (
              <span className="tabular-nums ml-1 text-foreground">
                {currencySymbol}{subtotal.toFixed(2)}{tax != null ? ` + ${currencySymbol}${tax.toFixed(2)} tax` : ''}
              </span>
            )}
          </button>

          {showTotalsDetail && (
            <>
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

              {/* 2.4 — Tax label with tooltip instead of inline paragraph */}
              <label className="flex justify-between items-center gap-2 text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span>Tax</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="text-[11px] text-muted-foreground cursor-help select-none"
                        aria-label="Tax info"
                      >ⓘ</span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[220px] text-xs leading-relaxed">
                      Tax is distributed proportionally across your budgeted line items unless you assign it to an envelope or exclude it.
                    </TooltipContent>
                  </Tooltip>
                  {showTaxSpreadNote && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">spread across items</span>
                  )}
                </span>
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
            </>
          )}

          {/* Grand total — always visible */}
          <label className="flex justify-between items-center gap-2 font-semibold text-foreground border-t border-border pt-2">
            <span>Grand total <span className="text-xs font-normal text-muted-foreground">(from receipt)</span></span>
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
        </div>

        {/* 2.2 — Amount paid: progressive disclosure */}
        {!showAmountPaid ? (
          <button
            type="button"
            onClick={() => setShowAmountPaid(true)}
            className="text-xs text-muted-foreground hover:text-foreground self-start focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded transition-colors"
          >
            Paid a different amount? (cash, tip, discount…)
          </button>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="flex justify-between items-center gap-2 text-muted-foreground text-sm">
              <span className="flex items-center gap-1.5">
                <span>Amount you paid</span>
                <button
                  type="button"
                  onClick={() => { setShowAmountPaid(false); onUpdate({ amountPaid: null }); }}
                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 rounded"
                  aria-label="Remove amount override"
                  title="Remove override"
                >✕</button>
              </span>
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
                  autoFocus
                />
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              Override the receipt total — useful when you paid with cash and received change, left a tip, or used a discount not shown.
            </p>
          </div>
        )}

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
                ? `${excludedCount} line ${excludedCount === 1 ? 'is' : 'lines are'} excluded from budget — ${excludedCount === 1 ? 'it' : 'they'} will still be saved to Receipt Archive.`
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

      {/* Save — primary style */}
      <div className="flex flex-wrap items-center gap-2">
        {onSave && (
          <button
            type="button"
            onClick={() => onSave(scan)}
            disabled={isSaving}
            aria-busy={isSaving}
            className="text-sm py-2 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
            aria-label={isSaving ? 'Saving receipt' : 'Save receipt'}
          >
            {isSaving ? 'Saving…' : 'Save receipt'}
          </button>
        )}
        {scan.addedToEnvelope && (
          <span className="text-xs text-primary">Saved and added to budget</span>
        )}
      </div>
      {hasEnvelopes && !scan.addedToEnvelope && (
        <p className="text-xs text-muted-foreground">
          Pick a category for each line item, then tap <strong>Save receipt</strong>. The app creates those budget entries for you.
        </p>
      )}
      {amount === 0 && !scan.addedToEnvelope && (
        <p className="text-xs text-muted-foreground">
          {scan.rawText?.trim() && (scan.amount == null && (scan.lineItems ?? []).length === 0)
            ? 'We couldn\'t detect a total or line items. Enter the Grand total (or check "Show raw text"), pick categories, and Save.'
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

/** Skeleton placeholder shown while OCR is running, sized to match a typical ScanCard. */
export function ScanCardSkeleton() {
  return (
    <li
      className="p-3 bg-card border border-border rounded-lg flex flex-col gap-3 animate-pulse"
      aria-hidden="true"
    >
      {/* Store name */}
      <div className="h-4 w-1/3 rounded bg-muted/60" />
      <div className="h-8 w-full rounded-lg bg-muted/40" />

      {/* Date / time row */}
      <div className="flex gap-4">
        <div className="h-7 w-28 rounded-lg bg-muted/40" />
        <div className="h-7 w-24 rounded-lg bg-muted/40" />
      </div>

      {/* Line items header */}
      <div className="flex justify-between">
        <div className="h-3 w-16 rounded bg-muted/60" />
        <div className="h-6 w-16 rounded-lg bg-muted/40" />
      </div>

      {/* Line item rows */}
      <div className="rounded-lg bg-muted/30 p-2 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className="h-6 flex-1 rounded bg-muted/50" />
            <div className="h-6 w-16 rounded bg-muted/50" />
            <div className="h-6 w-24 rounded bg-muted/50" />
          </div>
        ))}
      </div>

      {/* Totals box */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col gap-2">
        <div className="flex justify-between">
          <div className="h-3 w-10 rounded bg-muted/60" />
          <div className="h-4 w-12 rounded bg-muted/40" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex justify-between items-center">
            <div className={`h-3 rounded bg-muted/50 ${i === 2 ? 'w-24' : 'w-14'}`} />
            <div className="h-7 w-24 rounded-lg bg-muted/40" />
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="h-9 w-24 rounded-lg bg-primary/20" />
    </li>
  );
}
