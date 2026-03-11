/**
 * App-created data in IndexedDB: assistant chat history, insights, preferences.
 * Used for backup and restore; all data stays on-device.
 * Uses shared openDB from budgetIdb (same DB, two stores).
 */

import { openDB, STORE_APP_DATA } from './budgetIdb';

const APP_DATA_KEY = 'state';

/** Calendar view state for session continuity (current month and selected day). */
export interface CalendarViewState {
  currentDate: string; // YYYY-MM-DD
  selectedDate: string | null;
}

/** Budget period mode: single source of truth for envelope tracking. Set in Envelopes tab. */
export type BudgetPeriodMode = 'monthly' | 'biweekly' | 'weekly';

/** When user switches from biweekly to monthly and chooses "monthly from now on", we store this date (YYYY-MM-DD). Dates before this use biweekly when viewing past. */
export type BudgetPeriodModeSwitchDate = string | null;

/** Stored receipt scan (persisted in app data). Matches ReceiptScanResult from ReceiptScannerContent. */
export interface StoredReceiptScan {
  id: string;
  amount: number | null;
  description: string;
  rawText: string;
  date: string;
  lineItems?: Array<{ description: string; amount: number; quantity?: number; envelopeId?: string; isTax?: boolean }>;
  addedToEnvelope?: boolean;
  time?: string;
  currency?: string;
  subtotal?: number;
  tax?: number;
  change?: number;
  isRefund?: boolean;
  /** Derived at parse: tax / subtotal; used to recalculate tax when line items change. */
  taxRate?: number;
  /** Amount the user actually paid (e.g. cash, or total after tip). */
  amountPaid?: number | null;
}

/** Saved receipt in Archive: scan data + optional compressed image (stored as data URL to save space until viewed). */
export interface ReceiptArchiveItem {
  id: string;
  /** Scan data (same shape as StoredReceiptScan). */
  scan: StoredReceiptScan;
  /** Compressed image as data URL (jpeg, reduced size). Omitted when user deletes image but keeps data. */
  imageData?: string;
  savedAt: string; // ISO date
}

export interface AppData {
  /** Assistant chat messages (user + assistant) for backup and restore */
  assistantMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Receipt line item name lookup: abbreviated text → display name (e.g. "GV PNT BUTTR" → "Great Value Peanut Butter") */
  receiptGlossary?: Record<string, string>;
  /** Receipt merchant name corrections: OCR text → user-preferred name (e.g. "Walmart >;" → "Walmart"). Learned on save. */
  receiptMerchantAliases?: Record<string, string>;
  /** Calendar: current month and selected day (persisted for session continuity). */
  calendarViewState?: CalendarViewState;
  /** Budget period: monthly, biweekly, or weekly. Set in Envelopes tab. Drives envelope spent/remaining and analytics. */
  budgetPeriodMode?: BudgetPeriodMode;
  /** When switching biweekly/weekly→monthly and user chose "monthly from now on", dates before this (YYYY-MM-DD) still use previous mode when viewing past. */
  budgetPeriodModeSwitchDate?: BudgetPeriodModeSwitchDate;
  /** Biweekly only: first day of period 1 (1–31). Default 1. */
  biweeklyPeriod1StartDay?: number;
  /** Biweekly only: last day of period 1 (1–31). Period 2 starts the next day. Default 14. */
  biweeklyPeriod1EndDay?: number;
  /** Weekly only: 0 = Sunday, 1 = Monday. Default 0. */
  weekStartDay?: number;
  /** Receipt scanner: recent scans so they survive refresh. */
  receiptScans?: StoredReceiptScan[];
  /** Receipt archive: saved receipts with optional compressed images. */
  receiptArchives?: ReceiptArchiveItem[];
  /** Reserved for future: cached insights, analytics, etc. */
  insights?: unknown;
  [key: string]: unknown;
}

const DEFAULT_APP_DATA: AppData = {
  assistantMessages: [],
};

export type AppDataIdbErrorCode = 'IDB_UNAVAILABLE' | 'IDB_OPEN_FAILED' | 'IDB_READ_FAILED' | 'IDB_WRITE_FAILED' | 'IDB_QUOTA_EXCEEDED';

export class AppDataIdbError extends Error {
  constructor(
    message: string,
    public code: AppDataIdbErrorCode,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'AppDataIdbError';
  }
}

function normalizeAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_APP_DATA };
  const o = raw as Record<string, unknown>;
  const MAX_ASSISTANT_MESSAGES = 500;
  const MAX_MESSAGE_CONTENT_LENGTH = 5000;
  const rawMessages = Array.isArray(o.assistantMessages)
    ? (o.assistantMessages as AppData['assistantMessages']).filter(
        (m) => m && typeof m === 'object' && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
      )
    : [];
  const messages = rawMessages.slice(-MAX_ASSISTANT_MESSAGES).map((m) => ({
    role: m.role,
    content: (m.content as string).length > MAX_MESSAGE_CONTENT_LENGTH
      ? (m.content as string).slice(0, MAX_MESSAGE_CONTENT_LENGTH) + '…'
      : m.content,
  }));
  let receiptGlossary: Record<string, string> | undefined;
  if (o.receiptGlossary && typeof o.receiptGlossary === 'object' && !Array.isArray(o.receiptGlossary)) {
    const gl = o.receiptGlossary as Record<string, unknown>;
    receiptGlossary = {};
    for (const [k, v] of Object.entries(gl)) {
      if (typeof k === 'string' && typeof v === 'string') receiptGlossary[k] = v;
    }
  }
  let receiptMerchantAliases: Record<string, string> | undefined;
  if (o.receiptMerchantAliases && typeof o.receiptMerchantAliases === 'object' && !Array.isArray(o.receiptMerchantAliases)) {
    const ma = o.receiptMerchantAliases as Record<string, unknown>;
    receiptMerchantAliases = {};
    for (const [k, v] of Object.entries(ma)) {
      if (typeof k === 'string' && typeof v === 'string') receiptMerchantAliases[k] = v;
    }
  }
  let calendarViewState: CalendarViewState | undefined;
  if (o.calendarViewState && typeof o.calendarViewState === 'object' && !Array.isArray(o.calendarViewState)) {
    const c = o.calendarViewState as Record<string, unknown>;
    if (typeof c.currentDate === 'string' && (c.selectedDate === null || typeof c.selectedDate === 'string')) {
      calendarViewState = { currentDate: c.currentDate, selectedDate: c.selectedDate as string | null };
    }
  }
  const budgetPeriodMode: BudgetPeriodMode =
    o.budgetPeriodMode === 'weekly' ? 'weekly' : o.budgetPeriodMode === 'biweekly' ? 'biweekly' : 'monthly';
  const budgetPeriodModeSwitchDate: BudgetPeriodModeSwitchDate =
    typeof o.budgetPeriodModeSwitchDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.budgetPeriodModeSwitchDate)
      ? o.budgetPeriodModeSwitchDate
      : null;
  const biweeklyPeriod1StartDay =
    typeof o.biweeklyPeriod1StartDay === 'number' && o.biweeklyPeriod1StartDay >= 1 && o.biweeklyPeriod1StartDay <= 31
      ? o.biweeklyPeriod1StartDay
      : 1;
  const biweeklyPeriod1EndDay =
    typeof o.biweeklyPeriod1EndDay === 'number' && o.biweeklyPeriod1EndDay >= 1 && o.biweeklyPeriod1EndDay <= 31
      ? o.biweeklyPeriod1EndDay
      : 14;
  const weekStartDay =
    typeof o.weekStartDay === 'number' && (o.weekStartDay === 0 || o.weekStartDay === 1) ? o.weekStartDay : 0;

  let receiptScans: StoredReceiptScan[] | undefined;
  if (Array.isArray(o.receiptScans)) {
    receiptScans = [];
    for (const s of o.receiptScans as Record<string, unknown>[]) {
      if (s && typeof s === 'object' && typeof s.id === 'string' && typeof s.description === 'string' && typeof s.rawText === 'string' && typeof s.date === 'string') {
        const item: StoredReceiptScan = {
          id: s.id,
          description: String(s.description),
          rawText: String(s.rawText),
          date: String(s.date),
          amount: typeof s.amount === 'number' ? s.amount : s.amount === null ? null : null,
          lineItems: Array.isArray(s.lineItems) ? (s.lineItems as Array<{ description?: string; amount?: number; quantity?: number; envelopeId?: string; isTax?: boolean }>).map((li) => ({
            description: typeof li?.description === 'string' ? li.description : '',
            amount: typeof li?.amount === 'number' ? li.amount : 0,
            quantity: typeof li?.quantity === 'number' ? li.quantity : undefined,
            envelopeId: typeof li?.envelopeId === 'string' ? li.envelopeId : undefined,
            isTax: li?.isTax === true,
          })).filter((li) => li.description !== '' || li.amount !== 0) : undefined,
          addedToEnvelope: s.addedToEnvelope === true,
          time: typeof s.time === 'string' ? s.time : undefined,
          currency: typeof s.currency === 'string' ? s.currency : undefined,
          subtotal: typeof s.subtotal === 'number' ? s.subtotal : undefined,
          tax: typeof s.tax === 'number' ? s.tax : undefined,
          change: typeof s.change === 'number' ? s.change : undefined,
          isRefund: s.isRefund === true,
          taxRate: typeof s.taxRate === 'number' ? s.taxRate : undefined,
          amountPaid: typeof s.amountPaid === 'number' ? s.amountPaid : s.amountPaid === null ? null : undefined,
        };
        if (item.lineItems?.length === 0) item.lineItems = undefined;
        receiptScans.push(item);
      }
    }
    if (receiptScans.length === 0) receiptScans = undefined;
  }

  let receiptArchives: ReceiptArchiveItem[] | undefined;
  if (Array.isArray(o.receiptArchives)) {
    receiptArchives = [];
    for (const a of o.receiptArchives as Record<string, unknown>[]) {
      if (a && typeof a === 'object' && typeof a.id === 'string' && a.scan && typeof a.scan === 'object' && typeof (a.scan as Record<string, unknown>).id === 'string') {
        const scan = a.scan as Record<string, unknown>;
        const scanItem: StoredReceiptScan = {
          id: String(scan.id),
          description: String(scan.description ?? ''),
          rawText: String(scan.rawText ?? ''),
          date: String(scan.date ?? ''),
          amount: typeof scan.amount === 'number' ? scan.amount : scan.amount === null ? null : null,
          lineItems: Array.isArray(scan.lineItems) ? (scan.lineItems as Array<{ description?: string; amount?: number; quantity?: number; envelopeId?: string; isTax?: boolean }>).map((li) => ({
            description: typeof li?.description === 'string' ? li.description : '',
            amount: typeof li?.amount === 'number' ? li.amount : 0,
            quantity: typeof li?.quantity === 'number' ? li.quantity : undefined,
            envelopeId: typeof li?.envelopeId === 'string' ? li.envelopeId : undefined,
            isTax: li?.isTax === true,
          })).filter((li) => li.description !== '' || li.amount !== 0) : undefined,
          addedToEnvelope: scan.addedToEnvelope === true,
          time: typeof scan.time === 'string' ? scan.time : undefined,
          currency: typeof scan.currency === 'string' ? scan.currency : undefined,
          subtotal: typeof scan.subtotal === 'number' ? scan.subtotal : undefined,
          tax: typeof scan.tax === 'number' ? scan.tax : undefined,
          change: typeof scan.change === 'number' ? scan.change : undefined,
          isRefund: scan.isRefund === true,
          taxRate: typeof scan.taxRate === 'number' ? scan.taxRate : undefined,
          amountPaid: typeof scan.amountPaid === 'number' ? scan.amountPaid : scan.amountPaid === null ? null : undefined,
        };
        if (scanItem.lineItems?.length === 0) scanItem.lineItems = undefined;
        receiptArchives.push({
          id: String(a.id),
          scan: scanItem,
          imageData: typeof a.imageData === 'string' ? a.imageData : undefined,
          savedAt: typeof a.savedAt === 'string' ? a.savedAt : new Date().toISOString(),
        });
      }
    }
    if (receiptArchives.length === 0) receiptArchives = undefined;
  }

  return {
    ...o,
    assistantMessages: messages,
    receiptGlossary,
    receiptMerchantAliases,
    calendarViewState,
    budgetPeriodMode,
    budgetPeriodModeSwitchDate,
    biweeklyPeriod1StartDay,
    biweeklyPeriod1EndDay,
    weekStartDay,
    receiptScans,
    receiptArchives,
    insights: o.insights,
  };
}

