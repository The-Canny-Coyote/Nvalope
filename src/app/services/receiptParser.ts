export interface ReceiptLineItem {
  description: string;
  amount: number;
  /** Parsed from leading "2 x" / "2×" in the line when present. */
  quantity?: number;
  /** User-selected envelope (category) for this line; when set, Save creates a transaction for this item. */
  envelopeId?: string;
  /** When true, this line is excluded from creating budget transactions. */
  excludeFromBudget?: boolean;
  /** When glossary is applied: raw OCR text before lookup; used for learning from user edits. */
  rawDescription?: string;
  /** When true, this line is tax; its amount fills the Tax box and is excluded from subtotal. */
  isTax?: boolean;
}

export interface ParsedReceipt {
  amount: number | null;
  merchant: string;
  lineItems: ReceiptLineItem[];
  /** ISO date (YYYY-MM-DD) when detected from receipt. */
  date?: string;
  /** Time string when detected (e.g. "10:30 AM" or "14:25"). */
  time?: string;
  /** Currency code or symbol; default USD when none found. */
  currency?: string;
  /** Subtotal when labeled on receipt. */
  subtotal?: number;
  /** Tax amount when labeled (TAX, GST, VAT). */
  tax?: number;
  /** Explicit total (signed); same as amount but present when amount is set. */
  total?: number;
  /** Change due (refund amount) when refund/return detected. */
  change?: number;
  /** True when REFUND/CHANGE DUE/CREDIT/RETURN detected or total is negative. */
  isRefund?: boolean;
}

export interface ParseReceiptOptions {
  /** Map OCR item text to display name (exact key match). */
  glossary?: Record<string, string>;
}

const HEADER_STARTS = /^(RECEIPT|INVOICE|DATE|TIME|TOTAL|SUBTOTAL|TAX|AMOUNT|BALANCE|DUE|QTY|PRICE|ITEM|FROM|TO|ST#|OP#|TE#|TR#|CARD|VISA|MC|DEBIT|CREDIT|CHANGE|CASH|COUPON|DISCOUNT|REFUND|THANK|YOU|WELCOME|PURCHASE|PAID|TENDER)/i;
/** Payment/total lines to exclude from line items (e.g. "46.30 TOTAL PURCHASE" or OCR "107AL PURCHASE") */
const PAYMENT_TOTAL_LINE = /\d+\.?\d*\s+TOTAL\s+PURCHASE|TOTAL\s+PURCHASE\s+\d|^\s*[\d,.]+\s*TOTAL\s|\d*AL\s+PURCHASE/i;
/** Total with label: supports US and European amounts. */
const TOTAL_LABELS = /\b(TOTAL|TOTAL\s+PURCHASE|AMOUNT\s+DUE|BALANCE\s+DUE|GRAND\s+TOTAL|TOTAL\s+DUE|AMOUNT\s+PAID|TOTAL\s+SALE|CASH\s+TOTAL|CREDIT\s+TOTAL|TOTAL\s+AMOUNT|PAYMENT\s+TOTAL|BAL\.?\s*DUE|DUE\s+TODAY|FINAL\s+TOTAL)(?:\s*[:.]*)\s*\$?\s*([\d,.]+\d)\b/gi;
/** Any dollar amount at end of line (strict 2 decimals) for fallback */
const ANY_DOLLAR_STRICT = /\$?\s*([\d,]+\.\d{2})\s*$/gm;
/** Any dollar amount (flexible: 46.30, 46.3, 46) for fallback when no TOTAL label */
const ANY_DOLLAR_FLEX = /\$?\s*([\d,]+\.?\d{0,2})\s*$/gm;
/** Price at end of line (1 or 2 decimals: 3.9 or 3.99) */
const PRICE_AT_END = /\$?\s*([\d,]+\.\d{1,2})\s*[A-Za-z]?\s*$/;
/** Price at start of line (e.g. "3.99  MILK 2%") */
const PRICE_AT_START = /^\s*\$?\s*([\d,]+\.\d{1,2})\s+(.+)$/;

/** Date: MM/DD/YY, MM-DD-YYYY, DD.MM.YY, YYYY-MM-DD */
const DATE_REGEX = /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})|(\d{4}[/\-.]\d{2}[/\-.]\d{2})/gi;
/** Time: 10:30 AM, 14:25, 10.30 */
const TIME_REGEX = /(\d{1,2}:\d{2}\s*[AP]M?)|(\d{1,2}[.:]\d{2})/gi;
/** Currency symbol or code */
const CURRENCY_REGEX = /\$|€|£|¥|\bUSD\b|\bEUR\b|\bGBP\b|\bJPY\b/i;
/** Subtotal label + amount */
const SUBTOTAL_LABELS = /\b(SUBTOTAL|SUB\s*TOTAL)\s*[:.]*\s*\$?\s*([\d,.\s]+)/gi;
/** Tax label + amount */
const TAX_LABELS = /\b(TAX|GST|VAT|HST|PST|QST|SALES\s+TAX|STATE\s+TAX|LOCAL\s+TAX)\s*[:.]*\s*\$?\s*([\d,. ]+?)(?=\s*(?:$|[^\d,.\s]))/gi;
/** Refund/return keywords (excluding REF # reference numbers) */
const REFUND_KEYWORDS = /\b(REFUND|CREDIT|RETURN)\b/i;
/** CHANGE DUE with amount; only treat as refund when amount > 0 */
const CHANGE_DUE_WITH_AMOUNT = /\bCHANGE\s+DUE\s*[:.]?\s*\$?\s*([\d,.\s]+)/gi;
/** Leading quantity: "2 x ", "3× " */
const QTY_PREFIX = /^(\d+(?:\.\d+)?)\s*[x×X]\s+/;

