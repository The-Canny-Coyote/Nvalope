import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useBudget } from '@/app/store/BudgetContext';
import Tesseract from 'tesseract.js';
import { getAppData, setAppData } from '@/app/services/appDataIdb';
import { parseReceiptText, validateReceiptTransaction, type ReceiptLineItem as ParserLineItem } from '@/app/services/receiptParser';
import { suggestCategory } from '@/app/services/receiptCategorization';
import { preprocessReceiptImage } from '@/app/utils/receiptPreprocess';
import { delayedToast } from '@/app/services/delayedToast';
import { toast } from 'sonner';
import { Progress } from '@/app/components/ui/progress';
import { formatMoney, getCurrencySymbol } from '@/app/utils/format';
import { parseYYYYMMDD } from '@/app/utils/date';
import { compressReceiptImageDataUrl } from '@/app/utils/receiptImageCompress';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import type { StoredReceiptScan, ReceiptArchiveItem } from '@/app/services/appDataIdb';

const CREATE_ENVELOPE_VALUE = '__create__';

/** Round to 2 decimal places for money. */
function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/x-portable-pixmap',
  'image/x-portable-graymap',
  'image/avif',
  'image/heic',
];
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|ppm|pgm|avif|heic)$/i;
/** Max file size 10MB to avoid memory pressure and long OCR. */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isAcceptedImageFile(file: File): boolean {
  if (file.type && ACCEPTED_IMAGE_TYPES.includes(file.type)) return true;
  return ACCEPTED_EXTENSIONS.test(file.name);
}

