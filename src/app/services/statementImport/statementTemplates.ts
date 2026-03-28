import { openDB, STORE_ASSIGNMENT_RULES, STORE_STATEMENT_TEMPLATES } from '@/app/services/budgetIdb';
import type { AssignmentRule } from './ruleEngine';
import { sha256HexFromString } from './dedup';

export interface StatementTemplateRecord {
  id: string;
  bankName: string;
  format: string;
  columnMap: Record<string, string>;
  fingerprint: string;
  createdAt: string;
}

const FINGERPRINT_PREFIX_LEN = 200;

export async function fingerprintFromCsvHeaderLine(headerLine: string): Promise<string> {
  const slice = headerLine.slice(0, FINGERPRINT_PREFIX_LEN);
  return sha256HexFromString(slice);
}

/** First N characters of normalized PDF/bank text before row parsing. */
export async function fingerprintFromPdfTextPrefix(fullText: string): Promise<string> {
  const normalized = fullText.replace(/\s+/g, ' ').trim();
  const slice = normalized.slice(0, FINGERPRINT_PREFIX_LEN);
  return sha256HexFromString(slice);
}

async function withDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDB();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

export async function listStatementTemplates(): Promise<StatementTemplateRecord[]> {
  return withDb(async (db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STATEMENT_TEMPLATES, 'readonly');
      const req = tx.objectStore(STORE_STATEMENT_TEMPLATES).getAll();
      req.onsuccess = () => resolve((req.result as StatementTemplateRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function putStatementTemplate(record: StatementTemplateRecord): Promise<void> {
  return withDb(async (db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STATEMENT_TEMPLATES, 'readwrite');
      tx.objectStore(STORE_STATEMENT_TEMPLATES).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

export async function deleteStatementTemplate(id: string): Promise<void> {
  return withDb(async (db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STATEMENT_TEMPLATES, 'readwrite');
      tx.objectStore(STORE_STATEMENT_TEMPLATES).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

export async function findTemplateByFingerprint(fingerprint: string): Promise<StatementTemplateRecord | null> {
  const all = await listStatementTemplates();
  return all.find((t) => t.fingerprint === fingerprint) ?? null;
}

/** JSON export: templates and rules only (no budget PII). */
export async function exportTemplatesAndRulesJson(): Promise<string> {
  const templates = await listStatementTemplates();
  const rules = await listAssignmentRules();
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), templates, rules }, null, 2);
}

export function parseTemplatesAndRulesImport(jsonText: string): {
  templates: StatementTemplateRecord[];
  rules: AssignmentRule[];
} {
  const raw = JSON.parse(jsonText) as {
    templates?: StatementTemplateRecord[];
    rules?: AssignmentRule[];
  };
  const templates = Array.isArray(raw.templates) ? raw.templates : [];
  const rules = Array.isArray(raw.rules) ? raw.rules : [];
  return { templates, rules };
}

export async function importTemplatesAndRulesFromParsed(data: {
  templates: StatementTemplateRecord[];
  rules: AssignmentRule[];
}): Promise<void> {
  for (const t of data.templates) {
    await putStatementTemplate(t);
  }
  for (const r of data.rules) {
    await putAssignmentRule(r);
  }
}

export async function listAssignmentRules(): Promise<AssignmentRule[]> {
  return withDb(async (db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSIGNMENT_RULES, 'readonly');
      const req = tx.objectStore(STORE_ASSIGNMENT_RULES).getAll();
      req.onsuccess = () => resolve((req.result as AssignmentRule[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function putAssignmentRule(rule: AssignmentRule): Promise<void> {
  return withDb(async (db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSIGNMENT_RULES, 'readwrite');
      tx.objectStore(STORE_ASSIGNMENT_RULES).put(rule);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

export async function deleteAssignmentRule(id: string): Promise<void> {
  return withDb(async (db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSIGNMENT_RULES, 'readwrite');
      tx.objectStore(STORE_ASSIGNMENT_RULES).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}