/** Parse number from string; supports US (1,234.56) and European (12,99 or 1.234,56) formats. */
function toNum(s: string): number {
  const t = s.trim();
  if (/,(\d{1,2})$/.test(t)) {
    const eu = t.replace(/\./g, '').replace(/,(\d{1,2})$/, '.$1');
    const n = parseFloat(eu);
    return Number.isNaN(n) ? 0 : n;
  }
  const noComma = t.replace(/,/g, '');
  if (/^\d+\s+\d{2}$/.test(noComma)) {
    const n = parseFloat(noComma.replace(/\s+/, '.'));
    return Number.isNaN(n) ? 0 : n;
  }
  const n = parseFloat(noComma.replace(/\s/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

function isValidAmount(n: number): boolean {
  return n > 0 && n < 1_000_000 && Number.isFinite(n);
}

/** For totals: allow negative (refunds). */
function isValidTotal(n: number): boolean {
  return n !== 0 && Math.abs(n) < 1_000_000 && Number.isFinite(n);
}

/** Normalize OCR output: collapse runs of spaces/newlines, trim lines, fix full-width digits. */
function normalizeReceiptText(raw: string): string {
  const fullWidthDigits = ['０', '１', '２', '３', '４', '５', '６', '７', '８', '９'];
  let out = raw;
  fullWidthDigits.forEach((c, i) => {
    out = out.split(c).join(String(i));
  });
  return out
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n +/g, '\n')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeDesc(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s+\.\s+(?=\d)/g, '.')
    .replace(/^\s*[-*#.]+\s*|\s*[-*#.]+\s*$/g, '')
    .replace(/^\d+\s*[xX]\s*/i, '')
    .replace(/\s+\d{10,14}\s*[A-Za-z]?\s*$/, '')
    .trim()
    .slice(0, 80);
}

/** Line that is only a price (total often on its own line at end). */
const STANDALONE_PRICE = /^\s*\$?\s*([\d,]+\.?\d{0,2}|[\d.]+,\d{1,2})\s*$/;

/** Extract total: labeled total, then last dollar amount, then last line if it's only a price. Uses isValidTotal so negative is allowed. */
function extractTotal(text: string): number | null {
  const totalLabelMatches = [...text.matchAll(TOTAL_LABELS)];
  if (totalLabelMatches.length > 0) {
    const last = totalLabelMatches[totalLabelMatches.length - 1];
    const n = toNum(last[2]);
    if (isValidTotal(n)) return Math.round(n * 100) / 100;
  }
  const strictDollars = [...text.matchAll(ANY_DOLLAR_STRICT)];
  if (strictDollars.length > 0) {
    const last = strictDollars[strictDollars.length - 1];
    const n = toNum(last[1]);
    if (isValidTotal(n)) return Math.round(n * 100) / 100;
  }
  const flexDollars = [...text.matchAll(ANY_DOLLAR_FLEX)];
  if (flexDollars.length > 0) {
    const last = flexDollars[flexDollars.length - 1];
    const n = toNum(last[1]);
    if (isValidTotal(n)) return Math.round(n * 100) / 100;
  }
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
    const m = lines[i].match(STANDALONE_PRICE);
    if (m) {
      const n = toNum(m[1]);
      if (isValidTotal(n)) return Math.round(n * 100) / 100;
    }
  }
  return null;
}

function extractDate(text: string): string | undefined {
  const m = text.match(DATE_REGEX);
  if (!m?.[0]) return undefined;
  const raw = m[0];
  const parts = raw.split(/[/\-.]/);
  if (parts.length !== 3) return undefined;
  let y: number, mon: number, d: number;
  if (parts[0].length === 4) {
    y = parseInt(parts[0], 10);
    mon = parseInt(parts[1], 10);
    d = parseInt(parts[2], 10);
  } else {
    mon = parseInt(parts[0], 10);
    d = parseInt(parts[1], 10);
    const yy = parseInt(parts[2], 10);
    y = yy < 100 ? (yy >= 50 ? 1900 + yy : 2000 + yy) : yy;
  }
  if (Number.isNaN(y) || Number.isNaN(mon) || Number.isNaN(d)) return undefined;
  if (mon < 1 || mon > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function extractTime(text: string): string | undefined {
  const m = text.match(TIME_REGEX);
  return m?.[0]?.trim();
}

function extractCurrency(text: string): string {
  const m = text.match(CURRENCY_REGEX);
  if (!m?.[0]) return 'USD';
  const s = m[0].toUpperCase();
  if (s === '€') return 'EUR';
  if (s === '£') return 'GBP';
  if (s === '¥') return 'JPY';
  if (s === 'USD' || s === 'EUR' || s === 'GBP' || s === 'JPY') return s;
  return 'USD';
}

function extractSubtotal(text: string): number | undefined {
  const matches = [...text.matchAll(SUBTOTAL_LABELS)];
  if (matches.length === 0) return undefined;
  const n = toNum(matches[matches.length - 1][2]);
  return isValidAmount(n) ? Math.round(n * 100) / 100 : undefined;
}

function extractTax(text: string): number | undefined {
  const matches = [...text.matchAll(TAX_LABELS)];
  if (matches.length === 0) return undefined;
  const raw = (matches[matches.length - 1][2] ?? '').trim();
  const n = toNum(raw);
  return isValidAmount(n) ? Math.round(n * 100) / 100 : undefined;
}

function detectRefund(text: string, total: number | null): { isRefund: boolean; change?: number } {
  const changeDueMatches = [...text.matchAll(CHANGE_DUE_WITH_AMOUNT)];
  const changeDueAmount = changeDueMatches.length > 0 ? toNum(changeDueMatches[changeDueMatches.length - 1][1]) : null;
  if (changeDueAmount != null && changeDueAmount > 0) {
    return { isRefund: true, change: changeDueAmount };
  }
  if (REFUND_KEYWORDS.test(text) || (total != null && total < 0)) {
    return { isRefund: true, change: total != null ? Math.abs(total) : undefined };
  }
  return { isRefund: false };
}

function looksLikeDateOrTime(line: string): boolean {
  const t = line.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t)) return true;
  if (/^\d{1,2}:\d{2}(\s*[AP]M)?$/i.test(t)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return true;
  if (/^[\d\s$.,:]+$/.test(t) && (line.match(/\d/g) || []).length >= 4) return true;
  return false;
}

/** Merchant: first non-header line in top section that looks like a store name. */
function extractMerchant(lines: string[]): string {
  const maxScan = Math.min(10, lines.length);
  for (let i = 0; i < maxScan; i++) {
    const line = lines[i].trim().replace(/\s+/g, ' ');
    if (line.length < 2 || line.length > 60) continue;
    if (HEADER_STARTS.test(line)) continue;
    if (/^[\d\s$.,]+$/.test(line)) continue;
    const letters = (line.match(/[A-Za-z]/g) || []).length;
    const digits = (line.match(/\d/g) || []).length;
    if (letters >= 2 && letters >= digits) return line;
  }
  const first = lines[0]?.trim().slice(0, 80) || '';
  if (!first || looksLikeDateOrTime(first)) return 'Receipt';
  return first;
}

function isHeaderLine(line: string): boolean {
  if (line.length < 2 || line.length > 120) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line)) return true;
  if (/^\$?\s*[\d,]+\.\d{2}\s*$/.test(line)) return true;
  if (PAYMENT_TOTAL_LINE.test(line)) return true;
  if (HEADER_STARTS.test(line)) {
    const hasPrice = PRICE_AT_END.test(line) || LAST_PRICE_TOKEN.test(line);
    // Treat TAX/GST/VAT/etc. lines with amounts as line items so the UI can show and adjust them.
    if (hasPrice && /^\s*(tax|gst|vat|hst|pst|qst|sales\s+tax|state\s+tax|local\s+tax)\b/i.test(line)) return false;
    if (hasPrice && line.replace(/\s*[\d,.]+\s*$/g, '').trim().length >= 4) return false;
    return true;
  }
  return false;
}

/** Match last token that looks like a price (1 or 2 decimals) */
const LAST_PRICE_TOKEN = /\s+([\d,]+\.\d{1,2})\s*$/;

/** Extract leading quantity from description and return { qty, rest }. */
function stripQuantity(desc: string): { quantity?: number; rest: string } {
  const match = desc.match(QTY_PREFIX);
  if (!match) return { rest: desc };
  const qty = parseFloat(match[1]);
  if (Number.isNaN(qty) || qty < 0.01) return { rest: desc };
  return { quantity: Math.round(qty) === qty ? Math.round(qty) : qty, rest: desc.slice(match[0].length).trim() };
}

/** One line item: description + amount (+ optional quantity). Tries price-at-end, price-at-start, then last price-like token. */
function parseLine(line: string): ReceiptLineItem | null {
  if (isHeaderLine(line)) return null;
  const normalized = line.replace(/\s+\.\s+(?=\d)/g, '.');

  const allowDesc = (desc: string) =>
    desc.length >= 2 &&
    !/^\d+$/.test(desc) &&
    (!HEADER_STARTS.test(desc) || desc.length > 6 || /^(tax|gst|vat|hst|pst|qst|sales tax|state tax|local tax)$/i.test(desc.trim()));

  const atEnd = normalized.match(PRICE_AT_END);
  if (atEnd && atEnd.index != null) {
    const amount = toNum(atEnd[1]);
    if (!isValidAmount(amount)) return null;
    const rawDesc = normalized.slice(0, atEnd.index).trim();
    const { quantity, rest } = stripQuantity(rawDesc);
    const desc = normalizeDesc(rest);
    if (allowDesc(desc)) {
      const item: ReceiptLineItem = { description: desc, amount: Math.round(amount * 100) / 100 };
      if (quantity != null) item.quantity = quantity;
      return item;
    }
  }

  const atStart = normalized.match(PRICE_AT_START);
  if (atStart) {
    const amount = toNum(atStart[1]);
    if (!isValidAmount(amount)) return null;
    const { quantity, rest } = stripQuantity(atStart[2].trim());
    const desc = normalizeDesc(rest);
    if (allowDesc(desc)) {
      const item: ReceiptLineItem = { description: desc, amount: Math.round(amount * 100) / 100 };
      if (quantity != null) item.quantity = quantity;
      return item;
    }
  }

  const lastPrice = normalized.match(LAST_PRICE_TOKEN);
  if (lastPrice && lastPrice.index != null) {
    const amount = toNum(lastPrice[1]);
    if (!isValidAmount(amount)) return null;
    const rawDesc = normalized.slice(0, lastPrice.index).trim();
    const { quantity, rest } = stripQuantity(rawDesc);
    const desc = normalizeDesc(rest);
    if (allowDesc(desc)) {
      const item: ReceiptLineItem = { description: desc, amount: Math.round(amount * 100) / 100 };
      if (quantity != null) item.quantity = quantity;
      return item;
    }
  }

  return null;
}

/** Line items: from first line that has a valid item to end; dedupe by desc+amount. */
function extractLineItems(lines: string[]): ReceiptLineItem[] {
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (parseLine(lines[i])) {
      start = i;
      break;
    }
  }
  const seen = new Set<string>();
  const items: ReceiptLineItem[] = [];
  for (let i = start; i < lines.length; i++) {
    const item = parseLine(lines[i]);
    if (!item) continue;
    const key = `${item.description}|${item.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

/**
 * Parse OCR text into total, merchant, and line items.
 * Optional: date, time, currency, subtotal, tax, refund/change, quantity; glossary for item names.
 */
export function parseReceiptText(rawText: string, options?: ParseReceiptOptions): ParsedReceipt {
  const text = normalizeReceiptText(rawText);
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const currency = extractCurrency(text);
  const date = extractDate(text);
  const time = extractTime(text);
  const merchant = extractMerchant(lines);
  let totalAmount = extractTotal(text);
  const { isRefund, change } = detectRefund(text, totalAmount ?? null);

  if (totalAmount != null && isRefund) {
    totalAmount = -Math.abs(totalAmount);
  }

  let subtotal = extractSubtotal(text);
  const tax = extractTax(text);
  if (subtotal != null && totalAmount != null && totalAmount > 0 && subtotal > 100 && subtotal / totalAmount >= 50) {
    subtotal = Math.round((subtotal / 100) * 100) / 100;
  }

  let lineItems = extractLineItems(lines);
  const glossary = options?.glossary;
  if (glossary && Object.keys(glossary).length > 0) {
    lineItems = lineItems.map((item) => {
      const raw = item.description;
      const resolved = glossary[raw] ?? raw;
      return { ...item, rawDescription: raw, description: resolved };
    });
  }

  let resultTax = tax;
  let resultLineItems = lineItems;
  if (resultLineItems.length > 0) {
    const taxLabel = /^(tax|gst|vat|hst|pst|qst|sales tax|state tax|local tax)$/i;
    const taxIdx = resultLineItems.findIndex((item) => taxLabel.test(item.description.trim()));
    if (taxIdx >= 0) {
      resultLineItems = resultLineItems.map((item, i) => (i === taxIdx ? { ...item, isTax: true } : item));
      if (resultTax == null) {
        resultTax = Math.round(resultLineItems[taxIdx].amount * 100) / 100;
      }
    }
  }

  const result: ParsedReceipt = {
    amount: totalAmount,
    merchant,
    lineItems: resultLineItems,
  };
  if (date) result.date = date;
  if (time) result.time = time;
  result.currency = currency;
  if (subtotal != null) result.subtotal = subtotal;
  if (resultTax != null) result.tax = resultTax;
  if (totalAmount != null) result.total = totalAmount;
  if (change != null) result.change = change;
  if (isRefund) result.isRefund = true;
  return result;
}

/** Bounds for validating receipt data before creating a transaction (limits impact of malformed/malicious OCR). */
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_AMOUNT_ABS = 1_000_000;
const MIN_DATE = '2000-01-01';
const YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isDateInRange(dateStr: string): boolean {
  return YYYY_MM_DD_REGEX.test(dateStr) && dateStr >= MIN_DATE && dateStr <= maxDateIso();
}

function maxDateIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 10);
  return d.toISOString().slice(0, 10);
}

export interface ValidateReceiptTransactionResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates parsed receipt values before creating a transaction.
 * Enforces description length, amount range, and date format/range to limit impact of malformed or malicious OCR.
 */
export function validateReceiptTransaction(params: {
  amount: number;
  description: string;
  date: string;
}): ValidateReceiptTransactionResult {
  if (typeof params.description !== 'string' || params.description.length > MAX_DESCRIPTION_LENGTH) {
    return { valid: false, error: 'Description is too long. Shorten it and try again.' };
  }
  if (!Number.isFinite(params.amount)) {
    return { valid: false, error: 'Please enter a valid amount.' };
  }
  if (Math.abs(params.amount) > MAX_AMOUNT_ABS) {
    return { valid: false, error: 'Amount is too large. Please enter a smaller amount.' };
  }
  if (typeof params.date !== 'string' || !isDateInRange(params.date)) {
    return { valid: false, error: 'Please enter a valid date.' };
  }
  return { valid: true };
}
