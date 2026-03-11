import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { Receipt, Calendar, BarChart3, Bot, Box, PieChart, DollarSign, Wallet, History, Accessibility, BookOpen, ChevronDown, ChevronUp, Sparkles, Settings, Database, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { isExternalBackupSupported } from '@/app/services/externalBackup';
import { MODULE_CONFIG } from '@/app/constants/modules';
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
import { useAppStore } from '@/app/store/appStore';
import { isWebLLMEligible, loadWebLLMEngine, unloadWebLLMEngine, clearWebLLMCache } from '@/app/services/webLLMAssistant';
import { toast } from 'sonner';
import { Progress } from '@/app/components/ui/progress';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';

const MODULE_ICONS: Record<string, LucideIcon> = {
  // Core
  overview:      PieChart,
  income:        DollarSign,
  envelopes:     Wallet,
  transactions:  History,
  accessibility: Accessibility,
  // Added
  receiptScanner: Receipt,
  calendar:       Calendar,
  analytics:      BarChart3,
  cacheAssistant: Bot,
  advancedAICache: Bot,
  glossary: BookOpen,
};

export interface SettingsContentProps {
  enabledModules: string[];
  enableModule: (moduleId: string) => void;
  disableModule: (moduleId: string) => void;
  enableCache: () => void;
  onEnableAdvancedAICache: () => void;
  onChooseBackupFolder: () => void;
  /** Download full backup (budget + settings + app data). Pass optional password to encrypt. */
  onDownloadFullBackup?: (password?: string) => void;
  encryptBackups?: boolean;
  setEncryptBackups?: (v: boolean) => void;
  getBackupPasswordRef?: MutableRefObject<string | null>;
  setBackupPassword?: (p: string | null) => void;
  onCheckForUpdates: () => void;
  checkingForUpdate: boolean;
  /** Called after a successful backup import with layout/wheel scale from the backup (if present). */
  onApplySettingsFromBackup?: (settings: {
    layoutScale?: number;
    wheelScale?: number;
    cardBarRows?: number;
    cardBarColumns?: number;
    cardBarPosition?: 'bottom' | 'left' | 'right';
    cardBarSectionOrder?: number[] | null;
    showCardBarRowSelector?: boolean;
    cardsSectionWidthPercent?: number;
    uiMode?: 'normal';
  }) => void;
  uiMode?: 'normal';
  setUiMode?: (v: 'normal') => void;
  /** When true, optional-upgrade modules (e.g. Advanced AI) can be enabled. */
  isPremium?: boolean;
  /** Optional features collapsible open state (controlled from App so it survives remounts). */
  optionalFeaturesOpen?: boolean;
  onOptionalFeaturesOpenChange?: (open: boolean) => void;
  /** Core features / Data Management collapsibles: lifted so they stay open when toggling. */
  coreFeaturesOpen?: boolean;
  onCoreFeaturesOpenChange?: (open: boolean) => void;
  dataMgmtOpen?: boolean;
  onDataMgmtOpenChange?: (open: boolean) => void;
  /** When true, user has chosen a backup folder; show status in Data Management. */
  hasBackupFolder?: boolean | null;
  /** Call before opening a collapsible so main scroll can be restored after layout. */
  saveScrollForRestore?: () => void;
  /** Call after collapsible content has expanded to restore main scroll position. */
  restoreScrollAfterLayout?: () => void;
  /** When true, the app is in card layout; show option at top to switch back to section wheel. */
  useCardLayout?: boolean;
  /** Switch from card layout back to section wheel. */
  setUseCardLayout?: (v: boolean) => void;
}

export function SettingsContent({
  enabledModules,
  enableModule,
  disableModule,
  enableCache,
  onEnableAdvancedAICache: _onEnableAdvancedAICache,
  onChooseBackupFolder,
  onDownloadFullBackup,
  encryptBackups = false,
  setEncryptBackups,
  getBackupPasswordRef,
  setBackupPassword,
  onCheckForUpdates,
  checkingForUpdate,
  onApplySettingsFromBackup,
  uiMode,
  setUiMode,
  isPremium: _isPremium = false,
  optionalFeaturesOpen = false,
  onOptionalFeaturesOpenChange,
  coreFeaturesOpen = false,
  onCoreFeaturesOpenChange,
  dataMgmtOpen = false,
  onDataMgmtOpenChange,
  hasBackupFolder = null,
  saveScrollForRestore,
  restoreScrollAfterLayout,
  useCardLayout = false,
  setUseCardLayout,
}: SettingsContentProps) {
  const { api } = useBudget();
  const webLLMEnabled = useAppStore((s) => s.webLLMEnabled);
  const setWebLLMEnabled = useAppStore((s) => s.setWebLLMEnabled);
  const webLLMEligible = isWebLLMEligible();
  const receiptCategoryPreferRegex = useAppStore((s) => s.receiptCategoryPreferRegex);
  const setReceiptCategoryPreferRegex = useAppStore((s) => s.setReceiptCategoryPreferRegex);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  type PasswordDialogMode = 'set' | 'download' | 'import';
  const [passwordDialogMode, setPasswordDialogMode] = useState<PasswordDialogMode>('set');
  const [pendingImportEncryptedContent, setPendingImportEncryptedContent] = useState<string | null>(null);
  const [showEncryptedNudge, setShowEncryptedNudge] = useState(false);
  // Local open state so the chevron toggle works immediately; sync from parent so it survives remounts.
  const [optionalOpen, setOptionalOpen] = useState(optionalFeaturesOpen);
  const [coreOpen, setCoreOpen] = useState(coreFeaturesOpen);
  const [dataMgmtOpenLocal, setDataMgmtOpenLocal] = useState(dataMgmtOpen);
  const [showWebLLMDeleteDialog, setShowWebLLMDeleteDialog] = useState(false);
  useEffect(() => {
    setOptionalOpen(optionalFeaturesOpen);
  }, [optionalFeaturesOpen]);
  useEffect(() => {
    setCoreOpen(coreFeaturesOpen);
  }, [coreFeaturesOpen]);
  useEffect(() => {
    setDataMgmtOpenLocal(dataMgmtOpen);
  }, [dataMgmtOpen]);
  const handleOptionalOpenChange = (open: boolean) => {
    if (open) {
      saveScrollForRestore?.();
    }
    setOptionalOpen(open);
    onOptionalFeaturesOpenChange?.(open);
    if (open && restoreScrollAfterLayout) {
      requestAnimationFrame(() => requestAnimationFrame(restoreScrollAfterLayout));
    }
  };
  const handleCoreOpenChange = (open: boolean) => {
    if (open) saveScrollForRestore?.();
    setCoreOpen(open);
    onCoreFeaturesOpenChange?.(open);
    if (open && restoreScrollAfterLayout) {
      requestAnimationFrame(() => requestAnimationFrame(restoreScrollAfterLayout));
    }
  };
  const handleDataMgmtOpenChange = (open: boolean) => {
    if (open) saveScrollForRestore?.();
    setDataMgmtOpenLocal(open);
    onDataMgmtOpenChange?.(open);
    if (open && restoreScrollAfterLayout) {
      requestAnimationFrame(() => requestAnimationFrame(restoreScrollAfterLayout));
    }
  };

  const scheduleScrollRestore = useCallback(() => {
    if (!restoreScrollAfterLayout) return;
    requestAnimationFrame(() => requestAnimationFrame(restoreScrollAfterLayout));
  }, [restoreScrollAfterLayout]);

  const wrapCollapsibleOpen = useCallback(
    (open: boolean, setOpen: (v: boolean) => void) => {
      if (open) saveScrollForRestore?.();
      setOpen(open);
      if (open) scheduleScrollRestore();
    },
    [saveScrollForRestore, scheduleScrollRestore]
  );

  const handleImportClick = () => importInputRef.current?.click();

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
    } catch (err) {
      toast.dismiss(toastId);
      const message = err instanceof Error ? err.message : 'Invalid backup file.';
      delayedToast.error(message);
    } finally {
      setImporting(false);
    }
  };

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
            delayedToast.error(parseErr instanceof Error ? parseErr.message : 'We couldn\'t read that file. Check that it\'s a valid backup file.');
          }
        })
        .catch((err) => {
          toast.dismiss(toastId);
          delayedToast.error(err instanceof Error ? err.message : 'That password didn\'t work, or the file may be damaged. Try again or use a different backup.');
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

  const scrollToSection = (sectionId: string, open: () => void) => {
    open();
    // Open handlers schedule restoreScrollAfterLayout in 2 rAFs; run scroll after layout settles and after that so our scroll isn't overwritten.
    const scrollToEl = () => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(scrollToEl, 150);
      });
    });
  };

  return (
    <div className="space-y-4">
      {setUseCardLayout && (
        useCardLayout ? (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Using card layout. Switch back to the Feature Wheel to see all sections in a wheel.
            </p>
            <button
              type="button"
              onClick={() => setUseCardLayout(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Use Feature Wheel
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Using the Feature Wheel. Switch to cards to see sections as a card bar.
            </p>
            <button
              type="button"
              onClick={() => setUseCardLayout(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Use cards
            </button>
          </div>
        )
      )}
      <h3 className="text-lg text-primary">Settings & Features</h3>
      <p className="text-xs text-muted-foreground">
        Everything in this app today is free forever. Future optional features, when added, will be optional extras.
      </p>
      <nav className="flex flex-wrap items-center gap-2" aria-label="Jump to section">
        <span className="text-xs text-muted-foreground mr-1">Jump to:</span>
        {[
          { id: 'settings-core', label: 'Core features', open: () => setCoreOpen(true) },
          { id: 'settings-optional', label: 'Optional features', open: () => handleOptionalOpenChange(true) },
          { id: 'settings-data', label: 'Data', open: () => handleDataMgmtOpenChange(true) },
        ].map(({ id, label, open }) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollToSection(id, open)}
            className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl text-sm font-medium border border-primary/25 bg-primary/5 text-foreground transition-colors hover:bg-primary/10 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ── Core Features (collapsible) ─────────────────────────── */}
      <div id="settings-core">
      <Collapsible open={coreOpen} onOpenChange={handleCoreOpenChange} className="pt-2 border-t border-border">
        <CollapsibleTrigger
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3.5 text-left transition-all duration-200 hover:bg-primary/10 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer glass-card shadow-sm"
          aria-expanded={coreOpen}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden>
              <Settings className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Core Features</span>
              <span className="block text-xs text-muted-foreground">Overview, Income, Envelopes, Transactions, Accessibility</span>
            </div>
          </div>
          {coreOpen ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Enabled by default. Turn off any section you don&apos;t need — Settings is always accessible.
          </p>
          <p className="text-xs text-primary font-medium">
            Turning a feature off only removes it from the menu. Your data is not deleted—turn it back on anytime to see it again.
          </p>
          <div className="space-y-2 mt-2">
            {MODULE_CONFIG.filter((m) => m.core).map((config) => {
              const isEnabled = enabledModules.includes(config.id);
              const Icon = MODULE_ICONS[config.id] ?? Box;
              return (
                <div
                  key={config.id}
                  data-testid={`module-${config.id}`}
                  className={`p-3 border rounded-lg flex items-center justify-between gap-3 transition-colors ${isEnabled ? 'bg-primary/5 border-primary/20' : 'border-border opacity-60'}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center justify-center w-9 h-9 shrink-0 rounded-lg bg-primary/10 text-primary" aria-hidden>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground">{config.label}</span>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </div>
                  </div>
                  <Checkbox
                    checked={isEnabled}
                    onCheckedChange={(checked) => {
                      if (checked) enableModule(config.id);
                      else disableModule(config.id);
                    }}
                    aria-label={`${config.label} ${isEnabled ? 'enabled' : 'disabled'}`}
                    className="size-5 shrink-0 rounded"
                  />
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
      </div>

      {/* ── Optional features (expandable) ─────────────────────────── */}
      <div id="settings-optional">
      <Collapsible open={optionalOpen} onOpenChange={handleOptionalOpenChange} className="pt-2 border-t border-border">
        <CollapsibleTrigger
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3.5 text-left transition-all duration-200 hover:bg-primary/10 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer glass-card shadow-sm"
          aria-expanded={optionalOpen}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden>
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Optional features</span>
              <span className="block text-xs text-muted-foreground">Receipt Scanner, Calendar, AI & more</span>
            </div>
          </div>
          {optionalOpen ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          {/* Added Features */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-medium text-foreground">Added Features</h4>
            </div>
            <p className="text-xs text-muted-foreground">Optional extras — enable what you need.</p>
            <p className="text-xs text-primary font-medium">
              Disabling a feature only hides it from view. Your data (receipts, calendar, etc.) is not deleted.
            </p>
            <div className="space-y-1.5 mt-2">
              {MODULE_CONFIG.filter((m) => !m.core && !m.premiumOnly).map((config) => {
                const isEnabled = enabledModules.includes(config.id);
                const isCache = config.id === 'cacheAssistant';
                const Icon = MODULE_ICONS[config.id] ?? Box;
                return (
                  <div
                    key={config.id}
                    data-testid={`module-${config.id}`}
                    title={config.description}
                    className={`px-3 py-2 border rounded-lg flex items-center gap-3 transition-colors ${isEnabled ? 'bg-primary/5 border-primary/20' : 'border-border'}`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-primary/10 text-primary text-xl leading-none" aria-hidden>
                      {(config.id === 'cacheAssistant' || config.id === 'advancedAICache') ? <span aria-hidden>{config.emoji}</span> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-medium text-foreground min-w-0 flex-1">{config.label}</span>
                    <Checkbox
                      checked={isEnabled}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          if (isCache) enableCache();
                          else enableModule(config.id);
                        } else {
                          disableModule(config.id);
                        }
                      }}
                      aria-label={`${config.label} ${isEnabled ? 'enabled' : 'disabled'}`}
                      className="size-5 shrink-0 rounded"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Local AI (WebLLM) */}
          <div className="space-y-2 pt-2 border-t border-border">
            <h4 className="text-sm font-medium text-foreground">Local AI (WebLLM)</h4>
            {webLLMEligible ? (
              <div className="p-3 border border-primary/20 rounded-lg flex items-center justify-between gap-3 bg-primary/5 transition-colors">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground">Use local AI model</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Run a small language model in your browser. Checking this downloads the model (hundreds of MB). All data stays on your device.
                  </p>
                </div>
                <Checkbox
                  checked={webLLMEnabled}
                  onCheckedChange={async (checked) => {
                    if (checked) {
                      setWebLLMEnabled(true);
                      const toastId = 'webllm-download-settings';
                      toast.loading('Downloading local AI model…', {
                        id: toastId,
                        description: React.createElement(Progress, { value: 0, className: 'mt-1.5 h-2.5 w-full min-w-[160px]' }),
                      });
                      try {
                        await loadWebLLMEngine((report) => {
                          const p = report.progress != null ? Math.round(report.progress * 100) : undefined;
                          toast.loading(report.text || 'Loading…', {
                            id: toastId,
                            description: React.createElement(Progress, { value: p ?? 0, className: 'mt-1.5 h-2.5 w-full min-w-[160px]' }),
                          });
                        });
                        toast.success('Local AI model ready.', {
                          id: toastId,
                          description: 'Stored in this browser on your device. You can turn it off or delete it in Settings or in the assistant.',
                        });
                      } catch {
                        toast.dismiss(toastId);
                        toast.error('The assistant couldn\'t load. You can try again from the AI Assistant.');
                        setWebLLMEnabled(false);
                      }
                    } else {
                      setShowWebLLMDeleteDialog(true);
                    }
                  }}
                  aria-label="Use local AI model (WebLLM)"
                  className="size-5 shrink-0 rounded"
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Local AI is available on devices with more memory and WebGPU support (e.g. Chrome, Edge).
              </p>
            )}
          </div>

          <AlertDialog open={showWebLLMDeleteDialog} onOpenChange={setShowWebLLMDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete downloaded model files?</AlertDialogTitle>
                <AlertDialogDescription>
                  Do you want to remove the downloaded AI model files from this device to free space (hundreds of MB)? If you turn the local AI model back on later—here or in the assistant—you will need to redownload the model.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={async () => {
                    setShowWebLLMDeleteDialog(false);
                    await unloadWebLLMEngine();
                    setWebLLMEnabled(false);
                  }}
                >
                  Keep files
                </AlertDialogCancel>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 px-4"
                  onClick={async () => {
                    setShowWebLLMDeleteDialog(false);
                    await unloadWebLLMEngine();
                    await clearWebLLMCache();
                    setWebLLMEnabled(false);
                    toast.success('Model deleted. The downloaded AI model has been removed from this device.', {
                      description: 'If you turn the LLM back on (here or in the assistant), it will be redownloaded.',
                    });
                  }}
                >
                  Delete files
                </button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Receipt category: keyword vs AI */}
          {enabledModules.includes('receiptScanner') && (
            <div className="space-y-2 pt-2 border-t border-border">
              <h4 className="text-sm font-medium text-foreground">Receipt category</h4>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm text-foreground">Use keyword matching only</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    When checked, category is suggested from store names and keywords only (no AI). Can work better for some receipts.
                  </p>
                </div>
                <Checkbox
                  checked={receiptCategoryPreferRegex}
                  onCheckedChange={setReceiptCategoryPreferRegex}
                  aria-label="Use keyword matching only for receipt category"
                  className="size-5 shrink-0 rounded"
                />
              </div>
            </div>
          )}

        </CollapsibleContent>
      </Collapsible>
      </div>

      {/* Data Management (collapsible) */}
      <div id="settings-data">
      <Collapsible open={dataMgmtOpenLocal} onOpenChange={handleDataMgmtOpenChange} className="pt-4 border-t border-border">
        <CollapsibleTrigger
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3.5 text-left transition-all duration-200 hover:bg-primary/10 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer glass-card shadow-sm"
          aria-expanded={dataMgmtOpenLocal}
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
          {dataMgmtOpenLocal ? <ChevronUp className="h-5 w-5 shrink-0 text-primary" aria-hidden /> : <ChevronDown className="h-5 w-5 shrink-0 text-primary" aria-hidden />}
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
        <p className="text-xs text-muted-foreground">
          {isExternalBackupSupported()
            ? 'Autobackup: a copy is saved every 3 changes (on this device, or to a folder you choose in Chrome/Edge). You can also download a full backup anytime.'
            : 'Autobackup: a copy is saved on this device every 3 changes. Download a full backup anytime to save a file elsewhere (e.g. USB drive).'}
        </p>
        <p className="text-xs text-muted-foreground">
          We recommend storing backup files on an external storage device (e.g. USB drive or external disk) so you have a copy if this device is lost or replaced.
        </p>
        <p className="text-xs font-medium text-foreground">
          Save a full copy • Export numbers only • Replace from file
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer" htmlFor="settings-encrypt-backups">
            <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium">Encrypt backups</span>
            <Checkbox
              id="settings-encrypt-backups"
              checked={encryptBackups}
              onCheckedChange={(checked) => setEncryptBackups?.(checked)}
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
            Backup folder set. One file there is updated every 3 changes (in addition to the copy on this device).
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
            <button
              type="button"
              onClick={handleDownloadFullBackupClick}
              className={dataMgmtBtn}
            >
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
    </div>
  );
}
