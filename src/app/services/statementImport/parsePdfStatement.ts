import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Tesseract from 'tesseract.js';
import type { ParsedStatementFile, StatementImportDiagnostic } from './types';
import { parseLooseBankTextToRows } from './looseBankTextFromPdf';
import { extractPageTextWithLineBreaks } from './pdfPageText';

const MIN_CHARS_PER_PAGE_FOR_TEXT = 50;
/** Cap pages read (text + OCR) so very large PDFs stay responsive. */
const MAX_PDF_PAGES = 40;
/** When OCR runs, process the same page range as text (not only the first few pages). */
const MAX_OCR_PAGES = MAX_PDF_PAGES;

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

async function ocrPdfPageRange(
  pdf: pdfjs.PDFDocumentProxy,
  fromPage: number,
  toPage: number,
  onProgress?: (pct: number, stage: string) => void
): Promise<string> {
  let out = '';
  Tesseract.setLogging(false);
  const worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
    logger: (m: { progress?: number; status?: string }) => {
      if (onProgress && typeof m.progress === 'number' && m.status) {
        onProgress(Math.round(m.progress * 100), m.status);
      }
    },
  });
  try {
    for (let p = fromPage; p <= toPage; p += 1) {
      onProgress?.(Math.round(((p - fromPage) / Math.max(1, toPage - fromPage + 1)) * 100), `OCR page ${p}`);
      const page = await pdf.getPage(p);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const {
        data: { text },
      } = await worker.recognize(canvas);
      out += `${text}\n`;
    }
  } finally {
    await worker.terminate();
  }
  return out;
}

/**
 * Parse a bank statement PDF on-device: extract text, optionally OCR, then heuristic row detection.
 * Prefer `runStatementParseInWorker` from `importWorkerClient` so the UI thread stays responsive.
 */
export async function parsePdfStatement(
  fileName: string,
  data: ArrayBuffer,
  onProgress?: (pct: number, stage: string) => void
): Promise<ParsedStatementFile> {
  const diagnostics: StatementImportDiagnostic[] = [];
  try {
    onProgress?.(5, 'Loading PDF');
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true });
    const pdf = await loadingTask.promise;
    const numPages = Math.min(pdf.numPages, MAX_PDF_PAGES);
    if (numPages === 0) {
      diagnostics.push({ severity: 'error', message: 'This PDF has no pages to read.' });
      return { format: 'pdf', rows: [], diagnostics };
    }

    let fullText = '';
    for (let p = 1; p <= numPages; p += 1) {
      onProgress?.(5 + Math.round((p / numPages) * 30), `Reading text page ${p}`);
      const page = await pdf.getPage(p);
      fullText += await extractPageTextWithLineBreaks(page);
      fullText += '\n';
    }

    const avgPerPage = fullText.length / numPages;
    if (avgPerPage < MIN_CHARS_PER_PAGE_FOR_TEXT) {
      const ocrEnd = Math.min(numPages, MAX_OCR_PAGES);
      diagnostics.push({
        severity: 'info',
        message: `This PDF has little selectable text per page. Running on-device OCR on pages 1–${ocrEnd} (may take a few minutes on long statements).`,
      });
      try {
        const ocrText = await ocrPdfPageRange(pdf, 1, ocrEnd, onProgress);
        if (ocrText.trim().length > fullText.trim().length) {
          fullText = ocrText;
        } else if (ocrText.trim().length > 0 && fullText.trim().length < MIN_CHARS_PER_PAGE_FOR_TEXT * numPages) {
          fullText = ocrText;
        }
      } catch {
        diagnostics.push({
          severity: 'warning',
          message: 'OCR could not run on this PDF. Try a text-based export or CSV from your bank.',
        });
      }
    }

    onProgress?.(90, 'Parsing rows');
    const rows = parseLooseBankTextToRows(fileName, fullText);
    if (rows.length === 0) {
      diagnostics.push({
        severity: 'warning',
        message:
          'No transaction lines could be inferred from this PDF. Bank layouts vary; CSV or OFX exports are most reliable. If this is a scan, ensure dates and amounts are visible.',
      });
    } else if (numPages > 1) {
      diagnostics.push({
        severity: 'info',
        message: `Read ${numPages} page(s). Summary lines (balances, totals, page headers) are filtered when detected; some valid rows may still be missed on unusual layouts.`,
      });
    }

    onProgress?.(100, 'Complete');
    return { format: 'pdf', rows, diagnostics };
  } catch {
    diagnostics.push({
      severity: 'error',
      message: 'Could not read this PDF. It may be encrypted, damaged, or not a supported PDF.',
    });
    return { format: 'pdf', rows: [], diagnostics };
  }
}
