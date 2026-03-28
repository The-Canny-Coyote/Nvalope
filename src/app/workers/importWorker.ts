/// <reference lib="webworker" />

import * as pdfjs from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ImportWorkerInboundMessage, ImportWorkerOutboundMessage } from './importWorkerProtocol';
import { parseStatementFile } from '@/app/services/statementImport/parsers';
import { parseLooseBankTextToRows } from '@/app/services/statementImport/looseBankTextFromPdf';
import { extractPageTextWithLineBreaks } from '@/app/services/statementImport/pdfPageText';
import type { ParsedStatementFile, StatementImportDiagnostic } from '@/app/services/statementImport/types';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const MIN_CHARS_PER_PAGE_FOR_TEXT = 50;
const MAX_PDF_PAGES = 40;
const MAX_OCR_PAGES = MAX_PDF_PAGES;

function post(msg: ImportWorkerOutboundMessage) {
  self.postMessage(msg);
}

function decodeBufferToText(buffer: ArrayBuffer): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

async function ocrPdfPageRangeWorker(
  pdf: pdfjs.PDFDocumentProxy,
  fromPage: number,
  toPage: number
): Promise<string> {
  const TesseractMod = await import('tesseract.js');
  const Tesseract = TesseractMod.default ?? TesseractMod;
  Tesseract.setLogging(false);
  const worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
    logger: (m: { progress?: number; status?: string }) => {
      if (typeof m.progress === 'number' && m.status) {
        const pct = Math.round(40 + m.progress * 50);
        post({ type: 'PARSE_PROGRESS', payload: { pct, stage: m.status } });
      }
    },
  });
  let out = '';
  try {
    for (let p = fromPage; p <= toPage; p += 1) {
      post({ type: 'PARSE_PROGRESS', payload: { pct: 35 + Math.round((p / toPage) * 40), stage: `OCR page ${p}` } });
      const page = await pdf.getPage(p);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      const w = Math.floor(viewport.width);
      const h = Math.floor(viewport.height);
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
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

async function parsePdfInWorker(fileName: string, data: ArrayBuffer): Promise<ParsedStatementFile> {
  const diagnostics: StatementImportDiagnostic[] = [];
  post({ type: 'PARSE_PROGRESS', payload: { pct: 5, stage: 'Loading PDF' } });
  try {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true });
    const pdf = await loadingTask.promise;
    const numPages = Math.min(pdf.numPages, MAX_PDF_PAGES);
    if (numPages === 0) {
      diagnostics.push({ severity: 'error', message: 'This PDF has no pages to read.' });
      return { format: 'pdf', rows: [], diagnostics };
    }

    let fullText = '';
    for (let p = 1; p <= numPages; p += 1) {
      post({ type: 'PARSE_PROGRESS', payload: { pct: 5 + Math.round((p / numPages) * 25), stage: `Reading text page ${p}` } });
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
        const ocrText = await ocrPdfPageRangeWorker(pdf, 1, ocrEnd);
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

    post({ type: 'PARSE_PROGRESS', payload: { pct: 92, stage: 'Parsing rows' } });
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

    return { format: 'pdf', rows, diagnostics };
  } catch {
    diagnostics.push({
      severity: 'error',
      message: 'Could not read this PDF. It may be encrypted, damaged, or not a supported PDF.',
    });
    return { format: 'pdf', rows: [], diagnostics };
  }
}

self.onmessage = async (event: MessageEvent<ImportWorkerInboundMessage>) => {
  const msg = event.data;
  if (msg.type !== 'PARSE_FILE') return;
  const { fileBuffer, format, fileName, csvMapping } = msg.payload;
  try {
    post({ type: 'PARSE_PROGRESS', payload: { pct: 1, stage: 'Starting' } });
    let parsed: ParsedStatementFile;
    if (format === 'pdf') {
      parsed = await parsePdfInWorker(fileName, fileBuffer);
    } else {
      const text = decodeBufferToText(fileBuffer);
      post({ type: 'PARSE_PROGRESS', payload: { pct: 50, stage: 'Parsing file' } });
      parsed = parseStatementFile(fileName, text, csvMapping);
      post({ type: 'PARSE_PROGRESS', payload: { pct: 90, stage: 'Done' } });
    }
    post({ type: 'PARSE_PROGRESS', payload: { pct: 100, stage: 'Complete' } });
    post({ type: 'PARSE_RESULT', payload: { parsed } });
  } catch {
    post({ type: 'PARSE_ERROR', payload: { message: 'Statement parse failed in worker.' } });
  }
};