function isWithinSizeLimit(file: File): boolean {
  return file.size > 0 && file.size <= MAX_FILE_SIZE_BYTES;
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

function generateId(): string {
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
}

/** Height to show ~8 line item rows (each row ~2.5rem). */
const LINE_ITEMS_VISIBLE_HEIGHT = '20rem';

function ScanCard({ scan, hasEnvelopes, envelopes, onUpdate, onSave, onRemoveScan, onAddEnvelope, glossary = {} }: ScanCardProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [creatingForLineIndex, setCreatingForLineIndex] = useState<number | null>(null);
  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvLimit, setNewEnvLimit] = useState('');
  const amount = scan.amount ?? 0;
  const lineItems = scan.lineItems ?? [];

  const applyLineItemsUpdate = (next: ReceiptLineItem[]) => {
    const nonTaxLines = next.filter((li) => li.isTax !== true);
    const taxLines = next.filter((li) => li.isTax === true);
    const newSubtotal = nonTaxLines.length > 0 ? roundTo2(nonTaxLines.reduce((sum, li) => sum + li.amount, 0)) : next.length > 0 ? 0 : undefined;
    const newTax =
      taxLines.length > 0
        ? roundTo2(taxLines.reduce((sum, li) => sum + li.amount, 0))
        : newSubtotal != null && scan.taxRate != null
          ? roundTo2(newSubtotal * scan.taxRate)
          : newSubtotal != null ? (scan.tax != null ? roundTo2(scan.tax) : 0) : undefined;
    const newAmount = newSubtotal != null && newTax != null ? roundTo2(newSubtotal + newTax) : newSubtotal != null ? newSubtotal : undefined;
    onUpdate({
      lineItems: next,
      ...(newSubtotal != null && { subtotal: newSubtotal }),
      ...(newTax != null && { tax: newTax }),
      ...(newAmount != null && { amount: newAmount }),
    });
  };

  const updateLineItem = (index: number, updates: Partial<Pick<ReceiptLineItem, 'description' | 'amount' | 'quantity' | 'envelopeId' | 'isTax'>>) => {
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
  const computedSubtotal = lineItems.length > 0 ? nonTaxSum : null;
  const subtotal = scan.subtotal ?? (lineItems.length > 0 ? roundTo2(nonTaxSum) : null);
  const tax = hasTaxLines ? roundTo2(taxLinesSum) : (scan.tax ?? null);
  const grandTotal = scan.amount ?? (subtotal != null && tax != null ? roundTo2(subtotal + tax) : null);
  const amountPaid = scan.amountPaid ?? null;
  const amountToUse = amountPaid ?? grandTotal;
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
                        if (window.confirm('Remove this line item?')) removeLineItem(i);
                        return;
                      }
                      updateLineItem(i, { amount: roundTo2(v) });
                    }}
                    className="w-20 px-2 py-1 border border-border rounded-lg bg-background text-foreground text-xs tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
                    aria-label={`Edit item ${i + 1} amount`}
                  />
                  <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.isTax === true}
                      onChange={() => updateLineItem(i, { isTax: !item.isTax })}
                      className="rounded border-border"
                      aria-label={`Mark item ${i + 1} as tax`}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Tax</span>
                  </label>
                  <select
                    value={item.envelopeId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === CREATE_ENVELOPE_VALUE) {
                        setCreatingForLineIndex(i);
                      } else {
                        updateLineItem(i, { envelopeId: v || undefined });
                      }
                    }}
                    className="text-xs px-2 py-1 border border-border rounded-lg bg-background text-foreground min-w-[100px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
                    aria-label={`Category for item ${i + 1}`}
                  >
                    <option value="">Category</option>
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
                  if (window.confirm('Remove this receipt from the list?')) onRemoveScan(scan.id);
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
              className="text-sm py-1 px-3 rounded-lg border border-primary/30 hover:bg-primary/10 text-foreground"
              aria-label="Save receipt"
            >
              Save
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
              } catch (err) {
                delayedToast.error(err instanceof Error ? err.message : 'Could not create envelope.');
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

function ReceiptScannerContentInner() {
  const { state, api } = useBudget();
  const [scans, setScans] = useState<ReceiptScanResult[]>([]);
  const scansRef = useRef<ReceiptScanResult[]>(scans);
  scansRef.current = scans;
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAcceptedImageFile(file)) {
      setError('Please choose an image file: JPEG, PNG, WebP, GIF, BMP, AVIF, HEIC, or PPM.');
      e.target.value = '';
      return;
    }
    if (!isWithinSizeLimit(file)) {
      setError('Image is too large. Use a file under 10 MB.');
      e.target.value = '';
      return;
    }
    setError(null);
    setScanning(true);
    setScanProgress(0);
    const progressInterval = setInterval(() => {
      setScanProgress((p) => (p >= 90 ? 90 : p + 8));
    }, 300);
    let imageDataUrl: string | undefined;
    try {
      imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    } catch {
      imageDataUrl = undefined;
    }
    let worker: Awaited<ReturnType<typeof Tesseract.createWorker>> | null = null;
    try {
      const ocrImage = await preprocessReceiptImage(file);
      Tesseract.setLogging(false);
      worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
        logger: () => {},
      });
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_COLUMN,
        debug_file: '/dev/null',
      });
      let { data: { text } } = await worker.recognize(ocrImage, { rotateAuto: true });
      let parsed;
      try {
        parsed = parseReceiptText(text ?? '', { glossary });
      } catch {
        parsed = { amount: null, merchant: 'Receipt', lineItems: [], date: undefined, time: undefined, currency: 'USD' };
      }
      if ((text ?? '').trim().length < 30 || (parsed.amount == null && parsed.lineItems.length === 0)) {
        const modes = [Tesseract.PSM.AUTO, Tesseract.PSM.SINGLE_BLOCK] as const;
        for (const psm of modes) {
          await worker!.setParameters({ tessedit_pageseg_mode: psm, debug_file: '/dev/null' });
          const { data: { text: t } } = await worker!.recognize(ocrImage, { rotateAuto: true });
          let p;
          try {
            p = parseReceiptText(t ?? '', { glossary });
          } catch {
            p = parsed;
          }
          if ((t ?? '').trim().length > (text ?? '').trim().length || (p.amount != null && parsed.amount == null) || p.lineItems.length > parsed.lineItems.length) {
            text = t;
            parsed = p;
          }
        }
      }
      await worker.terminate();
      worker = null;
      const subtotal = parsed.subtotal;
      const tax = parsed.tax;
      const taxRate =
        subtotal != null && subtotal > 0 && tax != null
          ? Math.round((tax / subtotal) * 10000) / 10000
          : undefined;
      let suggestedEnvelopeId: string | undefined;
      try {
        const suggestion = await suggestCategory(text.slice(0, 2000), state.envelopes);
        suggestedEnvelopeId = suggestion.envelopeId;
      } catch {
        suggestedEnvelopeId = undefined;
      }
      const lineItemsWithSuggestion =
        parsed.lineItems.length > 0
          ? parsed.lineItems.map((item) => ({
              ...item,
              envelopeId: item.envelopeId ?? suggestedEnvelopeId,
              originalDescription: item.rawDescription ?? item.description,
            }))
          : undefined;
      const parsedMerchant = parsed.merchant.trim() || undefined;
      const appData = await getAppData();
      const aliases = appData.receiptMerchantAliases ?? {};
      const storeName = (parsedMerchant && aliases[parsedMerchant]) ? aliases[parsedMerchant] : (parsedMerchant || 'Receipt');
      setScanProgress(100);
      setScans((prev) => [
        {
          id: generateId(),
          amount: parsed.amount,
          description: storeName,
          parsedMerchant,
          rawText: text.slice(0, 2000),
          date: parsed.date ?? todayISO(),
          lineItems: lineItemsWithSuggestion,
          time: parsed.time,
          currency: parsed.currency,
          subtotal,
          tax,
          change: parsed.change,
          isRefund: parsed.isRefund,
          taxRate,
          imageDataUrl,
        },
        ...prev,
      ]);
      toast.success('Receipt scan complete.');
    } catch {
      setError('Scan failed. Try another image or check the file format.');
    } finally {
      if (worker != null) {
        worker.terminate().catch(() => {});
      }
      clearInterval(progressInterval);
      setScanning(false);
      setScanProgress(0);
      e.target.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const updateScan = (id: string, updates: Partial<Pick<ReceiptScanResult, 'amount' | 'description' | 'lineItems' | 'date' | 'time' | 'subtotal' | 'tax' | 'amountPaid'>>) => {
    setScans((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const handleRemoveScan = useCallback((id: string) => {
    setScans((prev) => {
      const next = prev.filter((s) => s.id !== id);
      getAppData()
        .then((data) => setAppData({ ...data, receiptScans: next }))
        .catch(() => {});
      return next;
    });
  }, []);

  const [glossary, setGlossary] = useState<Record<string, string>>({});

  useEffect(() => {
    getAppData().then((data) => {
      if (data.receiptGlossary && typeof data.receiptGlossary === 'object') {
        setGlossary(data.receiptGlossary);
      }
      if (data.receiptScans && data.receiptScans.length > 0) {
        setScans(data.receiptScans as ReceiptScanResult[]);
      }
    });
  }, []);

  const handleSaveReceipt = useCallback(
    async (scan: ReceiptScanResult) => {
      const current = scansRef.current.find((s) => s.id === scan.id);
      const scanToUse = current ?? scan;
      const lineItems = scanToUse.lineItems ?? [];
      const hasEnvelopes = state.envelopes.length > 0;
      // Use scanned receipt date when valid (YYYY-MM-DD), otherwise today.
      const rawDate = typeof scanToUse.date === 'string' ? scanToUse.date.trim() : '';
      const txDate = rawDate.length === 10 && parseYYYYMMDD(rawDate) ? rawDate : todayISO();
      const batch: { amount: number; envelopeId?: string; description: string; date: string }[] = [];
      for (const item of lineItems) {
        if (item.isTax === true) continue; // tax lines are not added as budget transactions
        if (item.amount <= 0 || !Number.isFinite(item.amount)) continue;
        const description = (item.description && typeof item.description === 'string' ? item.description : '').trim() || (scanToUse.description && typeof scanToUse.description === 'string' ? scanToUse.description : '').trim() || 'Receipt item';
        const validation = validateReceiptTransaction({
          amount: roundTo2(item.amount),
          description,
          date: txDate,
        });
        if (!validation.valid) continue;
        const envelopeId = hasEnvelopes ? (item.envelopeId || undefined) : undefined;
        if (hasEnvelopes && !envelopeId) continue; // skip lines without category when envelopes exist
        batch.push({
          amount: roundTo2(item.amount),
          envelopeId,
          description,
          date: txDate,
        });
      }
      let anyAdded = false;
      let anyUncategorized = false;
      if (batch.length > 0) {
        try {
          api.addTransactions(batch);
          anyAdded = true;
          anyUncategorized = batch.some((p) => !p.envelopeId);
        } catch {
          delayedToast.error('Could not add line items to budget. Check that amounts and date are valid.');
        }
      }
      const nextScans = scans.map((s) =>
        s.id === scanToUse.id ? { ...s, addedToEnvelope: anyAdded } : s
      );
      setScans(nextScans);

      // Learn from user edits: merchant alias and line-item glossary (on-device only)
      const newAlias: Record<string, string> = {};
      if (scanToUse.parsedMerchant && scanToUse.description.trim() && scanToUse.description.trim() !== scanToUse.parsedMerchant) {
        newAlias[scanToUse.parsedMerchant] = scanToUse.description.trim();
      }
      const newGlossary: Record<string, string> = {};
      for (const item of lineItems) {
        if (item.originalDescription != null && item.description.trim() !== item.originalDescription) {
          newGlossary[item.originalDescription] = item.description.trim();
        }
      }
      try {
        const data = await getAppData();
        const updates: Partial<typeof data> = { receiptScans: nextScans };
        if (Object.keys(newAlias).length > 0) {
          updates.receiptMerchantAliases = { ...(data.receiptMerchantAliases ?? {}), ...newAlias };
        }
        if (Object.keys(newGlossary).length > 0) {
          updates.receiptGlossary = { ...(data.receiptGlossary ?? {}), ...newGlossary };
        }
        await setAppData({ ...data, ...updates });
      } catch {
        delayedToast.error('Could not save receipt. Please try again.');
        return;
      }

      // Add to archive (with compressed image if we have it)
      const scanForArchive: StoredReceiptScan = {
        id: scanToUse.id,
        amount: scanToUse.amount,
        description: scanToUse.description,
        rawText: scanToUse.rawText,
        date: scanToUse.date,
        lineItems: scanToUse.lineItems,
        addedToEnvelope: anyAdded,
        time: scanToUse.time,
        currency: scanToUse.currency,
        subtotal: scanToUse.subtotal,
        tax: scanToUse.tax,
        change: scanToUse.change,
        isRefund: scanToUse.isRefund,
        taxRate: scanToUse.taxRate,
        amountPaid: scanToUse.amountPaid,
      };
      let imageData: string | undefined;
      if (scanToUse.imageDataUrl) {
        try {
          imageData = await compressReceiptImageDataUrl(scanToUse.imageDataUrl);
        } catch {
          imageData = undefined;
        }
      }
      const archiveId = `archive-${scanToUse.id}-${Date.now()}`;
      const archiveItem: ReceiptArchiveItem = {
        id: archiveId,
        scan: scanForArchive,
        imageData,
        savedAt: new Date().toISOString(),
      };
      getAppData().then((data) => {
        const archives = data.receiptArchives ?? [];
        setAppData({ ...data, receiptArchives: [archiveItem, ...archives] }).catch(() => delayedToast.error('Receipt saved to budget but archive update failed.'));
      });

      if (anyAdded) {
        if (anyUncategorized || !hasEnvelopes) {
          delayedToast.success(
            'Receipt saved. Create envelopes in Envelopes & Expenses to assign categories; you can edit transactions in Transaction history to assign them later.'
          );
        } else {
          delayedToast.success('Receipt saved. Line items added to your budget.');
        }
      } else {
        delayedToast.success('Receipt saved.');
      }
    },
    [api, state.envelopes.length, scans]
  );

  const loadGlossaryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return;
        const next: Record<string, string> = { ...glossary };
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          if (typeof k === 'string' && typeof v === 'string') next[k] = v;
        }
        setGlossary(next);
        getAppData().then((data) => {
          setAppData({ ...data, receiptGlossary: next }).catch(() => {});
        });
      } catch {
        // invalid JSON
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const hasEnvelopes = state.envelopes.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <h3 className="text-lg text-primary">Receipt Scanner</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Upload a photo or image of your receipt (JPEG, PNG, WebP, GIF, BMP, AVIF, HEIC) to extract the total, merchant, and line items. You can edit results and load a glossary to translate item names (e.g. store abbreviations).
      </p>

      {!hasEnvelopes && (
        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm text-foreground" role="status">
          <p className="font-medium mb-1">Create envelopes first</p>
          <p className="text-muted-foreground">
            Create envelopes in Envelopes &amp; Expenses to assign categories to receipt lines. You can still save receipts now—they will appear in Receipt Archive and in Transaction history as uncategorized. After creating envelopes, edit those transactions to assign categories and envelopes will update for that month.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Item names:</span>
        <label className="flex items-center gap-1 cursor-pointer text-primary hover:underline">
          <input type="file" accept=".json,application/json" className="sr-only" onChange={loadGlossaryFile} aria-label="Load glossary file" />
          Load glossary (JSON)
        </label>
        <a href="/data/receipt-glossary-sample.json" download className="text-primary hover:underline">
          Download sample
        </a>
        {Object.keys(glossary).length > 0 && (
          <span className="text-muted-foreground text-xs">({Object.keys(glossary).length} entries)</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="p-6 border-2 border-dashed border-primary/30 rounded-lg hover:border-primary/60 hover:bg-primary/5 transition-all disabled:opacity-60 w-full"
          >
            <div className="flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-primary/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="text-sm font-medium text-foreground">
              {scanning ? 'Scanning…' : 'Upload image'}
            </span>
              <span className="text-xs text-muted-foreground">Choose a file from your device</span>
            </div>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,image/heic,image/x-portable-pixmap,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.heic,.ppm"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Choose receipt image from device"
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={scanning}
            className="p-6 border-2 border-dashed border-primary/30 rounded-lg hover:border-primary/60 hover:bg-primary/5 transition-all disabled:opacity-60 flex flex-col items-center justify-center gap-2 w-full"
          >
            <svg className="w-10 h-10 text-primary/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          </svg>
          <span className="text-sm font-medium text-foreground">
            {scanning ? 'Scanning…' : 'Take photo'}
          </span>
            <span className="text-xs text-muted-foreground">Use your camera or choose an existing image</span>
          </button>
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,image/heic,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.heic"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Take photo of receipt with camera"
        />
      </div>

      {scanning && (
        <div className="space-y-1.5 pt-2" role="status" aria-live="polite" aria-label="Receipt scan in progress">
          <Progress value={scanProgress} className="h-2.5 w-full" />
          <p className="text-xs text-muted-foreground">Scanning receipt… {scanProgress}%</p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="pt-4 border-t border-border">
        <h4 className="text-sm font-medium text-foreground mb-2">Recent scans</h4>
        {scans.length === 0 ? (
          <p className="text-xs text-muted-foreground">No receipts scanned yet. Upload an image above.</p>
        ) : (
          <ul className="space-y-3">
            {scans.map((scan) => (
              <ScanCard
                key={scan.id}
                scan={scan}
                hasEnvelopes={hasEnvelopes}
                envelopes={state.envelopes}
                onUpdate={(updates) => updateScan(scan.id, updates)}
                onSave={handleSaveReceipt}
                onRemoveScan={handleRemoveScan}
                onAddEnvelope={(name, limit) => {
                  const env = api.addEnvelope(name, limit);
                  return { id: env.id, name: env.name };
                }}
                glossary={glossary}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export const ReceiptScannerContent = memo(ReceiptScannerContentInner);
