import { Toaster, toast } from 'sonner';
import { delayedToast, setToastBlocking } from '@/app/services/delayedToast';
import { Progress } from '@/app/components/ui/progress';
import { AIChatSheet } from '@/app/components/AIChatSheet';
import { AppDialogs } from '@/app/components/AppDialogs';
import { useAppSections } from '@/app/sections/appSections';
import { fetchEntitlements, getApiBase, hasEntitlement, isPremiumFeatureEnabled } from '@/app/premium/entitlements';
import { BudgetProvider } from '@/app/store/BudgetContext';
import type { BudgetState } from '@/app/store/budgetTypes';
import type { FullBackupSnapshot } from '@/app/services/externalBackup';
import {
  scheduleBackup,
  isExternalBackupSupported,
  getBackupFolderHandle,
  downloadFullBackup,
  markBackupSuggestionDismissed,
  maybeShowBackupReminder,
} from '@/app/services/externalBackup';
import { getAppData, setAppData, setAppDataAfterWriteCallback } from '@/app/services/appDataIdb';
import type { AppData } from '@/app/services/appDataIdb';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { SystemNotificationDialog } from '@/app/components/SystemNotificationDialog';
import { TransactionFilterProvider } from '@/app/contexts/TransactionFilterContext';
import { HintProvider } from '@/app/contexts/HintContext';
import { TactileTouchEffect } from '@/app/components/TactileTouchEffect';
import { AppErrorBoundary } from '@/app/components/AppErrorBoundary';
import type { AccessibilityMode } from '@/app/components/AccessibilityContent';
import { MainContent } from '@/app/components/MainContent';
import { usePwaUpdate } from '@/app/hooks/usePwaUpdate';
import { useAccessibility } from '@/app/hooks/useAccessibility';
import { useAppBackup } from '@/app/hooks/useAppBackup';
import { useModules } from '@/app/hooks/useModules';
import { useScrollRestore } from '@/app/hooks/useScrollRestore';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { useNotificationQueue } from '@/app/hooks/useNotificationQueue';
import { useAppStore, getAppStoreSettingsSnapshot } from '@/app/store/appStore';
import { getModuleConfig } from '@/app/constants/modules';

const BACKUP_DEBOUNCE_MS = 2000;

const PREMIUM_AI_DOWNLOAD_NOTICE_SEEN_KEY = 'nvalope-premium-ai-download-notice-seen';
const UPDATES_ENVELOPE_DECIMALS_SEEN_KEY = 'nvalope-updates-envelope-decimals-seen';

