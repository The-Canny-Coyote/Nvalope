import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useBudget } from '@/app/store/BudgetContext';
import { useAppStore } from '@/app/store/appStore';
import Tesseract from 'tesseract.js';
import { AppDataIdbError, getAppData, setAppData } from '@/app/services/appDataIdb';
import { parseReceiptText, validateReceiptTransaction } from '@/app/services/receiptParser';
import { suggestCategory } from '@/app/services/receiptCategorization';
import { preprocessReceiptImage } from '@/app/utils/receiptPreprocess';
import { delayedToast } from '@/app/services/delayedToast';
import { toast } from 'sonner';
import { parseYYYYMMDD } from '@/app/utils/date';
import { compressReceiptImageDataUrl } from '@/app/utils/receiptImageCompress';
import type { StoredReceiptScan, ReceiptArchiveItem } from '@/app/services/appDataIdb';
import { allocateTotalProportionally } from '@/app/services/receiptAllocation';
import { generateId, roundTo2, type ReceiptScanResult } from '@/app/components/ScanCard';

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

export function useReceiptScanner() {
  const { state, api } = useBudget();
  const receiptCategoryPreferRegex = useAppStore((s) => s.receiptCategoryPreferRegex);
  const webLLMEnabled = useAppStore((s) => s.webLLMEnabled);
  const [scans, setScans] = useState<ReceiptScanResult[]>([]);
  const scansRef = useRef<ReceiptScanResult[]>(scans);
  scansRef.current = scans;
  const savingScanIdRef = useRef<string | null>(null);
  const [savingScanId, setSavingScanId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
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
        const suggestion = await suggestCategory(text.slice(0, 2000), state.envelopes, {
          preferRegex: receiptCategoryPreferRegex,
          webLLMEnabled,
        });
        suggestedEnvelopeId = suggestion.envelopeId;
      } catch {
        suggestedEnvelopeId = undefined;
      }
      const lineItemsWithSuggestion =
        parsed.lineItems.length > 0
          ? parsed.lineItems.map((item) => ({
              ...item,
              envelopeId: item.envelopeId ?? suggestedEnvelopeId,
              excludeFromBudget: item.excludeFromBudget ?? item.isTax === true,
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

  const handleRemoveScan = useCallback(async (id: string) => {
    const prev = scansRef.current;
    const next = prev.filter((s) => s.id !== id);
    setScans(next);
    try {
      const data = await getAppData();
      await setAppData({ ...data, receiptScans: next });
    } catch {
      setScans(prev);
      delayedToast.error(
        'Could not update your saved receipts. Try again. If it keeps failing, free browser storage or remove older receipts from Receipt Archive.'
      );
    }
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
      if (savingScanIdRef.current !== null) return;
      const current = scansRef.current.find((s) => s.id === scan.id);
      const scanToUse = current ?? scan;
      savingScanIdRef.current = scanToUse.id;
      setSavingScanId(scanToUse.id);
      try {
        const lineItems = scanToUse.lineItems ?? [];
        const hasEnvelopes = state.envelopes.length > 0;
        // Use scanned receipt date when valid (YYYY-MM-DD), otherwise today.
        const rawDate = typeof scanToUse.date === 'string' ? scanToUse.date.trim() : '';
        const txDate = rawDate.length === 10 && parseYYYYMMDD(rawDate) ? rawDate : todayISO();
        const batch: { amount: number; envelopeId?: string; description: string; date: string }[] = [];
        const budgetable = lineItems.filter((li) => li.isTax !== true && li.excludeFromBudget !== true && li.amount > 0 && Number.isFinite(li.amount));
        const totalToAllocate = roundTo2(scanToUse.amountPaid ?? scanToUse.amount ?? (scanToUse.subtotal != null && scanToUse.tax != null ? scanToUse.subtotal + scanToUse.tax : 0));
        const allocated = allocateTotalProportionally({ items: budgetable, totalToAllocate });
        for (let idx = 0; idx < budgetable.length; idx++) {
          const item = budgetable[idx];
          const description = (item.description && typeof item.description === 'string' ? item.description : '').trim() || (scanToUse.description && typeof scanToUse.description === 'string' ? scanToUse.description : '').trim() || 'Receipt item';
          const validation = validateReceiptTransaction({
            amount: roundTo2(allocated[idx]),
            description,
            date: txDate,
          });
          if (!validation.valid) continue;
          const envelopeId = hasEnvelopes ? (item.envelopeId || undefined) : undefined;
          if (hasEnvelopes && !envelopeId) continue; // skip lines without category when envelopes exist
          batch.push({
            amount: roundTo2(allocated[idx]),
            envelopeId,
            description,
            date: txDate,
          });
        }
        let anyAdded = false;
        let anyUncategorized = false;
        let createdTransactions: Array<{ id: string }> = [];
        if (batch.length > 0) {
          try {
            createdTransactions = api.addTransactions(batch);
            anyAdded = true;
            anyUncategorized = batch.some((p) => !p.envelopeId);
          } catch {
            delayedToast.error('Could not add line items to budget. Check that amounts and date are valid.');
          }
        }

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

        const nextScansForPersist = scansRef.current.map((s) =>
          s.id === scanToUse.id ? { ...s, addedToEnvelope: anyAdded, imageDataUrl: undefined } : s
        );

        const data = await getAppData();
        const updates: Partial<typeof data> = {
          receiptScans: nextScansForPersist,
          receiptArchives: [archiveItem, ...(data.receiptArchives ?? [])],
        };
        if (Object.keys(newAlias).length > 0) {
          updates.receiptMerchantAliases = { ...(data.receiptMerchantAliases ?? {}), ...newAlias };
        }
        if (Object.keys(newGlossary).length > 0) {
          updates.receiptGlossary = { ...(data.receiptGlossary ?? {}), ...newGlossary };
        }
        try {
          await setAppData({ ...data, ...updates });
        } catch (err) {
          if (createdTransactions.length > 0) {
            // Roll back budget writes if receipt persistence fails, so retries do not duplicate charges.
            for (const tx of createdTransactions) {
              try {
                api.deleteTransaction(tx.id);
              } catch {
                // ignore rollback failures; show persistence error below
              }
            }
          }
          if (err instanceof AppDataIdbError && err.code === 'IDB_QUOTA_EXCEEDED') {
            delayedToast.error(
              'Not enough storage to save this receipt. Remove older entries in Receipt Archive or free space in your browser, then try again.'
            );
          } else {
            delayedToast.error('Could not save receipt. Please try again.');
          }
          return;
        }

        setScans(nextScansForPersist);

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
      } finally {
        savingScanIdRef.current = null;
        setSavingScanId(null);
      }
    },
    [api, state.envelopes.length]
  );

  const loadGlossaryFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target;
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const raw = JSON.parse(reader.result as string);
          if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            input.value = '';
            return;
          }
          const next: Record<string, string> = { ...glossary };
          for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            if (typeof k === 'string' && typeof v === 'string') next[k] = v;
          }
          setGlossary(next);
          try {
            const data = await getAppData();
            await setAppData({ ...data, receiptGlossary: next });
          } catch {
            delayedToast.error('Could not save glossary. Try again.');
          }
        } catch {
          // invalid JSON
        }
        input.value = '';
      })();
    };
    reader.readAsText(file);
  };

  return {
    scans,
    scanning,
    scanProgress,
    error,
    glossary,
    savingScanId,
    fileInputRef,
    cameraInputRef,
    handleFileChange,
    handleRemoveScan,
    handleSaveReceipt,
    loadGlossaryFile,
    updateScan,
  };
}
