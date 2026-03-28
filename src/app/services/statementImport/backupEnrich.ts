import type { FullBackupSnapshot } from '@/app/services/externalBackup';
import { listAssignmentRules, listStatementTemplates } from './statementTemplates';

/** Attach statement templates and assignment rules to a backup snapshot (browser / IndexedDB only). */
export async function enrichFullBackupWithStatementImport(snapshot: FullBackupSnapshot): Promise<FullBackupSnapshot> {
  if (typeof indexedDB === 'undefined') return snapshot;
  try {
    const [templates, rules] = await Promise.all([listStatementTemplates(), listAssignmentRules()]);
    if (templates.length === 0 && rules.length === 0) return snapshot;
    return {
      ...snapshot,
      statementImport: { templates, rules },
    };
  } catch {
    return snapshot;
  }
}