export default function App() {
  const [showCacheAnimation, setShowCacheAnimation] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantFallbackToBasic, setAssistantFallbackToBasic] = useState(false);
  const [showAdvancedAIDownloadNotice, setShowAdvancedAIDownloadNotice] = useState(false);
  const [showUpdatesNotice, setShowUpdatesNotice] = useState(false);
  const [hasBackupFolder, setHasBackupFolder] = useState<boolean | null>(null);
  const [showBackupFolderPrompt, setShowBackupFolderPrompt] = useState(false);
  const [selectedWheelSection, setSelectedWheelSection] = useState<number | null>(null);
  const storeCardLayout = useAppStore((s) => s.useCardLayout);
  const setEncryptBackups = useAppStore((s) => s.setEncryptBackups);
  const cardBarRows = useAppStore((s) => s.cardBarRows);
  const setCardBarRows = useAppStore((s) => s.setCardBarRows);
  const cardBarColumns = useAppStore((s) => s.cardBarColumns);
  const setCardBarColumns = useAppStore((s) => s.setCardBarColumns);
  const cardBarPosition = useAppStore((s) => s.cardBarPosition);
  const setCardBarPosition = useAppStore((s) => s.setCardBarPosition);
  const showCardBarRowSelector = useAppStore((s) => s.showCardBarRowSelector);
  const cardsSectionWidthPercent = useAppStore((s) => s.cardsSectionWidthPercent);
  const setCardsSectionWidthPercent = useAppStore((s) => s.setCardsSectionWidthPercent);
  const setShowCardBarRowSelector = useAppStore((s) => s.setShowCardBarRowSelector);
  const uiMode = useAppStore((s) => s.uiMode);
  const setUiMode = useAppStore((s) => s.setUiMode);
  const [userLayoutOverride, setUserLayoutOverride] = useState<boolean | null>(null);
  const useCardLayout = userLayoutOverride !== null ? userLayoutOverride : storeCardLayout;
  const setUseCardLayout = useCallback((v: boolean) => {
    setUserLayoutOverride(v);
    useAppStore.getState().setUseCardLayout(v);
  }, []);

  const {
    updateAvailable,
    setUpdateAvailable,
    offlineReady,
    setOfflineReady,
    checkingForUpdate,
    checkForUpdates,
    handleUpdateReload,
  } = usePwaUpdate();

  const checkForUpdatesToastShownRef = useRef(false);
  const checkForUpdatesStartTimeRef = useRef<number>(0);
  const handleCheckForUpdates = useCallback(() => {
    checkForUpdatesToastShownRef.current = true;
    checkForUpdatesStartTimeRef.current = Date.now();
    toast.loading('Checking for updates…', {
      id: 'check-updates',
      description: React.createElement(Progress, { value: 0, className: 'mt-1.5 h-2.5 w-full min-w-[160px]' }),
    });
    checkForUpdates();
  }, [checkForUpdates]);
  useEffect(() => {
    if (!checkingForUpdate && checkForUpdatesToastShownRef.current) {
      checkForUpdatesToastShownRef.current = false;
      const elapsed = Date.now() - checkForUpdatesStartTimeRef.current;
      const minDisplayMs = 600;
      const delayDismiss = Math.max(0, minDisplayMs - elapsed);
      const dismissAndShowResult = () => {
        toast.dismiss('check-updates');
        if (!updateAvailable) toast.info("You're up to date.");
      };
      if (delayDismiss > 0) setTimeout(dismissAndShowResult, delayDismiss);
      else dismissAndShowResult();
    }
  }, [checkingForUpdate, updateAvailable]);

  const { mainScrollRef, scrollTopToRestoreRef, scrollHeightAtSaveRef, saveScrollForRestore } = useScrollRestore();
  const anchorRestoreRef = useRef<{ sectionId: number; offsetTop: number } | null>(null);
  const isMobile = useIsMobile();
  const sectionContentRef = useRef<HTMLDivElement | null>(null);
  const wrapWithScrollSave = useCallback(<T,>(setter: (v: T) => void) => (v: T) => {
    saveScrollForRestore();
    setter(v);
  }, [saveScrollForRestore]);

  /** Restore main scroll from saved position (used after Settings collapsibles open / layout changes). */
  const restoreScrollAfterLayout = useCallback(() => {
    const top = scrollTopToRestoreRef.current;
    if (top === null) return;
    scrollTopToRestoreRef.current = null;
    const main = mainScrollRef.current;
    if (!main) return;
    const maxScroll = main.scrollHeight - main.clientHeight;
    main.scrollTop = Math.min(top, Math.max(0, maxScroll));
  }, [mainScrollRef, scrollTopToRestoreRef]);

  const accessibility = useAccessibility({ onBeforeReset: saveScrollForRestore });
  const {
    textSize,
    setTextSize,
    lineHeight,
    setLineHeight,
    letterSpacing,
    setLetterSpacing,
    layoutScale,
    setLayoutScale,
    wheelScale,
    setWheelScale,
    scrollbarSize,
    setScrollbarSize,
    reducedMotion,
    setReducedMotion,
    highContrast,
    setHighContrast,
    screenReaderMode,
    setScreenReaderMode,
    selectedMode,
    setSelectedMode,
    resetToDefaults,
  } = accessibility;

  const { enabledModules, enableModule, disableModule, enableCache } = useModules({
    saveScrollForRestore,
    setShowCacheAnimation,
    onDisableAdvancedAICache: () => setAssistantFallbackToBasic(false),
  });

  // Save scroll and optional anchor before module toggle so restore effect keeps position when toggling features in Settings
  const saveScrollAndAnchorBeforeModuleToggle = useCallback(() => {
    saveScrollForRestore();
    const main = mainScrollRef.current;
    if (sectionContentRef.current != null && main != null && selectedWheelSection != null) {
      const section = sectionContentRef.current;
      const offsetInContent = section.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
      anchorRestoreRef.current = { sectionId: selectedWheelSection, offsetTop: offsetInContent };
    }
  }, [saveScrollForRestore, selectedWheelSection]);
  const enableModuleWithScrollSave = useCallback((id: string) => {
    saveScrollAndAnchorBeforeModuleToggle();
    enableModule(id);
  }, [saveScrollAndAnchorBeforeModuleToggle, enableModule]);
  const disableModuleWithScrollSave = useCallback((id: string) => {
    saveScrollAndAnchorBeforeModuleToggle();
    disableModule(id);
  }, [saveScrollAndAnchorBeforeModuleToggle, disableModule]);
  const enableCacheWithScrollSave = useCallback(() => {
    saveScrollAndAnchorBeforeModuleToggle();
    enableCache();
  }, [saveScrollAndAnchorBeforeModuleToggle, enableCache]);

  const [settingsOptionalFeaturesOpen, setSettingsOptionalFeaturesOpen] = useState(false);
  const [settingsCoreOpen, setSettingsCoreOpen] = useState(false);
  const [settingsDataMgmtOpen, setSettingsDataMgmtOpen] = useState(false);
  const [accessibilityStandardOptionsOpen, setAccessibilityStandardOptionsOpen] = useState(false);
  const [accessibilityPresetModesOpen, setAccessibilityPresetModesOpen] = useState(false);
  const setSettingsOptionalFeaturesOpenWithScrollSave = useCallback((open: boolean) => {
    if (open) {
      saveScrollAndAnchorBeforeModuleToggle();
    }
    setSettingsOptionalFeaturesOpen(open);
  }, [saveScrollAndAnchorBeforeModuleToggle]);

  const [entitlementsFromApi, setEntitlementsFromApi] = useState<Awaited<ReturnType<typeof fetchEntitlements>>>(null);
  useEffect(() => {
    fetchEntitlements().then(setEntitlementsFromApi);
  }, []);

  const apiConfigured = getApiBase().length > 0;
  const isPremium = isPremiumFeatureEnabled() && (
    apiConfigured
      ? entitlementsFromApi !== null && hasEntitlement('premium_full', entitlementsFromApi)
      : false
  );
  const effectiveEnabledModules = useMemo(
    () => (isPremium ? enabledModules : enabledModules.filter((id) => !getModuleConfig(id)?.premiumOnly)),
    [enabledModules, isPremium]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(display-mode: standalone)').matches) {
      try {
        localStorage.setItem('nvalopePWAInstalled', 'true');
      } catch {
        /* ignore */
      }
    }
  }, []);

  // One-time notice: envelope totals decimals fix
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(UPDATES_ENVELOPE_DECIMALS_SEEN_KEY) !== 'true') {
        setShowUpdatesNotice(true);
      }
    } catch {
      /* ignore */
    }
  }, []);
  const handleUpdatesNoticeClose = useCallback((open: boolean) => {
    if (!open) {
      try {
        localStorage.setItem(UPDATES_ENVELOPE_DECIMALS_SEEN_KEY, 'true');
      } catch {
        /* ignore */
      }
      setShowUpdatesNotice(false);
    }
  }, []);

  const budgetStateRef = useRef<BudgetState | null>(null);
  const isPremiumRef = useRef(isPremium);
  isPremiumRef.current = isPremium;

  const appDataRef = useRef<AppData>({ assistantMessages: [] });
  const [initialAssistantMessages, setInitialAssistantMessages] = useState<AppData['assistantMessages'] | null>(null);
  const onAssistantMessagesChange = useCallback((messages: AppData['assistantMessages']) => {
    appDataRef.current = { ...appDataRef.current, assistantMessages: messages };
    setInitialAssistantMessages(messages);
    setAppData(appDataRef.current).catch(() => delayedToast.error('Failed to save chat history'));
  }, []);

  useEffect(() => {
    if (!assistantOpen) return;
    const stateKey = 'nvalope-chat-open';
    window.history.pushState({ [stateKey]: true }, '');
    const onPopState = () => {
      setAssistantOpen(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [assistantOpen]);

  const getSnapshotRef = useRef<() => FullBackupSnapshot>(() => ({}));
  const getBackupSnapshot = useCallback(() => ({
    budget: budgetStateRef.current ?? {},
    settings: { ...getAppStoreSettingsSnapshot(), isPremium: isPremiumRef.current },
    premium: isPremiumRef.current ?? false,
    appData: appDataRef.current,
  }), []);
  getSnapshotRef.current = getBackupSnapshot;

  useEffect(() => {
    getAppData().then((data) => {
      appDataRef.current = data;
      setInitialAssistantMessages(data.assistantMessages);
      useAppStore.getState().setBudgetPeriodMode(data.budgetPeriodMode ?? 'monthly');
      useAppStore.getState().setBudgetPeriodModeSwitchDate(data.budgetPeriodModeSwitchDate ?? null);
      useAppStore.getState().setBiweeklyPeriod1StartDay(data.biweeklyPeriod1StartDay ?? 1);
      useAppStore.getState().setBiweeklyPeriod1EndDay(data.biweeklyPeriod1EndDay ?? 14);
      useAppStore.getState().setWeekStartDay(data.weekStartDay ?? 0);
    });
  }, []);

  const {
    notificationOpen,
    currentNotification,
    handleNotificationAcknowledge,
  } = useNotificationQueue();

  // Timer toasts only run after system-notification dialog is closed
  useEffect(() => {
    setToastBlocking(notificationOpen);
  }, [notificationOpen]);

  const backupPasswordRef = useRef<string | null>(null);
  const encryptBackups = useAppStore((s) => s.encryptBackups);
  const setBackupPassword = useCallback((p: string | null) => {
    backupPasswordRef.current = p;
  }, []);
  const { getBackupSnapshot: getBackupSnapshotStable, handleChooseBackupFolder } = useAppBackup({
    getSnapshotRef: getSnapshotRef,
    getBackupPasswordRef: backupPasswordRef,
    encryptBackups,
  });

  // When app data (receipts, chat, etc.) is saved, refresh snapshot ref and schedule backup
  useEffect(() => {
    const onAppDataWritten = () => {
      scheduleBackup();
      getAppData().then((data) => {
        appDataRef.current = data;
        useAppStore.getState().setBudgetPeriodMode(data.budgetPeriodMode ?? 'monthly');
        useAppStore.getState().setBudgetPeriodModeSwitchDate(data.budgetPeriodModeSwitchDate ?? null);
        useAppStore.getState().setBiweeklyPeriod1StartDay(data.biweeklyPeriod1StartDay ?? 1);
        useAppStore.getState().setBiweeklyPeriod1EndDay(data.biweeklyPeriod1EndDay ?? 14);
        useAppStore.getState().setWeekStartDay(data.weekStartDay ?? 0);
      });
    };
    setAppDataAfterWriteCallback(onAppDataWritten);
    return () => setAppDataAfterWriteCallback(null);
  }, []);

  // Schedule backup only when user changes a setting (not on initial mount / rehydration)
  const settingsBackupSkippedMountRef = useRef(false);
  useEffect(() => {
    if (!settingsBackupSkippedMountRef.current) {
      settingsBackupSkippedMountRef.current = true;
      return;
    }
    const t = setTimeout(() => scheduleBackup(), BACKUP_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [enabledModules, selectedMode, textSize, reducedMotion, highContrast, screenReaderMode, lineHeight, letterSpacing, layoutScale, wheelScale, isPremium]);

  const handleBudgetSaved = useCallback(() => {
    scheduleBackup();
  }, []);

  const handleDownloadFullBackup = useCallback(async (password?: string) => {
    if (password) backupPasswordRef.current = password;
    toast.loading('Preparing backup…', {
      id: 'backup-download',
      description: React.createElement(Progress, { value: 0, className: 'mt-1.5 h-2.5 w-full min-w-[160px]' }),
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        try {
          await downloadFullBackup(getBackupSnapshotStable(), { password });
          toast.loading('Preparing backup…', {
            id: 'backup-download',
            description: React.createElement(Progress, { value: 100, className: 'mt-1.5 h-2.5 w-full min-w-[160px]' }),
          });
          setTimeout(() => {
            toast.success('Backup ready. Choose where to save the file.', { id: 'backup-download' });
          }, 300);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'We couldn\'t create the backup. Please try again.', { id: 'backup-download' });
        }
      });
    });
  }, [getBackupSnapshotStable]);

  // Restore scroll position after module enable/disable or accessibility toggles so the view doesn’t move.
  useLayoutEffect(() => {
    const main = mainScrollRef.current;
    const section = sectionContentRef.current;
    const anchor = anchorRestoreRef.current;
    const savedTop = scrollTopToRestoreRef.current;

    let top: number | null = null;
    if (anchor != null && section != null && main != null && savedTop != null) {
      const sectionRect = section.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const saveOffset = anchor.offsetTop - savedTop;
      const desiredScrollTop = sectionRect.top - mainRect.top + main.scrollTop - saveOffset;
      const maxScroll = main.scrollHeight - main.clientHeight;
      top = Math.min(Math.max(0, desiredScrollTop), maxScroll);
      scrollTopToRestoreRef.current = top;
      anchorRestoreRef.current = null;
    } else if (savedTop != null) {
      top = savedTop;
      scrollTopToRestoreRef.current = null;
    }
    if (top === null) return;

    const runRestore = () => {
      const el = mainScrollRef.current;
      if (!el) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      el.scrollTop = Math.min(top!, Math.max(0, maxScroll));
    };
    runRestore();
    const id = requestAnimationFrame(() => {
      runRestore();
      requestAnimationFrame(() => {
        runRestore();
        requestAnimationFrame(runRestore);
      });
    });
    const t0 = setTimeout(runRestore, 0);
    const t1 = setTimeout(runRestore, 50);
    const t2 = setTimeout(runRestore, 150);
    const t3 = setTimeout(runRestore, 280);
    const t4 = setTimeout(runRestore, 400);
    const t5 = setTimeout(runRestore, 600);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs stable; restore on section/layout change only
  }, [enabledModules, textSize, lineHeight, letterSpacing, layoutScale, wheelScale, scrollbarSize, reducedMotion, highContrast, screenReaderMode, selectedMode, uiMode, settingsOptionalFeaturesOpen]);

  // Intentionally no scroll-into-view on section select: the page stays at its current position when a slice or card is clicked.

  // When Advanced AI is no longer enabled, clear fallback state
  useEffect(() => {
    if (!effectiveEnabledModules.includes('advancedAICache')) setAssistantFallbackToBasic(false);
  }, [effectiveEnabledModules]);

  // Know whether user has a backup folder (for reminder and dialogs)
  useEffect(() => {
    let cancelled = false;
    getBackupFolderHandle().then((handle) => {
      if (!cancelled) setHasBackupFolder(!!handle);
    });
    return () => {
      cancelled = true;
    };
  }, [showAdvancedAIDownloadNotice]);

  // Periodic backup reminder as toast when no folder is set (throttled to every 3 days inside maybeShowBackupReminder)
  useEffect(() => {
    if (hasBackupFolder !== false) return;
    maybeShowBackupReminder((msg) => toast.info(msg, { duration: 6000 }));
  }, [hasBackupFolder]);

  // Also suggest backup when user opens Settings (reasonable opportunity; same 3-day throttle applies)
  useEffect(() => {
    if (selectedWheelSection !== 6 || hasBackupFolder !== false) return;
    maybeShowBackupReminder((msg) => toast.info(msg, { duration: 6000 }));
  }, [selectedWheelSection, hasBackupFolder]);

  const handleEnableAdvancedAICacheClick = () => {
    if (!isPremium) return;
    try {
      if (localStorage.getItem(PREMIUM_AI_DOWNLOAD_NOTICE_SEEN_KEY) === 'true') {
        enableModule('advancedAICache');
        return;
      }
    } catch {
      // ignore
    }
    setShowAdvancedAIDownloadNotice(true);
  };

  const handleAdvancedAIDownloadNoticeAck = () => {
    if (!isPremium) return;
    try {
      localStorage.setItem(PREMIUM_AI_DOWNLOAD_NOTICE_SEEN_KEY, 'true');
    } catch {
      // ignore
    }
    enableModule('advancedAICache');
    setShowAdvancedAIDownloadNotice(false);
  };

  const allSections = useAppSections({
    enabledModules: effectiveEnabledModules,
    settingsOptionalFeaturesOpen,
    setSettingsOptionalFeaturesOpen: setSettingsOptionalFeaturesOpenWithScrollSave,
    settingsCoreOpen,
    setSettingsCoreOpen,
    settingsDataMgmtOpen,
    setSettingsDataMgmtOpen,
    accessibilityStandardOptionsOpen,
    setAccessibilityStandardOptionsOpen,
    accessibilityPresetModesOpen,
    setAccessibilityPresetModesOpen,
    selectedMode,
    isMobile,
    textSize,
    setTextSize: wrapWithScrollSave(setTextSize),
    lineHeight,
    setLineHeight: wrapWithScrollSave(setLineHeight),
    letterSpacing,
    setLetterSpacing: wrapWithScrollSave(setLetterSpacing),
    layoutScale,
    setLayoutScale: wrapWithScrollSave(setLayoutScale),
    wheelScale,
    setWheelScale: wrapWithScrollSave(setWheelScale),
    cardBarRows,
    setCardBarRows,
    cardBarColumns,
    setCardBarColumns,
    cardBarPosition,
    setCardBarPosition,
    showCardBarRowSelector,
    setShowCardBarRowSelector,
    cardsSectionWidthPercent,
    setCardsSectionWidthPercent,
    scrollbarSize,
    setScrollbarSize,
    reducedMotion,
    setReducedMotion: wrapWithScrollSave(setReducedMotion),
    highContrast,
    setHighContrast: wrapWithScrollSave(setHighContrast),
    screenReaderMode,
    setScreenReaderMode: wrapWithScrollSave(setScreenReaderMode),
    setSelectedMode: wrapWithScrollSave(setSelectedMode),
    resetToDefaults,
    onCloseSection: () => setSelectedWheelSection(null),
    enableModule: enableModuleWithScrollSave,
    disableModule: disableModuleWithScrollSave,
    enableCache: enableCacheWithScrollSave,
    onEnableAdvancedAICache: handleEnableAdvancedAICacheClick,
    onChooseBackupFolder: handleChooseBackupFolder,
    onDownloadFullBackup: handleDownloadFullBackup,
    encryptBackups,
    setEncryptBackups,
    getBackupPasswordRef: backupPasswordRef,
    setBackupPassword,
    onCheckForUpdates: handleCheckForUpdates,
    checkingForUpdate,
    onApplySettingsFromBackup: ({ layoutScale: ls, wheelScale: ws, cardBarRows: cbr, cardBarColumns: cbc, cardBarPosition: cbp, cardBarSectionOrder: cbo, showCardBarRowSelector: scbr, cardsSectionWidthPercent: csw }) => {
      if (ls !== undefined) setLayoutScale(ls);
      if (ws !== undefined) setWheelScale(ws);
      if (cbr !== undefined) useAppStore.getState().setCardBarRows(cbr);
      if (cbc !== undefined) useAppStore.getState().setCardBarColumns(cbc);
      if (cbp !== undefined) useAppStore.getState().setCardBarPosition(cbp);
      if (cbo !== undefined) useAppStore.getState().setCardBarSectionOrder(cbo);
      if (scbr !== undefined) useAppStore.getState().setShowCardBarRowSelector(scbr);
      if (csw !== undefined) useAppStore.getState().setCardsSectionWidthPercent(csw);
      useAppStore.getState().setUiMode('normal');
    },
    uiMode,
    setUiMode: wrapWithScrollSave(setUiMode),
    isPremium,
    saveScrollForRestore,
    restoreScrollAfterLayout,
    onOpenAssistant: () => setAssistantOpen(true),
    hasBackupFolder,
    useCardLayout,
    setUseCardLayout,
  });

  const handleWheelSectionChange = useCallback((id: number | null) => {
    setSelectedWheelSection(id);
  }, []);
  const switchToTransactionsSection = useCallback(() => handleWheelSectionChange(4), [handleWheelSectionChange]);

  return (
    <TransactionFilterProvider onSwitchToTransactions={switchToTransactionsSection}>
    <HintProvider>
    {/* Accessibility modes via root classes; CSS vars applied to :root in real time by useAccessibility for smooth slider updates. */}
    <div
      data-testid="app"
      className={`min-h-0 flex-1 flex flex-col bg-background relative ${
        selectedMode === 'focus' ? 'accessibility-focus-mode' :
        selectedMode === 'calm' ? 'accessibility-calm-mode' :
        selectedMode === 'clear' ? 'accessibility-clear-mode' :
        selectedMode === 'contrast' ? 'accessibility-contrast-mode' :
        selectedMode === 'tactile' ? 'accessibility-tactile-mode' :
        ''
      } ${reducedMotion ? 'accessibility-reduced-motion' : ''} ${highContrast ? 'accessibility-high-contrast' : ''} ${screenReaderMode ? 'accessibility-screen-reader-mode' : ''}`}
      role="application"
      aria-label="Nvalope budget app"
    >
      <a
        href="#main-content"
        className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 [clip:rect(0,0,0,0)] focus-visible:clip-auto focus-visible:w-auto focus-visible:h-auto focus-visible:p-4 focus-visible:m-0 focus-visible:overflow-visible focus-visible:whitespace-normal focus-visible:left-4 focus-visible:top-4 focus-visible:z-[9999] focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:rounded-lg focus-visible:border-2 focus-visible:border-primary"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>
      <TactileTouchEffect active={selectedMode === 'tactile'} />
      <Toaster position="bottom-right" richColors closeButton expand visibleToasts={9} gap={16} />
      <SystemNotificationDialog
        open={notificationOpen}
        message={currentNotification}
        onAcknowledge={handleNotificationAcknowledge}
      />
      <AppDialogs
        showBackupFolderPrompt={showBackupFolderPrompt}
        onBackupFolderPromptOpenChange={setShowBackupFolderPrompt}
        onBackupChooseFolder={handleChooseBackupFolder}
        onBackupNoThanks={() => {
          markBackupSuggestionDismissed();
          delayedToast.info('A backup copy is saved every 3 changes. You can set a backup folder or download a backup in Settings → Data Management.');
        }}
        updateAvailable={updateAvailable}
        onUpdateAvailableOpenChange={setUpdateAvailable}
        onUpdateReload={handleUpdateReload}
        offlineReady={offlineReady}
        onOfflineReadyOpenChange={setOfflineReady}
        showAdvancedAIDownloadNotice={showAdvancedAIDownloadNotice}
        onAdvancedAIDownloadNoticeOpenChange={setShowAdvancedAIDownloadNotice}
        onAdvancedAIDownloadNoticeAck={handleAdvancedAIDownloadNoticeAck}
        hasBackupFolder={hasBackupFolder}
        isExternalBackupSupported={isExternalBackupSupported()}
        showUpdatesNotice={showUpdatesNotice}
        onUpdatesNoticeOpenChange={handleUpdatesNoticeClose}
      />
      <BudgetProvider
        budgetStateRef={budgetStateRef}
        onBudgetSaved={handleBudgetSaved}
        onLoadError={(msg) => delayedToast.error(msg)}
      >
        <AIChatSheet
          open={assistantOpen}
          onOpenChange={setAssistantOpen}
          aiMode={effectiveEnabledModules.includes('advancedAICache') && !assistantFallbackToBasic ? 'advanced' : 'basic'}
          onFallbackToBasic={effectiveEnabledModules.includes('advancedAICache') ? () => setAssistantFallbackToBasic(true) : undefined}
          fallbackReason={assistantFallbackToBasic ? 'You switched to Basic AI. You can turn Advanced AI back on in Settings.' : undefined}
          initialMessages={initialAssistantMessages ?? undefined}
          onMessagesChange={onAssistantMessagesChange}
        />
        <AppErrorBoundary>
          <MainContent
            mainScrollRef={mainScrollRef}
            sectionContentRef={sectionContentRef}
            allSections={allSections}
            selectedMode={selectedMode}
            setSelectedMode={(mode) => setSelectedMode(mode as AccessibilityMode)}
            selectedWheelSection={selectedWheelSection}
            setSelectedWheelSection={handleWheelSectionChange}
            onCloseSection={() => setSelectedWheelSection(null)}
            saveScrollForRestore={saveScrollForRestore}
            wheelScale={wheelScale}
            enabledModules={effectiveEnabledModules}
            showCacheAnimation={showCacheAnimation}
            setAssistantOpen={setAssistantOpen}
            isMobile={isMobile}
            useCardLayout={useCardLayout}
            setUseCardLayout={setUseCardLayout}
          />
        </AppErrorBoundary>
      </BudgetProvider>
      </div>
    </HintProvider>
      </TransactionFilterProvider>
  );
}
