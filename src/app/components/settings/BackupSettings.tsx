import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { ChevronDown, ChevronUp, Database, Download, FolderOpen, HelpCircle, Lock, Upload } from 'lucide-react';
import { isExternalBackupSupported, scheduleBackup, getLastBackupSuccessTime } from '@/app/services/externalBackup';
import { SHOW_BANK_STATEMENT_IMPORT } from '@/app/constants/features';
import { useBudget } from '@/app/store/BudgetContext';
import { parseBudgetBackup, type BudgetBackup } from '@/app/store/budgetTypes';
import { getSeedBudgetState } from '@/app/fixtures/seedBudget';
import { delayedToast } from '@/app/services/delayedToast';
import { isEncryptedBackup, decryptBackupPayload } from '@/app/utils/backupCrypto';
import { BackupPasswordDialog } from '@/app/components/BackupPasswordDialog';
import { EncryptedBackupNudgeDialog, getEncryptedBackupNudgeSeen } from '@/app/components/EncryptedBackupNudgeDialog';
import { clampLayoutScale, clampWheelScale, clampCardBarRows, clampCardBarColumns } from '@/app/constants/accessibility';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/components/ui/collapsible';
import { Alert, AlertTitle, AlertDescription } from '@/app/components/ui/alert';
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { toast } from 'sonner';
import {
  classifyImportedTransactions,
  detectStatementFormat,
  parseStatementFile,
} from '@/app/services/statementImport';
import type { CsvColumnMapping, ParsedStatementFile } from '@/app/services/statementImport';
import { runStatementParseInWorker } from '@/app/services/statementImport/importWorkerClient';
import {
  fingerprintFromCsvHeaderLine,
  findTemplateByFingerprint,
  importTemplatesAndRulesFromParsed,
  listAssignmentRules,
  listStatementTemplates,
  putStatementTemplate,
  type StatementTemplateRecord,
} from '@/app/services/statementImport/statementTemplates';
import type { NormalizeImportedTransactionResult } from '@/app/services/statementImport/types';
import { StatementImportPanel } from '@/app/components/StatementImportPanel';
import { useAppStore } from '@/app/store/appStore';
import type { BackupSettingsSnapshot } from '@/app/constants/settings';
import { isPremiumFeatureEnabled } from '@/app/premium/entitlements';

type StatementPreview = {
  fileName: string;
  fileText: string;
  parsed: ParsedStatementFile;
  classification: NormalizeImportedTransactionResult;
  matchedTemplateName?: string | null;
};

type PasswordDialogMode = 'set' | 'download' | 'import';

export interface BackupSettingsProps {
  enabledModules: string[];
  onChooseBackupFolder: () => void;
  onDownloadFullBackup?: (password?: string) => void;
  getBackupPasswordRef?: MutableRefObject<string | null>;
  setBackupPassword?: (p: string | null) => void;
  onCheckForUpdates: () => void;
  checkingForUpdate: boolean;
  onApplySettingsFromBackup?: (settings: BackupSettingsSnapshot) => void;
  /** When premium mode is on, require premium_import for bank statement import UI. */
  hasPremiumImport?: boolean;
  hasBackupFolder?: boolean | null;
  onBeforeOpen?: () => void;
  restoreScrollAfterLayout?: () => void;
  jumpToDataRef: MutableRefObject<(() => void) | null>;
}

// ---------------------------------------------------------------------------
// Small inline help tooltip — keeps each button self-documenting without
// cluttering the surrounding layout.
// ---------------------------------------------------------------------------
function HelpTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center justify-center w-4 h-4 text-muted-foreground cursor-help shrink-0"
          aria-label="More information"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[240px] text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

/** Pulls export date + counts from a raw backup object for the import confirm dialog. */
function extractImportMeta(raw: Record<string, unknown>): { exportDate?: string; envelopeCount?: number; transactionCount?: number } {
  const exportDate = typeof raw.exportDate === 'string' ? raw.exportDate : undefined;
  const data = (raw.data ?? raw.budget ?? raw) as Record<string, unknown>;
  const envelopeCount = Array.isArray(data.envelopes) ? (data.envelopes as unknown[]).length : undefined;
  const transactionCount = Array.isArray(data.transactions) ? (data.transactions as unknown[]).length : undefined;
  return { exportDate, envelopeCount, transactionCount };
}

/** Returns a short human-readable string like "just now", "5 min ago", "2 hr ago", or a date. */
function formatLastBackupTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return new Date(ts).toLocaleDateString();
}

