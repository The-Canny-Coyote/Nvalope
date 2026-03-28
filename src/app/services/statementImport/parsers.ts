import { parseYYYYMMDD } from '@/app/utils/date';
import type {
  CsvColumnMapping,
  ImportedStatementRow,
  ParsedStatementFile,
  StatementFormat,
  StatementImportDiagnostic,
} from './types';

const MAX_IMPORT_AMOUNT = 1_000_000_000;

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Pick field separator for a header line (comma, semicolon, or tab) based on counts outside quotes. */
function detectCsvDelimiter(line: string): ',' | ';' | '\t' {
  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;
  let tabs = 0;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes) {
      if (char === ',') commas += 1;
      else if (char === ';') semicolons += 1;
      else if (char === '\t') tabs += 1;
    }
  }
  if (tabs > 0 && tabs >= commas && tabs >= semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const delim = delimiter.length === 1 ? delimiter : ',';
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delim && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  out.push(current.trim());
  return out;
}

export function parseDateFlexible(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (parseYYYYMMDD(trimmed)) return trimmed;

  const slash = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slash) {
    const month = Number.parseInt(slash[1], 10);
    const day = Number.parseInt(slash[2], 10);
    const yearRaw = Number.parseInt(slash[3], 10);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const normalized = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return parseYYYYMMDD(normalized) ? normalized : null;
  }

  const dotted = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotted) {
    const day = Number.parseInt(dotted[1], 10);
    const month = Number.parseInt(dotted[2], 10);
    const yearRaw = Number.parseInt(dotted[3], 10);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const normalized = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return parseYYYYMMDD(normalized) ? normalized : null;
  }

  return null;
}

export function parseAmountFlexible(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let working = trimmed.replace(/[$£€\s]/g, '');
  if (!working) return null;
  let negative = false;
  if (working.startsWith('(') && working.endsWith(')')) {
    negative = true;
    working = working.slice(1, -1);
  }
  const lastComma = working.lastIndexOf(',');
  const lastDot = working.lastIndexOf('.');
  let normalized: string;
  if (lastComma !== -1 && (lastDot === -1 || lastComma > lastDot)) {
    normalized = working.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = working.replace(/,/g, '');
  }
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  if (Math.abs(parsed) > MAX_IMPORT_AMOUNT) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function detectCsvMapping(headers: string[]): CsvColumnMapping {
  const byNormalized = new Map(headers.map((h) => [normalizeHeader(h), h] as const));
  const pick = (candidates: string[]): string | undefined => {
    for (const candidate of candidates) {
      const match = byNormalized.get(candidate);
      if (match) return match;
    }
    return undefined;
  };

  const mapping: CsvColumnMapping = {
    dateColumn: pick(['date', 'posted date', 'transaction date', 'post date']),
    descriptionColumn: pick(['description', 'payee', 'memo', 'details', 'name']),
    amountColumn: pick(['amount', 'transaction amount', 'signed amount']),
    debitColumn: pick(['debit', 'withdrawal', 'outflow', 'money out']),
    creditColumn: pick(['credit', 'deposit', 'inflow', 'money in']),
  };
  return mapping;
}

function getCsvCell(row: Record<string, string>, key?: string): string {
  if (!key) return '';
  return row[key] ?? '';
}

export function detectStatementFormat(fileName: string): StatementFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.ofx')) return 'ofx';
  if (lower.endsWith('.qfx')) return 'qfx';
  if (lower.endsWith('.qif')) return 'qif';
  if (lower.endsWith('.pdf')) return 'pdf';
  return null;
}

