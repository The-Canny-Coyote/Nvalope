import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { ChevronDown, ChevronUp, Database, Lock } from 'lucide-react';
import { isExternalBackupSupported, scheduleBackup } from '@/app/services/externalBackup';
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
  putStatementTemplate,
  type StatementTemplateRecord,
} from '@/app/services/statementImport/statementTemplates';
import type { NormalizeImportedTransactionResult } from '@/app/services/statementImport/types';
import { StatementImportPanel } from '@/app/components/StatementImportPanel';
import { useAppStore } from '@/app/store/appStore';
import type { BackupSettingsSnapshot } from '@/app/constants/settings';

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
  hasBackupFolder?: boolean | null;
  onBeforeOpen?: () => void;
  restoreScrollAfterLayout?: () => void;
  jumpToDataRef: MutableRefObject<(() => void) | null>;
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
  hasBackupFolder = null,
  onBeforeOpen,
  restoreScrollAfterLayout,
  jumpToDataRef,
}: BackupSettingsProps) {
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
  const [dataMgmtOpen, setDataMgmtOpen] = useState(false);

  const handleDataMgmtOpenChange = useCallback(
    (open: boolean) => {
      if (open) onBeforeOpen?.();
      setDataMgmtOpen(open);
      if (open && restoreScrollAfterLayout) {
        requestAnimationFrame(() => requestAnimationFrame(restoreScrollAfterLayout));
      }
    },
    [onBeforeOpen, restoreScrollAfterLayout]
  );

  const openDataSection = useCallback(() => {
    handleDataMgmtOpenChange(true);
  }, [handleDataMgmtOpenChange]);

  useLayoutEffect(() => {
    jumpToDataRef.current = openDataSection;
    return () => {
      jumpToDataRef.current = null;
    };
  }, [jumpToDataRef, openDataSection]);

  const handleImportClick = () => importInputRef.current?.click();
  const handleStatementImportClick = () => statementImportInputRef.current?.click();

  const dataMgmtBtn =
    'inline-flex items-center gap-2 py-2 px-4 border border-primary/30 rounded-lg text-sm font-medium text-foreground transition-colors hover:bg-primary/5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-w-0';

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
      const backupUiMode = settings.uiMode === 'normal' ? 'normal' : undefined;
      if (
        layoutScale !== undefined ||
        wheelScale !== undefined ||
        cardBarRows !== undefined ||
        cardBarColumns !== undefined ||
        cardBarPosition !== undefined ||
        cardBarSectionOrder !== undefined ||
        showCardBarRowSelector !== undefined ||
        cardsSectionWidthPercent !== undefined ||
        backupUiMode !== undefined
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
          uiMode: backupUiMode,
        });
      }
    }
    toast.success('Data imported. Your budget has been updated.', { id: toastId });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      applyImportedRaw(raw, toastId);
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
            applyImportedRaw(raw, toastId);
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

  return (
    <>
      <div id="settings-data">
        <Collapsible open={dataMgmtOpen} onOpenChange={handleDataMgmtOpenChange} className="pt-4 border-t border-border">
          <CollapsibleTrigger
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3.5 text-left transition-all duration-200 hover:bg-primary/10 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer glass-card shadow-sm"
            aria-expanded={dataMgmtOpen}
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
                <span className="block text-sm font-semibold text-foreground">Data Management</span>
                <span className="block text-xs text-muted-foreground">Full backup, budget-only export, import, updates</span>
              </div>
            </div>
            {dataMgmtOpen ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            <Alert className="border-amber-500/50 bg-amber-500/10 text-foreground [&_[data-slot=alert-description]]:text-muted-foreground">
              <AlertTitle>Clearing browser data removes your app data</AlertTitle>
              <AlertDescription>
                <p>
                  If you clear &quot;cookies and other site data&quot; (or similar) in your browser for this site, <strong>all of Nvalope&apos;s data is deleted</strong>: your budget, the local backup copy, and the app&apos;s memory of your backup folder. The app cannot warn you at the moment you clear—so set a backup folder or download a full backup now if you want a copy that survives.
                </p>
                <p className="mt-2">
                  <strong>Backup folder:</strong> The <em>files</em> in the folder you chose are on your disk and are <strong>not</strong> deleted when you clear site data. After clearing, you will need to choose that folder again in Settings so the app can write to it. Your existing backup file in that folder remains.
                </p>
              </AlertDescription>
            </Alert>
            <p className="text-xs text-muted-foreground">
              <strong>Full backup</strong> = everything (budget, settings, receipts, chat). Use to restore or move to another device. <strong>Budget-only export</strong> = envelopes, transactions, and income only—no settings or app data. Use for sharing or other tools. <strong>Import</strong> = replace this app’s data from a file (full backup or budget-only).
            </p>
            {SHOW_BANK_STATEMENT_IMPORT && (
              <>
                <p className="text-xs text-muted-foreground">
                  <strong>Bank statement import</strong> is in this section: expand <strong>Data Management</strong>, then use{' '}
                  <strong>Import bank statement</strong>. Supported formats: CSV, PDF, OFX/QFX, and QIF. Everything is parsed on your device; CSV or
                  OFX exports are usually the most reliable.
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  For <strong>CSV</strong> (a spreadsheet-style download): Nvalope reads the first row of your file as column names and{' '}
                  <strong>tries to auto-fill</strong> which column is the date, description, and amount. You normally do not need to touch those
                  choices unless the preview looks wrong—then you pick the right column from each menu. You can also save a mapping for the next
                  time you import from the same bank.
                </p>
                <p className="text-xs text-primary font-medium">
                  <strong>Transaction history</strong> is an optional feature and is off by default. If you use bank statement import, enable{' '}
                  <strong>Transactions</strong> under <strong>Optional features</strong> (above) so you can browse imported lines in one place.
                </p>
              </>
            )}
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                After about three changes you make (budget, settings, or app data), Nvalope saves a backup copy on this device. Automatic saves run at most once per minute. Use{' '}
                <strong className="text-foreground">Download full backup</strong> anytime for a file you control.
              </p>
              <p>
                {isExternalBackupSupported()
                  ? 'Chrome, Edge, and other Chromium browsers can ask you to choose a folder on your disk (File System Access API). One file there is updated when autobackup runs. Safari and Firefox do not let websites pick an arbitrary folder—here, autobackup stays on this device until you download a copy.'
                  : 'This browser does not support choosing a folder on your disk for automatic backups. Autobackup still runs to a copy on this device (IndexedDB); use Download full backup to save a file elsewhere (e.g. USB drive).'}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              We recommend storing backup files on an external storage device (e.g. USB drive or external disk) so you have a copy if this device is lost or replaced.
            </p>
            <p className="text-xs font-medium text-foreground">Save a full copy • Export numbers only • Replace from file</p>
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
              </label>
              {encryptBackups && setBackupPassword && (
                <button
                  type="button"
                  onClick={() => {
                    setPasswordDialogMode('set');
                    setPasswordDialogOpen(true);
                  }}
                  className={dataMgmtBtn}
                >
                  🔐 Set backup password
                </button>
              )}
            </div>
            {encryptBackups && (
              <>
                <p className="text-xs text-muted-foreground">
                  Full backups (folder and download) will be encrypted only when a password is set. Until you set a password above, new backups are saved <strong>unencrypted</strong>. The password is used for this session only and is not stored.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 font-medium mt-1">
                  If you forget this password, encrypted backups cannot be opened. There is no recovery. Store backup files on an external storage device (e.g. USB drive or external disk) and keep your password in a safe place.
                </p>
              </>
            )}
            {hasBackupFolder === true && isExternalBackupSupported() && (
              <p className="text-xs text-muted-foreground">
                Backup folder set. One file there is updated when autobackup runs (after about three changes, at most once per minute), in addition to the copy on this device.
              </p>
            )}
            {isExternalBackupSupported() ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={onChooseBackupFolder} className={dataMgmtBtn}>
                  📁 Choose backup folder
                </button>
              </div>
            ) : onDownloadFullBackup ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleDownloadFullBackupClick} className={dataMgmtBtn}>
                  💾 Download full backup
                </button>
              </div>
            ) : null}
            {onDownloadFullBackup && isExternalBackupSupported() && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleDownloadFullBackupClick} className={dataMgmtBtn}>
                  💾 Download full backup
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                disabled={!api}
                className={`${dataMgmtBtn} disabled:opacity-60 disabled:pointer-events-none`}
              >
                💾 Export budget data only
              </button>
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              aria-hidden
              onChange={handleImportFile}
            />
            {SHOW_BANK_STATEMENT_IMPORT && (
              <input
                ref={statementImportInputRef}
                type="file"
                accept=".csv,.pdf,.ofx,.qfx,.qif,text/csv,application/pdf,application/vnd.intu.qfx,application/x-ofx,application/qif"
                className="hidden"
                aria-hidden
                data-testid="statement-import-input"
                onChange={handleStatementImportFile}
              />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleImportClick}
                disabled={importing || !api}
                className={`${dataMgmtBtn} disabled:opacity-60 disabled:pointer-events-none`}
              >
                {importing ? '⏳ Importing…' : '📥 Import from file'}
              </button>
            </div>
            {SHOW_BANK_STATEMENT_IMPORT && (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStatementImportClick}
                    disabled={statementImporting || !api}
                    className={`${dataMgmtBtn} disabled:opacity-60 disabled:pointer-events-none`}
                  >
                    {statementImporting ? '⏳ Parsing statement…' : '📄 Import bank statement'}
                  </button>
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
              </>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCheckForUpdates}
                disabled={checkingForUpdate}
                className={`${dataMgmtBtn} disabled:opacity-60 disabled:pointer-events-none`}
              >
                {checkingForUpdate ? '⏳ Checking…' : '🔄 Check for updates'}
              </button>
            </div>
            <p className="text-xs font-medium text-foreground mt-4">Sample data</p>
            <p className="text-xs text-muted-foreground">
              Load sample envelopes, income, and transactions for the current month so you can try the assistant and other features without entering data.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!api) return;
                  const state = getSeedBudgetState();
                  api.importData(state);
                  delayedToast.success('Sample data loaded. You can try the assistant and other sections.');
                }}
                disabled={!api}
                className={`${dataMgmtBtn} disabled:opacity-60 disabled:pointer-events-none`}
              >
                Load sample data
              </button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

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
    </>
  );
}