export function BackupSettings({
  enabledModules,
  onChooseBackupFolder,
  onDownloadFullBackup,
  getBackupPasswordRef,
  setBackupPassword,
  onCheckForUpdates,
  checkingForUpdate,
  onApplySettingsFromBackup,
  hasPremiumImport = false,
  hasBackupFolder = null,
  onBeforeOpen,
  restoreScrollAfterLayout,
  jumpToDataRef,
}: BackupSettingsProps) {
  const showBankStatementImport =
    SHOW_BANK_STATEMENT_IMPORT &&
    (!isPremiumFeatureEnabled() || hasPremiumImport);
  const { api } = useBudget();
  const encryptBackups = useAppStore((s) => s.encryptBackups);
  const setEncryptBackups = useAppStore((s) => s.setEncryptBackups);
  const importInputRef = useRef<HTMLInputElement>(null);
  const statementImportInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [statementImporting, setStatementImporting] = useState(false);
  const [statementPreview, setStatementPreview] = useState<StatementPreview | null>(null);
  const [statementImportCreditsAsIncome, setStatementImportCreditsAsIncome] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogMode, setPasswordDialogMode] = useState<PasswordDialogMode>('set');
  const [pendingImportEncryptedContent, setPendingImportEncryptedContent] = useState<string | null>(null);
  const [showEncryptedNudge, setShowEncryptedNudge] = useState(false);
  // Two separate collapsibles instead of one
  const [backupOpen, setBackupOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showImportConfirmDialog, setShowImportConfirmDialog] = useState(false);
  const pendingImportRawRef = useRef<Record<string, unknown> | null>(null);
  const [showSampleDataConfirmDialog, setShowSampleDataConfirmDialog] = useState(false);
  // 3.1 — last backup timestamp (refreshed when backup section opens)
  const [lastBackupTs, setLastBackupTs] = useState<number>(() => getLastBackupSuccessTime());
  // 3.2 — metadata extracted from the backup file before showing confirm dialog
  const [pendingImportMeta, setPendingImportMeta] = useState<{ exportDate?: string; envelopeCount?: number; transactionCount?: number } | null>(null);
  // 3.4 — count of saved CSV templates (loaded once on mount)
  const [savedTemplateCount, setSavedTemplateCount] = useState<number>(0);

  // jumpToDataRef opens the backup collapsible (backward-compat: callers expect
  // the data section to open, which is the backup section).
  const handleBackupOpenChange = useCallback(
    (open: boolean) => {
      if (open) onBeforeOpen?.();
      setBackupOpen(open);
      if (open && restoreScrollAfterLayout) {
        requestAnimationFrame(() => requestAnimationFrame(restoreScrollAfterLayout));
      }
    },
    [onBeforeOpen, restoreScrollAfterLayout]
  );

  const handleImportOpenChange = useCallback(
    (open: boolean) => {
      if (open) onBeforeOpen?.();
      setImportOpen(open);
      if (open && restoreScrollAfterLayout) {
        requestAnimationFrame(() => requestAnimationFrame(restoreScrollAfterLayout));
      }
    },
    [onBeforeOpen, restoreScrollAfterLayout]
  );

  const openDataSection = useCallback(() => {
    handleBackupOpenChange(true);
  }, [handleBackupOpenChange]);

  useLayoutEffect(() => {
    jumpToDataRef.current = openDataSection;
    return () => {
      jumpToDataRef.current = null;
    };
  }, [jumpToDataRef, openDataSection]);

  // 3.1 — refresh last-backup timestamp when the backup section is opened
  useEffect(() => {
    if (backupOpen) setLastBackupTs(getLastBackupSuccessTime());
  }, [backupOpen]);

  // 3.4 — load saved CSV template count once on mount
  useEffect(() => {
    void listStatementTemplates().then((ts) => setSavedTemplateCount(ts.length)).catch(() => {});
  }, []);

  const handleImportClick = () => importInputRef.current?.click();
  const handleStatementImportClick = () => {
    if (!showBankStatementImport) return;
    statementImportInputRef.current?.click();
  };

  const btnBase =
    'inline-flex items-center gap-2 py-2 px-4 border border-primary/30 rounded-lg text-sm font-medium text-foreground transition-colors hover:bg-primary/5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-w-0';
  const btnDisabled = 'disabled:opacity-60 disabled:pointer-events-none';

  const handleExportBackup = () => {
    if (!api) {
      delayedToast.error('Budget not ready. Try again.');
      return;
    }
    const state = api.getState();
    const backup: BudgetBackup = {
      exportDate: new Date().toISOString(),
      version: 1,
      data: state,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nvalope-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    delayedToast.success('Backup downloaded.');
  };

  // 3.3 — CSV export of transactions
  const handleExportTransactionsCsv = () => {
    if (!api) {
      delayedToast.error('Budget not ready. Try again.');
      return;
    }
    const txs = api.getState().transactions ?? [];
    const envelopes = api.getState().envelopes ?? [];
    const envelopeMap = new Map(envelopes.map((e) => [e.id, e.name]));
    const rows = [
      ['Date', 'Amount', 'Description', 'Envelope'],
      ...txs.map((t) => [
        t.date ?? '',
        t.amount != null ? String(t.amount) : '',
        `"${(t.description ?? '').replace(/"/g, '""')}"`,
        `"${(envelopeMap.get(t.envelopeId ?? '') ?? '').replace(/"/g, '""')}"`,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nvalope-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    delayedToast.success(`Downloaded ${txs.length} transactions as CSV.`);
  };

  const applyImportedRaw = (raw: Record<string, unknown>, toastId: string) => {
    if (!api) {
      toast.dismiss(toastId);
      delayedToast.error('Budget not ready. Try again.');
      return;
    }
    const state = parseBudgetBackup(raw);
    api.importData(state);
    const si = raw.statementImport as
      | { templates?: StatementTemplateRecord[]; rules?: import('@/app/services/statementImport/ruleEngine').AssignmentRule[] }
      | undefined;
    if (si && (Array.isArray(si.templates) || Array.isArray(si.rules))) {
      void importTemplatesAndRulesFromParsed({
        templates: si.templates ?? [],
        rules: si.rules ?? [],
      })
        .then(() => scheduleBackup())
        .catch(() => delayedToast.error('Could not restore statement templates from this backup.'));
    }
    if (onApplySettingsFromBackup && raw.settings && typeof raw.settings === 'object') {
      const settings = raw.settings as Record<string, unknown>;
      const layoutScale =
        typeof settings.layoutScale === 'number' && Number.isFinite(settings.layoutScale)
          ? clampLayoutScale(settings.layoutScale)
          : undefined;
      const wheelScale =
        typeof settings.wheelScale === 'number' && Number.isFinite(settings.wheelScale)
          ? clampWheelScale(settings.wheelScale)
          : undefined;
      const cardBarRows =
        typeof settings.cardBarRows === 'number' && Number.isFinite(settings.cardBarRows)
          ? clampCardBarRows(settings.cardBarRows)
          : undefined;
      const cardBarColumns =
        typeof settings.cardBarColumns === 'number' && Number.isFinite(settings.cardBarColumns)
          ? clampCardBarColumns(settings.cardBarColumns)
          : undefined;
      const cardBarPosition =
        settings.cardBarPosition === 'bottom' || settings.cardBarPosition === 'left' || settings.cardBarPosition === 'right'
          ? settings.cardBarPosition
          : undefined;
      const cardBarSectionOrder = Array.isArray(settings.cardBarSectionOrder)
        ? (settings.cardBarSectionOrder as number[]).filter((id) => typeof id === 'number' && Number.isFinite(id))
        : undefined;
      const showCardBarRowSelector =
        typeof settings.showCardBarRowSelector === 'boolean' ? settings.showCardBarRowSelector : undefined;
      const cardsSectionWidthPercent =
        typeof settings.cardsSectionWidthPercent === 'number' && Number.isFinite(settings.cardsSectionWidthPercent)
          ? (settings.cardsSectionWidthPercent as number)
          : undefined;
      const colorblindMode =
        settings.colorblindMode === 'none' ||
        settings.colorblindMode === 'deuteranopia' ||
        settings.colorblindMode === 'tritanopia' ||
        settings.colorblindMode === 'monochromacy'
          ? settings.colorblindMode
          : undefined;
      if (
        layoutScale !== undefined ||
        wheelScale !== undefined ||
        cardBarRows !== undefined ||
        cardBarColumns !== undefined ||
        cardBarPosition !== undefined ||
        cardBarSectionOrder !== undefined ||
        showCardBarRowSelector !== undefined ||
        cardsSectionWidthPercent !== undefined ||
        colorblindMode !== undefined
      ) {
        onApplySettingsFromBackup({
          layoutScale,
          wheelScale,
          cardBarRows,
          cardBarColumns,
          cardBarPosition,
          cardBarSectionOrder: cardBarSectionOrder ?? undefined,
          showCardBarRowSelector,
          cardsSectionWidthPercent,
          colorblindMode,
        });
      }
    }
    toast.success('Data imported. Your budget has been updated.', { id: toastId });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
    if (file.size > MAX_BACKUP_BYTES) {
      delayedToast.error('This file is too large to be a valid Nvalope backup. Check that you selected the right file.');
      return;
    }
    setImporting(true);
    e.target.value = '';
    const toastId = 'import-file';
    toast.loading('Importing…', { id: toastId });
    try {
      const text = await file.text();
      if (isEncryptedBackup(text)) {
        toast.dismiss(toastId);
        setPendingImportEncryptedContent(text);
        setPasswordDialogMode('import');
        setPasswordDialogOpen(true);
        setImporting(false);
        return;
      }
      const raw = JSON.parse(text) as Record<string, unknown>;
      pendingImportRawRef.current = raw;
      setPendingImportMeta(extractImportMeta(raw));
      setShowImportConfirmDialog(true);
    } catch {
      toast.dismiss(toastId);
      delayedToast.error('We couldn\'t read that file. Check that it is a valid backup and try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleStatementImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!showBankStatementImport) return;
    const MAX_STATEMENT_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_STATEMENT_BYTES) {
      delayedToast.error('This file is too large. Bank statement files are typically under 5 MB. Check that you selected the right file.');
      return;
    }
    if (!api) {
      delayedToast.error('Budget not ready. Try again.');
      return;
    }
    const format = detectStatementFormat(file.name);
    if (!format) {
      delayedToast.error('Unsupported file type. Use CSV, PDF, OFX, QFX, or QIF.');
      return;
    }
    setStatementImporting(true);
    const toastId = 'statement-import-file';
    toast.loading('Parsing statement…', { id: toastId });
    try {
      const buffer = await file.arrayBuffer();
      let fileText = '';
      let csvMapping: CsvColumnMapping | undefined;
      let matchedTemplateName: string | null = null;
      if (format !== 'pdf') {
        fileText = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0));
        if (format === 'csv') {
          const hdr = fileText.split(/\r?\n/).find((l) => l.trim())?.trim() ?? '';
          if (hdr) {
            const fp = await fingerprintFromCsvHeaderLine(hdr);
            const t = await findTemplateByFingerprint(fp);
            if (t) {
              matchedTemplateName = t.bankName;
              csvMapping = t.columnMap as unknown as CsvColumnMapping;
            }
          }
        }
      }
      const fileBuffer = buffer.slice(0);
      const parsed = await runStatementParseInWorker({
        fileBuffer,
        format,
        fileName: file.name,
        csvMapping,
        onProgress: (pct, stage) => {
          toast.loading(`${stage} (${pct}%)`, { id: toastId });
        },
      });
      const rules = await listAssignmentRules();
      const txs = api.getState().transactions.map((t) => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
        description: t.description,
        importHash: t.importHash,
      }));
      const classification = await classifyImportedTransactions(parsed.rows, txs, {
        importCreditsAsIncome: statementImportCreditsAsIncome,
        assignmentRules: rules,
        matchedTemplateName,
      });
      setStatementPreview({
        fileName: file.name,
        fileText,
        parsed,
        classification,
        matchedTemplateName,
      });
      toast.success('Statement parsed. Review and confirm import.', { id: toastId });
    } catch {
      toast.dismiss(toastId);
      delayedToast.error('We could not read that statement file. Try another file format or export.');
    } finally {
      setStatementImporting(false);
    }
  };

  const handleStatementCsvMappingChange = (nextMapping: CsvColumnMapping) => {
    if (!statementPreview || statementPreview.parsed.format === 'pdf' || !api) return;
    const parsed = parseStatementFile(statementPreview.fileName, statementPreview.fileText, nextMapping);
    void (async () => {
      const rules = await listAssignmentRules();
      const txs = api.getState().transactions.map((t) => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
        description: t.description,
        importHash: t.importHash,
      }));
      const classification = await classifyImportedTransactions(parsed.rows, txs, {
        importCreditsAsIncome: statementImportCreditsAsIncome,
        assignmentRules: rules,
        matchedTemplateName: statementPreview.matchedTemplateName ?? null,
      });
      setStatementPreview((prev) => (prev ? { ...prev, parsed, classification } : null));
    })();
  };

  useEffect(() => {
    if (!statementPreview || !api) return;
    let cancelled = false;
    void (async () => {
      const rules = await listAssignmentRules();
      const txs = api.getState().transactions.map((t) => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
        description: t.description,
        importHash: t.importHash,
      }));
      const classification = await classifyImportedTransactions(statementPreview.parsed.rows, txs, {
        importCreditsAsIncome: statementImportCreditsAsIncome,
        assignmentRules: rules,
        matchedTemplateName: statementPreview.matchedTemplateName ?? null,
      });
      if (!cancelled) {
        setStatementPreview((prev) => (prev ? { ...prev, classification } : null));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run when credit toggle or parsed content identity changes
  }, [statementImportCreditsAsIncome, statementPreview?.fileName, statementPreview?.fileText, statementPreview?.parsed]);

  const handlePasswordDialogSubmit = (password: string) => {
    if (passwordDialogMode === 'set') {
      setBackupPassword?.(password);
      delayedToast.success('Backup password set for this session.');
      if (!getEncryptedBackupNudgeSeen()) setShowEncryptedNudge(true);
      return;
    }
    if (passwordDialogMode === 'download') {
      onDownloadFullBackup?.(password);
      return;
    }
    if (passwordDialogMode === 'import' && pendingImportEncryptedContent) {
      const toastId = 'import-file';
      toast.loading('Importing…', { id: toastId });
      decryptBackupPayload(pendingImportEncryptedContent, password)
        .then((decrypted) => {
          try {
            const raw = JSON.parse(decrypted) as Record<string, unknown>;
            pendingImportRawRef.current = raw;
            setPendingImportMeta(extractImportMeta(raw));
            setShowImportConfirmDialog(true);
          } catch (parseErr) {
            toast.dismiss(toastId);
            void parseErr;
            delayedToast.error('We couldn\'t read that file. Check that it is a valid backup and try again.');
          }
        })
        .catch((err) => {
          toast.dismiss(toastId);
          void err;
          delayedToast.error('That password didn\'t work, or the backup file may be damaged. Try again or use a different backup.');
        })
        .finally(() => {
          setPendingImportEncryptedContent(null);
          setImporting(false);
        });
    }
  };

  const handleDownloadFullBackupClick = () => {
    if (encryptBackups && !getBackupPasswordRef?.current) {
      setPasswordDialogMode('download');
      setPasswordDialogOpen(true);
    } else {
      onDownloadFullBackup?.(getBackupPasswordRef?.current ?? undefined);
    }
  };

  const externalSupported = isExternalBackupSupported();

  // -------------------------------------------------------------------------
  // Shared collapsible trigger style (reused for both sections)
  // -------------------------------------------------------------------------
  const triggerCls =
    'flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3.5 text-left transition-all duration-200 hover:bg-primary/10 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer glass-card shadow-sm';

  return (
    <>
      <div id="settings-data" className="space-y-3 pt-4 border-t border-border">

        {/* ================================================================
            SECTION 1 — Back up & restore
        ================================================================ */}
        <Collapsible open={backupOpen} onOpenChange={handleBackupOpenChange}>
          <CollapsibleTrigger
            className={triggerCls}
            aria-expanded={backupOpen}
            onPointerDownCapture={() => onBeforeOpen?.()}
            onKeyDownCapture={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onBeforeOpen?.();
            }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden>
                <Database className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Back up &amp; restore</span>
                <span className="block text-xs text-muted-foreground">
                  {hasBackupFolder === true ? 'Auto-backup active · folder set' : 'Download, auto-backup, encryption'}
                </span>
              </div>
            </div>
            {backupOpen ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            )}
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-3 pt-3">

            {/* 2.1 — At-a-glance backup status */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${
                hasBackupFolder === true
                  ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400'
                  : 'bg-muted/50 border-border text-muted-foreground'
              }`}>
                <FolderOpen className="w-3 h-3" aria-hidden />
                {hasBackupFolder === true ? 'Auto-backup: active' : 'Auto-backup: folder not set'}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${
                encryptBackups
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-muted/50 border-border text-muted-foreground'
              }`}>
                <Lock className="w-3 h-3" aria-hidden />
                {encryptBackups ? 'Encryption: on' : 'Encryption: off'}
              </span>
              {/* 3.1 — last backup timestamp */}
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-muted/50 border-border text-muted-foreground">
                {lastBackupTs > 0
                  ? `Last backed up: ${formatLastBackupTime(lastBackupTs)}`
                  : 'Not yet backed up this session'}
              </span>
            </div>

            {/* Browser-data-clear warning — still important, kept compact */}
            <Alert className="border-amber-500/50 bg-amber-500/10 text-foreground [&_[data-slot=alert-description]]:text-muted-foreground">
              <AlertTitle>Clearing browser data removes your app data</AlertTitle>
              <AlertDescription>
                If you clear &quot;cookies and other site data&quot; in your browser, <strong>all Nvalope data is deleted</strong>. Set a backup folder or download a backup now to keep a copy that survives.
                {hasBackupFolder === true && (
                  <span className="block mt-1">Your backup folder files are on your disk and are not affected — but you will need to re-select the folder in Settings after clearing.</span>
                )}
              </AlertDescription>
            </Alert>

            {/* ── Encryption ── */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer" htmlFor="settings-encrypt-backups">
                  <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="text-sm font-medium">Encrypt backups</span>
                  <Checkbox
                    id="settings-encrypt-backups"
                    checked={encryptBackups}
                    onCheckedChange={(checked) => setEncryptBackups(checked === true)}
                    aria-label="Encrypt backup files with a password"
                    className="size-5 shrink-0 rounded"
                  />
                  <HelpTip>
                    When enabled, downloaded backups are protected with a password you choose. The password is not stored — you must remember it or the backup cannot be opened.
                  </HelpTip>
                </label>
              </div>
              {/* 2.3 — progressive encryption setup: prompt card when no password set yet */}
              {encryptBackups && setBackupPassword && (
                <div className={`flex flex-wrap items-center gap-2 ${!getBackupPasswordRef?.current ? 'rounded-lg border border-amber-500/40 bg-amber-500/5 p-2' : ''}`}>
                  {!getBackupPasswordRef?.current && (
                    <p className="w-full text-xs font-medium text-amber-600 dark:text-amber-500">
                      Set a password to use with encrypted backups.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordDialogMode('set');
                      setPasswordDialogOpen(true);
                    }}
                    className={btnBase}
                  >
                    <Lock className="h-4 w-4" aria-hidden />
                    {getBackupPasswordRef?.current ? 'Change backup password' : 'Set backup password'}
                  </button>
                  {getBackupPasswordRef?.current && (
                    <span className="text-xs text-green-600 dark:text-green-400">Password set for this session</span>
                  )}
                </div>
              )}
              {encryptBackups && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  If you forget your password, encrypted backups cannot be recovered. Keep your password somewhere safe.
                </p>
              )}
            </div>

            {/* ── Backup folder (Chromium only) ── */}
            {externalSupported && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={onChooseBackupFolder} className={btnBase}>
                  <FolderOpen className="h-4 w-4" aria-hidden />
                  {hasBackupFolder === true ? 'Change backup folder' : 'Choose backup folder'}
                </button>
                <HelpTip>
                  Pick a folder on your device. Nvalope will write one backup file there automatically after every 3 changes (at most once per minute). That file stays on your disk even if you clear browser data.
                </HelpTip>
              </div>
            )}

            {/* ── Download full backup ── */}
            {onDownloadFullBackup && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleDownloadFullBackupClick} className={btnBase}>
                  <Download className="h-4 w-4" aria-hidden />
                  Download full backup (everything)
                </button>
                <HelpTip>
                  Downloads a single JSON file containing your budget, settings, receipts, and chat history. Use this to restore your data or move to a new device. {encryptBackups ? 'Will be encrypted with your password.' : ''}
                </HelpTip>
              </div>
            )}

            {/* ── Export budget only ── */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                disabled={!api}
                className={`${btnBase} ${btnDisabled}`}
              >
                <Download className="h-4 w-4" aria-hidden />
                Export budget only (no receipts)
              </button>
              <HelpTip>
                Downloads a smaller file with just your envelopes, transactions, and income — no settings or receipt images. Useful for sharing your numbers or opening in another tool.
              </HelpTip>
            </div>

            {/* 3.3 ── Download transactions as CSV ── */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportTransactionsCsv}
                disabled={!api}
                className={`${btnBase} ${btnDisabled}`}
              >
                <Download className="h-4 w-4" aria-hidden />
                Download transactions as CSV
              </button>
              <HelpTip>
                Downloads all your transactions as a spreadsheet-compatible CSV file. Open in Excel, Google Sheets, or any CSV editor.
              </HelpTip>
            </div>

            {/* 1.4 — Browser compat note: only shown when folder API is not supported */}
            {!externalSupported && (
              <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 p-2">
                Auto-backup to a folder is not available in this browser (requires Chrome or Edge). Your data is still backed up automatically on this device. Use <strong>Download full backup</strong> to save a copy elsewhere.
              </p>
            )}

            {/* ── Check for updates ── */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onCheckForUpdates}
                disabled={checkingForUpdate}
                className={`${btnBase} ${btnDisabled}`}
              >
                {checkingForUpdate ? '⏳ Checking…' : '🔄 Check for updates'}
              </button>
            </div>

            {/* ── Sample data ── */}
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-medium text-foreground">Sample data</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!api) return;
                    const existing = api.getState();
                    const hasData =
                      (existing.transactions?.length ?? 0) > 0 || (existing.envelopes?.length ?? 0) > 0;
                    if (hasData) {
                      setShowSampleDataConfirmDialog(true);
                      return;
                    }
                    const state = getSeedBudgetState();
                    api.importData(state);
                    delayedToast.success('Sample data loaded. You can try the assistant and other sections.');
                  }}
                  disabled={!api}
                  className={`${btnBase} ${btnDisabled}`}
                >
                  Load sample data
                </button>
                <HelpTip>
                  Loads demo envelopes, income, and transactions for the current month. Use this to explore features without entering real data. Your existing data will be replaced.
                </HelpTip>
              </div>
            </div>

          </CollapsibleContent>
        </Collapsible>

        {/* ================================================================
            SECTION 2 — Import data
        ================================================================ */}
        <Collapsible open={importOpen} onOpenChange={handleImportOpenChange}>
          <CollapsibleTrigger
            className={triggerCls}
            aria-expanded={importOpen}
            onPointerDownCapture={() => onBeforeOpen?.()}
            onKeyDownCapture={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onBeforeOpen?.();
            }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden>
                <Upload className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Import data</span>
                <span className="block text-xs text-muted-foreground">
                  Restore from backup · bank statement (CSV, PDF, OFX)
                </span>
              </div>
            </div>
            {importOpen ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            )}
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-3 pt-3">

            {/* Premium gate for bank statement import */}
            {SHOW_BANK_STATEMENT_IMPORT && isPremiumFeatureEnabled() && !hasPremiumImport && (
              <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 p-3" role="status">
                <strong>Bank statement import</strong> requires the premium import entitlement. Upgrade to unlock.
              </p>
            )}

            {/* 2.4 — Sub-section: Restore from backup */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Restore from backup</p>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                aria-hidden
                onChange={handleImportFile}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleImportClick}
                  disabled={importing || !api}
                  className={`${btnBase} ${btnDisabled}`}
                >
                  <Upload className="h-4 w-4" aria-hidden />
                  {importing ? '⏳ Importing…' : 'Restore from backup file'}
                </button>
                <HelpTip>
                  Replaces all your current data with the contents of a Nvalope backup file (.json). Use this to restore data on this device or after a browser reset. Encrypted backups will ask for your password.
                </HelpTip>
              </div>
            </div>

            {/* 2.4 — Sub-section: Bank statement import */}
            {showBankStatementImport && (
              <div className="space-y-2 pt-1 border-t border-border">
                <p className="text-xs font-medium text-foreground">Bank statement import</p>
                <input
                  ref={statementImportInputRef}
                  type="file"
                  accept=".csv,.pdf,.ofx,.qfx,.qif,text/csv,application/pdf,application/vnd.intu.qfx,application/x-ofx,application/qif"
                  className="hidden"
                  aria-hidden
                  data-testid="statement-import-input"
                  onChange={handleStatementImportFile}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStatementImportClick}
                    disabled={statementImporting || !api}
                    className={`${btnBase} ${btnDisabled}`}
                  >
                    {statementImporting ? '⏳ Parsing statement…' : 'Import bank statement'}
                  </button>
                  <HelpTip>
                    Upload a CSV, PDF, OFX, QFX, or QIF export from your bank. Nvalope reads it on your device, lets you assign each transaction to an envelope, and skips duplicates. CSV or OFX are most reliable.
                  </HelpTip>
                  {/* 3.4 — column-mapping memory indicator */}
                  {savedTemplateCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {savedTemplateCount} saved {savedTemplateCount === 1 ? 'template' : 'templates'} — column mapping remembered
                    </span>
                  )}
                </div>
                {statementPreview && api && (
                  <StatementImportPanel
                    fileName={statementPreview.fileName}
                    parsed={statementPreview.parsed}
                    classification={statementPreview.classification}
                    envelopes={api.getState().envelopes}
                    statementImportCreditsAsIncome={statementImportCreditsAsIncome}
                    onCreditsAsIncomeChange={setStatementImportCreditsAsIncome}
                    onCsvMappingChange={handleStatementCsvMappingChange}
                    enabledModules={enabledModules}
                    onCancel={() => setStatementPreview(null)}
                    onImported={(summary) => {
                      delayedToast.success(
                        `Imported ${summary.transactionCount} transactions and ${summary.incomeCount} income entries. Skipped ${summary.skippedDuplicates} duplicates, ${summary.possibleDuplicates} possible duplicates, ${summary.skippedCreditRows} credit rows, and ${summary.invalidRows} invalid rows.`
                      );
                      setStatementPreview(null);
                    }}
                    addTransactions={(txs) => api.addTransactions(txs)}
                    addIncome={(income) => api.addIncome(income)}
                    deleteTransaction={(id) => api.deleteTransaction(id)}
                    onSaveCsvTemplate={async (bankName, columnMap) => {
                      const hdr = statementPreview.fileText.split(/\r?\n/).find((l) => l.trim())?.trim();
                      if (!hdr) {
                        delayedToast.error('Could not read a header row to save this template.');
                        return;
                      }
                      const fp = await fingerprintFromCsvHeaderLine(hdr);
                      const rec: StatementTemplateRecord = {
                        id: crypto.randomUUID(),
                        bankName: bankName.trim() || 'My bank',
                        format: 'csv',
                        columnMap: columnMap as Record<string, string>,
                        fingerprint: fp,
                        createdAt: new Date().toISOString(),
                      };
                      await putStatementTemplate(rec);
                      scheduleBackup();
                    }}
                  />
                )}
              </div>
            )}

          </CollapsibleContent>
        </Collapsible>

      </div>

      {/* ── Dialogs (shared between both sections) ── */}
      <BackupPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onSubmit={handlePasswordDialogSubmit}
        title={
          passwordDialogMode === 'set'
            ? 'Set backup password'
            : passwordDialogMode === 'download'
              ? 'Enter password to encrypt this backup'
              : 'Enter password to open encrypted backup'
        }
        description={
          passwordDialogMode === 'set'
            ? 'Used to encrypt backups for this session only (not stored after you close the app). At least 8 characters. If you forget this password, encrypted backups cannot be opened—there is no recovery. Store backups on an external storage device and keep your password safe.'
            : passwordDialogMode === 'download'
              ? 'The backup file will be encrypted. You will need this exact password to open it when importing. If you forget the password, the file cannot be opened. Store it on an external storage device and keep your password safe.'
              : 'This file is encrypted. Enter the password you used when creating the backup. If you do not know the password, the file cannot be opened.'
        }
        submitLabel={passwordDialogMode === 'import' ? 'Import' : 'Continue'}
        confirmPassword={passwordDialogMode === 'set'}
      />
      <EncryptedBackupNudgeDialog
        open={showEncryptedNudge}
        onOpenChange={setShowEncryptedNudge}
        onAck={() => setShowEncryptedNudge(false)}
      />

      <ConfirmDialog
        open={showImportConfirmDialog}
        onOpenChange={(open) => {
          setShowImportConfirmDialog(open);
          if (!open) {
            pendingImportRawRef.current = null;
            setPendingImportMeta(null);
            toast.dismiss('import-file');
          }
        }}
        title="Replace your budget data?"
        description={[
          'This will replace all your current envelopes, transactions, and income with the data in this file. This cannot be undone.',
          pendingImportMeta?.exportDate
            ? `This backup was exported on ${new Date(pendingImportMeta.exportDate).toLocaleString()}.`
            : '',
          pendingImportMeta?.envelopeCount != null || pendingImportMeta?.transactionCount != null
            ? `It contains ${pendingImportMeta.envelopeCount ?? '?'} envelope${(pendingImportMeta.envelopeCount ?? 0) !== 1 ? 's' : ''} and ${pendingImportMeta.transactionCount ?? '?'} transaction${(pendingImportMeta.transactionCount ?? 0) !== 1 ? 's' : ''}.`
            : '',
          'Make sure you have a backup of your current data first.',
        ].filter(Boolean).join(' ')}
        confirmLabel="Yes, replace my data"
        onConfirm={() => {
          const raw = pendingImportRawRef.current;
          if (!raw) {
            toast.dismiss('import-file');
            delayedToast.error('Import data was not available. Please try again.');
            return;
          }
          applyImportedRaw(raw, 'import-file');
          pendingImportRawRef.current = null;
          setPendingImportMeta(null);
          setShowImportConfirmDialog(false);
        }}
      />

      <ConfirmDialog
        open={showSampleDataConfirmDialog}
        onOpenChange={setShowSampleDataConfirmDialog}
        title="Replace your data with sample data?"
        description="This will overwrite your current budget. Use this only if you want to start fresh with demo data."
        confirmLabel="Load sample data"
        onConfirm={() => {
          if (!api) return;
          const state = getSeedBudgetState();
          api.importData(state);
          delayedToast.success('Sample data loaded. You can try the assistant and other sections.');
          setShowSampleDataConfirmDialog(false);
        }}
      />
    </>
  );
}