export function parseCsvStatement(fileName: string, text: string, inputMapping?: CsvColumnMapping): ParsedStatementFile {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return {
      format: 'csv',
      rows: [],
      diagnostics: [{ severity: 'error', message: 'This CSV file appears empty or has no transaction rows.' }],
      csvColumns: [],
      csvMapping: {},
    };
  }

  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);
  const mapping = inputMapping ?? detectCsvMapping(headers);
  const diagnostics: StatementImportDiagnostic[] = [];
  const hasAmountMode = Boolean(mapping.amountColumn);
  const hasSplitMode = Boolean(mapping.debitColumn || mapping.creditColumn);

  if (!mapping.dateColumn || !mapping.descriptionColumn || (!hasAmountMode && !hasSplitMode)) {
    diagnostics.push({
      severity: 'error',
      message: 'CSV mapping needs Date, Description, and either Amount or Debit/Credit columns.',
    });
  }

  const rows: ImportedStatementRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });

    const rowWarnings: string[] = [];
    const postedDate = parseDateFlexible(getCsvCell(row, mapping.dateColumn));
    if (!postedDate) rowWarnings.push('Invalid or missing date.');

    const description = getCsvCell(row, mapping.descriptionColumn).trim();
    if (!description) rowWarnings.push('Missing description.');

    let amountValue: number | null = null;
    let direction: 'debit' | 'credit' | undefined;
    if (mapping.amountColumn) {
      const signed = parseAmountFlexible(getCsvCell(row, mapping.amountColumn));
      if (signed == null) {
        rowWarnings.push('Invalid amount.');
      } else if (signed < 0) {
        amountValue = Math.abs(signed);
        direction = 'debit';
      } else if (signed > 0) {
        amountValue = signed;
        direction = 'credit';
      }
    } else {
      const debit = parseAmountFlexible(getCsvCell(row, mapping.debitColumn));
      const credit = parseAmountFlexible(getCsvCell(row, mapping.creditColumn));
      if ((debit == null || debit === 0) && (credit == null || credit === 0)) {
        rowWarnings.push('Missing debit/credit amount.');
      } else if (debit != null && debit > 0) {
        amountValue = debit;
        direction = 'debit';
      } else if (credit != null && credit > 0) {
        amountValue = credit;
        direction = 'credit';
      }
    }

    rows.push({
      sourceFile: fileName,
      sourceFormat: 'csv',
      rowNumber: i + 1,
      postedDate: postedDate ?? undefined,
      description: description || undefined,
      amount: amountValue ?? undefined,
      direction,
      warnings: rowWarnings,
    });
  }

  return {
    format: 'csv',
    rows,
    diagnostics,
    csvColumns: headers,
    csvMapping: mapping,
  };
}

function readTag(block: string, tag: string): string | undefined {
  const withEndTag = block.match(new RegExp(`<${tag}>([^<\\n\\r]+)`, 'i'));
  if (withEndTag?.[1]) return withEndTag[1].trim();
  const lineTag = block.match(new RegExp(`^${tag}:\\s*(.+)$`, 'im'));
  if (lineTag?.[1]) return lineTag[1].trim();
  return undefined;
}

function parseOfxDate(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  return parseYYYYMMDD(normalized) ? normalized : null;
}

export function parseOfxQfxStatement(fileName: string, text: string, format: 'ofx' | 'qfx'): ParsedStatementFile {
  const diagnostics: StatementImportDiagnostic[] = [];
  const rows: ImportedStatementRow[] = [];
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi) ?? [];

  if (blocks.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: 'No transactions were found in this OFX/QFX file.',
    });
  }

  blocks.forEach((block, idx) => {
    const amountRaw = readTag(block, 'TRNAMT');
    const amountSigned = parseAmountFlexible(amountRaw ?? '');
    const trnType = (readTag(block, 'TRNTYPE') ?? '').toUpperCase();
    const fitId = readTag(block, 'FITID');
    const memo = readTag(block, 'MEMO');
    const name = readTag(block, 'NAME');
    const date = parseOfxDate(readTag(block, 'DTPOSTED'));
    const warnings: string[] = [];

    if (!date) warnings.push('Invalid or missing posted date.');
    if (amountSigned == null || amountSigned === 0) warnings.push('Invalid amount.');
    if (!name && !memo) warnings.push('Missing description.');

    const isDebitType = trnType === 'DEBIT' || trnType === 'POS' || trnType === 'CHECK' || trnType === 'PAYMENT';
    const isCreditType = trnType === 'CREDIT' || trnType === 'DEP' || trnType === 'DIRECTDEP';
    const direction = isDebitType ? 'debit' : isCreditType ? 'credit' : amountSigned != null && amountSigned < 0 ? 'debit' : 'credit';
    const amount = amountSigned == null ? undefined : Math.abs(amountSigned);

    rows.push({
      sourceFile: fileName,
      sourceFormat: format,
      rowNumber: idx + 1,
      externalTransactionId: fitId,
      postedDate: date ?? undefined,
      description: (name ?? memo ?? '').trim() || undefined,
      memo: memo ?? undefined,
      amount,
      direction,
      warnings,
    });
  });

  return { format, rows, diagnostics };
}