/**
 * Get app data from IndexedDB. Returns default if empty or error (never throws for read).
 */
export async function getAppData(): Promise<AppData> {
  try {
    const db = await openDB();
    const raw = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_APP_DATA, 'readonly');
      const req = tx.objectStore(STORE_APP_DATA).get(APP_DATA_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return normalizeAppData(raw);
  } catch {
    return { ...DEFAULT_APP_DATA };
  }
}

let afterWriteCallback: (() => void) | null = null;

/** Set a callback to run after each successful setAppData (e.g. to schedule backup). */
export function setAppDataAfterWriteCallback(cb: (() => void) | null): void {
  afterWriteCallback = cb;
}

/**
 * Save app data to IndexedDB. Throws AppDataIdbError on failure.
 */
export async function setAppData(data: AppData): Promise<void> {
  try {
    const db = await openDB();
    const toSave = normalizeAppData(data);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_APP_DATA, 'readwrite');
      tx.objectStore(STORE_APP_DATA).put(toSave, APP_DATA_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        const err = tx.error;
        const code: AppDataIdbErrorCode = err?.name === 'QuotaExceededError' ? 'IDB_QUOTA_EXCEEDED' : 'IDB_WRITE_FAILED';
        reject(new AppDataIdbError(err?.message ?? 'Failed to write', code, err));
      };
    });
    db.close();
    afterWriteCallback?.();
  } catch (e) {
    if (e instanceof AppDataIdbError) throw e;
    throw new AppDataIdbError(e instanceof Error ? e.message : 'Failed to save app data', 'IDB_WRITE_FAILED', e);
  }
}
