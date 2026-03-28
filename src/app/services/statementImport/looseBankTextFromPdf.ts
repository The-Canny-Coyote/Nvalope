import type { ImportedStatementRow } from './types';
import { parseAmountFlexible, parseDateFlexible } from './parsers';
import { parseYYYYMMDD } from '@/app/utils/date';

const MAX_IMPORT_AMOUNT = 1_000_000_000;

const ISO_DATE = /\b(\d{4}-\d{2}-\d{2})\b/;
const SLASH_DATE = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/;

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** Try month-name dates common in bank PDFs (e.g. Jan 15, 2025). */
function tryParseMonthNameDate(text: string): string | null {
  const mdy = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i
  );
  if (mdy) {
    const mon = MONTH_MAP[mdy[1].toLowerCase().slice(0, 3)];
    const d = Number.parseInt(mdy[2], 10);
    const y = Number.parseInt(mdy[3], 10);
    if (mon && d >= 1 && d <= 31 && y >= 1900) {
      const normalized = `${y.toString().padStart(4, '0')}-${mon.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      return parseYYYYMMDD(normalized) ? normalized : null;
    }
  }
  const dmy = text.match(
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/i
  );
  if (dmy) {
    const d = Number.parseInt(dmy[1], 10);
    const mon = MONTH_MAP[dmy[2].toLowerCase().slice(0, 3)];
    const y = Number.parseInt(dmy[3], 10);
    if (mon && d >= 1 && d <= 31 && y >= 1900) {
      const normalized = `${y.toString().padStart(4, '0')}-${mon.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      return parseYYYYMMDD(normalized) ? normalized : null;
    }
  }
  return null;
}

/** Remove first date from line and return normalized YYYY-MM-DD plus remainder for amount/description. */
function stripFirstDate(line: string): { postedDate: string; rest: string } | null {
  const iso = line.match(ISO_DATE);
  if (iso) {
    const d = parseDateFlexible(iso[1]);
    if (d) return { postedDate: d, rest: line.replace(iso[0], ' ') };
  }
  const slash = line.match(SLASH_DATE);
  if (slash) {
    const d = parseDateFlexible(slash[1]);
    if (d) return { postedDate: d, rest: line.replace(slash[0], ' ') };
  }
  const dotted = line.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (dotted) {
    const d = parseDateFlexible(dotted[0]);
    if (d) return { postedDate: d, rest: line.replace(dotted[0], ' ') };
  }
  const mdy = line.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i
  );
  if (mdy) {
    const d = tryParseMonthNameDate(line);
    if (d) return { postedDate: d, rest: line.replace(mdy[0], ' ') };
  }
  const dmy = line.match(
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/i
  );
  if (dmy) {
    const d = tryParseMonthNameDate(line);
    if (d) return { postedDate: d, rest: line.replace(dmy[0], ' ') };
  }
  const whole = parseDateFlexible(line.trim());
  if (whole) return { postedDate: whole, rest: line.replace(whole, ' ').replace(/\s+/g, ' ') };
  return null;
}

const AMOUNT_RE = /-?\(?\$?£?€?\s*[\d][\d.,]*\)?/g;

function shouldSkipMetaLine(description: string): boolean {
  const d = description.toLowerCase().trim();
  if (d.length < 2) return true;
  if (/^(opening|closing|previous|new|starting)\s+balance\b/.test(d)) return true;
  if (/^balance\s+(forward|brought|carried|after|before|from)\b/.test(d)) return true;
  if (/^page\s+\d+\s+of\s+\d+$/i.test(d)) return true;
  if (/^total\s+(debits|credits|withdrawals|deposits|for|amount)\b/.test(d)) return true;
  if (/^statement\s+(period|date|ending)\b/.test(d)) return true;
  if (/^account\s+(number|ending|balance)\b/.test(d)) return true;
  if (/^(beginning|ending)\s+balance\b/.test(d)) return true;
  if (/^summary\s+of\s+/i.test(d)) return true;
  return false;
}

function tryRowFromLine(fileName: string, line: string): Omit<ImportedStatementRow, 'rowNumber'> | null {
  const stripped = stripFirstDate(line);
  if (!stripped) return null;
  const { postedDate, rest } = stripped;

  const amountCandidates = [...rest.matchAll(AMOUNT_RE)];
  let bestAmount: number | null = null;
  let bestToken = '';
  for (const m of amountCandidates) {
    const v = parseAmountFlexible(m[0]);
    if (v != null && v !== 0 && Math.abs(v) <= MAX_IMPORT_AMOUNT) {
      if (bestAmount == null || Math.abs(v) > Math.abs(bestAmount)) {
        bestAmount = v;
        bestToken = m[0];
      }
    }
  }
  if (bestAmount == null) return null;

  const description = rest
    .replace(bestToken, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
  if (!description || shouldSkipMetaLine(description)) return null;

  const signed = bestAmount;
  const amount = Math.abs(signed);
  const direction = signed < 0 ? 'debit' : 'credit';

  return {
    sourceFile: fileName,
    sourceFormat: 'pdf',
    postedDate,
    description,
    amount,
    direction,
    warnings: [],
  };
}

/**
 * Best-effort extraction of transaction-like lines from PDF text or OCR output.
 * Uses single lines plus 2-line and 3-line joins (PDFs often split date and amount).
 * Not reliable for all bank layouts; prefer CSV/OFX when available.
 */
export function parseLooseBankTextToRows(fileName: string, text: string): ImportedStatementRow[] {
  const rawLines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const candidates: string[] = [...rawLines];
  const maxJoin = rawLines.length > 800 ? 1 : 2;
  for (let i = 0; i < rawLines.length - 1; i += 1) {
    candidates.push(`${rawLines[i]} ${rawLines[i + 1]}`);
  }
  if (maxJoin >= 2) {
    for (let i = 0; i < rawLines.length - 2; i += 1) {
      candidates.push(`${rawLines[i]} ${rawLines[i + 1]} ${rawLines[i + 2]}`);
    }
  }

  const seen = new Set<string>();
  const rows: ImportedStatementRow[] = [];
  let rowNumber = 0;

  for (const line of candidates) {
    const partial = tryRowFromLine(fileName, line);
    if (!partial) continue;
    const key = `${partial.postedDate}|${partial.amount.toFixed(2)}|${partial.description.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rowNumber += 1;
    rows.push({
      ...partial,
      rowNumber,
    });
  }

  rows.sort((a, b) => {
    const da = a.postedDate ?? '';
    const db = b.postedDate ?? '';
    if (da !== db) return da.localeCompare(db);
    return a.rowNumber - b.rowNumber;
  });

  return rows.map((r, i) => ({ ...r, rowNumber: i + 1 }));
}