function parseQifDate(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/'/g, '/').replace(/\./g, '/');
  const parts = normalized.split('/').map((x) => x.trim()).filter(Boolean);
  if (parts.length !== 3) return null;
  const month = Number.parseInt(parts[0], 10);
  const day = Number.parseInt(parts[1], 10);
  const yearRaw = Number.parseInt(parts[2], 10);
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  const date = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  return parseYYYYMMDD(date) ? date : null;
}

export function parseQifStatement(fileName: string, text: string): ParsedStatementFile {
  const diagnostics: StatementImportDiagnostic[] = [];
  const rows: ImportedStatementRow[] = [];
  const rawRows = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('^')
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (rawRows.length === 0) {
    diagnostics.push({ severity: 'error', message: 'No transactions were found in this QIF file.' });
  }

  rawRows.forEach((rowText, idx) => {
    const lines = rowText.split('\n').map((line) => line.trim()).filter(Boolean);
    const map = new Map<string, string>();
    lines.forEach((line) => {
      const key = line[0];
      const value = line.slice(1).trim();
      if (key && value) map.set(key, value);
    });

    const signed = parseAmountFlexible(map.get('T') ?? '');
    const postedDate = parseQifDate(map.get('D'));
    const description = map.get('P') ?? map.get('M') ?? '';
    const warnings: string[] = [];
    if (!postedDate) warnings.push('Invalid or missing date.');
    if (signed == null || signed === 0) warnings.push('Invalid amount.');
    if (!description.trim()) warnings.push('Missing description.');

    rows.push({
      sourceFile: fileName,
      sourceFormat: 'qif',
      rowNumber: idx + 1,
      postedDate: postedDate ?? undefined,
      description: description.trim() || undefined,
      memo: map.get('M'),
      amount: signed == null ? undefined : Math.abs(signed),
      direction: signed != null && signed < 0 ? 'debit' : 'credit',
      warnings,
    });
  });

  return { format: 'qif', rows, diagnostics };
}

export function parseStatementFile(fileName: string, text: string, csvMapping?: CsvColumnMapping): ParsedStatementFile {
  const format = detectStatementFormat(fileName);
  if (!format) {
    return {
      format: 'csv',
      rows: [],
      diagnostics: [{ severity: 'error', message: 'Unsupported file format. Use CSV, PDF, OFX/QFX, or QIF.' }],
    };
  }

  switch (format) {
    case 'csv':
      return parseCsvStatement(fileName, text, csvMapping);
    case 'ofx':
      return parseOfxQfxStatement(fileName, text, 'ofx');
    case 'qfx':
      return parseOfxQfxStatement(fileName, text, 'qfx');
    case 'qif':
      return parseQifStatement(fileName, text);
    case 'pdf':
      return {
        format: 'pdf',
        rows: [],
        diagnostics: [
          {
            severity: 'error',
            message: 'PDF files are read as binary. Re-import using the bank statement file picker.',
          },
        ],
      };
    default:
      return {
        format,
        rows: [],
        diagnostics: [{ severity: 'error', message: 'Unsupported file format.' }],
      };
  }
}
