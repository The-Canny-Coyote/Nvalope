/**
 * Section definitions for the app (core + optional modules).
 * useAppSections() builds the combined list for WheelMenu / SimpleListView.
 */

import React, { useMemo, lazy, Suspense, type ReactNode } from 'react';
import {
  Wallet,
  Accessibility,
  Settings,
  DollarSign,
  PieChart,
  Receipt,
  Archive,
  Calendar,
  BarChart3,
  History,
  Crown,
  BookOpen,
  Bot,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { OverviewContent } from '@/app/components/OverviewContent';
import { IncomeContent } from '@/app/components/IncomeContent';
import { EnvelopesExpensesContent } from '@/app/components/EnvelopesExpensesContent';
import { TransactionsContent } from '@/app/components/TransactionsContent';
import { AccessibilityContent } from '@/app/components/AccessibilityContent';
import type { AccessibilityMode } from '@/app/components/AccessibilityContent';
import { SettingsContent } from '@/app/components/SettingsContent';
import { CalendarContent } from '@/app/components/CalendarContent';
import { AnalyticsContent } from '@/app/components/AnalyticsContent';
import { ReceiptArchiveContent } from '@/app/components/ReceiptArchiveContent';
import { GlossaryContent } from '@/app/components/GlossaryContent';
import { AppErrorBoundary } from '@/app/components/AppErrorBoundary';

/** Wraps section content in an error boundary so one failing section does not crash the app. */
function SectionWithBoundary({ children, label }: { children: ReactNode; label: string }) {
  return (
    <AppErrorBoundary
      fallback={
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 p-4 text-center" role="alert" aria-live="assertive">
          <p className="text-sm font-medium text-foreground">{label} is temporarily unavailable. Try reloading the page.</p>
        </div>
      }
    >
      {children}
    </AppErrorBoundary>
  );
}

const ReceiptScannerContentLazy = lazy(() =>
  import('@/app/components/ReceiptScannerContent').then((m) => ({ default: m.ReceiptScannerContent }))
);

const receiptScannerFallback = (
  <div
    className="flex min-h-[40vh] flex-col items-center justify-center gap-4 bg-background p-6"
    role="alert"
    aria-live="assertive"
    aria-label="Receipt scanner error"
  >
    <p className="text-sm font-medium text-foreground text-center max-w-md">
      Receipt scanner failed. Try reloading the page.
    </p>
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      Reload
    </button>
  </div>
);

/** Section id for Cache the AI Assistant when shown as a card/slice (excluded from wheel; wheel uses center button). */
export const CACHE_ASSISTANT_SECTION_ID = 106;

export interface AppSection {
  id: number;
  icon: LucideIcon;
  /** When set, card/list layout shows this emoji instead of the icon (e.g. 🐺 for Cache the AI Assistant). */
  iconEmoji?: string;
  title: string;
  description: string;
  content: ReactNode;
  color: string;
}

export interface UseAppSectionsParams {
  enabledModules: string[];
  selectedMode: string;
  textSize: number;
  setTextSize: (v: number) => void;
  lineHeight: number;
  setLineHeight: (v: number) => void;
  letterSpacing: number;
  setLetterSpacing: (v: number) => void;
  layoutScale: number;
  setLayoutScale: (v: number) => void;
  wheelScale: number;
  setWheelScale: (v: number) => void;
  scrollbarSize: number;
  setScrollbarSize: (v: number) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  screenReaderMode: boolean;
  setScreenReaderMode: (v: boolean) => void;
  setSelectedMode: (mode: AccessibilityMode) => void;
  resetToDefaults: () => void;
  enableModule: (moduleId: string) => void;
  disableModule: (moduleId: string) => void;
  enableCache: () => void;
  onEnableAdvancedAICache: () => void;
  onChooseBackupFolder: () => void;
  /** Download full backup (budget + settings + appData) as a file. Pass optional password to encrypt. */
  onDownloadFullBackup: (password?: string) => void;
  /** When true, full backups are encrypted with the session password. */
  encryptBackups?: boolean;
  setEncryptBackups?: (v: boolean) => void;
  /** Ref to session backup password (for encrypted autobackup). */
  getBackupPasswordRef?: React.MutableRefObject<string | null>;
  setBackupPassword?: (p: string | null) => void;
  onCheckForUpdates: () => void;
  checkingForUpdate: boolean;
  onApplySettingsFromBackup: (settings: {
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
  isPremium?: boolean;
  /** Call before layout-changing updates (e.g. Chonkiness) so scroll can be restored. */
  saveScrollForRestore?: () => void;
  /** Call after layout has updated (e.g. after opening a collapsible) to restore main scroll position. */
  restoreScrollAfterLayout?: () => void;
  /** When true, Accessibility shows "Card bar size" instead of "Feature wheel size". */
  isMobile?: boolean;
  /** Card bar rows (when position is bottom): 0 = auto, 1–3 = fixed. */
  cardBarRows?: number;
  setCardBarRows?: (v: number) => void;
  /** Card bar columns (when position is left/right): 0 = auto, 1–3 = fixed. */
  cardBarColumns?: number;
  setCardBarColumns?: (v: number) => void;
  /** Card bar position: bottom, left, or right. */
  cardBarPosition?: 'bottom' | 'left' | 'right';
  setCardBarPosition?: (v: 'bottom' | 'left' | 'right') => void;
  /** When true, show row/column selector strip on card bar. */
  showCardBarRowSelector?: boolean;
  setShowCardBarRowSelector?: (v: boolean) => void;
  /** Cards section width 60–120%. */
  cardsSectionWidthPercent?: number;
  setCardsSectionWidthPercent?: (v: number) => void;
  /** Called when user should open the Cache AI Assistant (e.g. from card/simple list). */
  onOpenAssistant?: () => void;
  /** Optional features collapsible in Settings: open state and setter (lifted so it survives section list updates). */
  settingsOptionalFeaturesOpen?: boolean;
  setSettingsOptionalFeaturesOpen?: (open: boolean) => void;
  /** Core features / Data collapsibles in Settings: lifted so they stay open when toggling modules. */
  settingsCoreOpen?: boolean;
  setSettingsCoreOpen?: (open: boolean) => void;
  settingsDataMgmtOpen?: boolean;
  setSettingsDataMgmtOpen?: (open: boolean) => void;
  /** Accessibility section collapsibles: lifted so they stay open when changing sliders/presets. */
  accessibilityStandardOptionsOpen?: boolean;
  setAccessibilityStandardOptionsOpen?: (open: boolean) => void;
  accessibilityPresetModesOpen?: boolean;
  setAccessibilityPresetModesOpen?: (open: boolean) => void;
  /** When true, user has chosen a backup folder; show status in Data Management. */
  hasBackupFolder?: boolean | null;
  /** When user applies a preset mode, call to close the Accessibility panel so they see the home screen for that mode. */
  onCloseSection?: () => void;
  /** When true, the app is in card layout (bottom/side bar). Settings can show "Use section wheel" when true. */
  useCardLayout?: boolean;
  /** Switch from card layout back to section wheel. */
  setUseCardLayout?: (v: boolean) => void;
}

export function useAppSections(params: UseAppSectionsParams): AppSection[] {
  const {
    enabledModules,
    selectedMode,
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
    setSelectedMode,
    resetToDefaults,
    enableModule,
    disableModule,
    enableCache,
    onEnableAdvancedAICache,
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
  isPremium = false,
  saveScrollForRestore,
  restoreScrollAfterLayout,
  isMobile = false,
  cardBarRows = 0,
  setCardBarRows,
  cardBarColumns = 0,
  setCardBarColumns,
  cardBarPosition = 'bottom',
  setCardBarPosition,
  showCardBarRowSelector = true,
  setShowCardBarRowSelector,
  cardsSectionWidthPercent,
  setCardsSectionWidthPercent,
  onOpenAssistant,
  settingsOptionalFeaturesOpen = false,
  setSettingsOptionalFeaturesOpen,
  settingsCoreOpen = false,
  setSettingsCoreOpen,
  settingsDataMgmtOpen = false,
  setSettingsDataMgmtOpen,
  accessibilityStandardOptionsOpen = false,
  setAccessibilityStandardOptionsOpen,
  accessibilityPresetModesOpen = false,
  setAccessibilityPresetModesOpen,
  hasBackupFolder = null,
  onCloseSection,
  useCardLayout = false,
  setUseCardLayout,
} = params;

  return useMemo(() => {
  const allCoreCandidates: AppSection[] = [
    {
      id: 1,
      icon: PieChart,
      title: 'Overview',
      description: 'Bird\'s eye view of your entire budget. See total income, expenses, and how much is left across all envelopes.',
      color: '#2d7a3f',
      content: <SectionWithBoundary label="Overview"><OverviewContent /></SectionWithBoundary>,
    },
    {
      id: 2,
      icon: DollarSign,
      title: 'Income',
      description: 'Track your income sources and allocate funds to your envelopes. Record paychecks, side income, and other earnings.',
      color: '#2d7a3f',
      content: <SectionWithBoundary label="Income"><IncomeContent /></SectionWithBoundary>,
    },
    {
      id: 3,
      icon: Wallet,
      title: 'Envelopes & Expenses',
      description: 'Manage budget envelopes and add expenses. Track spending across categories in one place.',
      color: '#2d7a3f',
      content: <SectionWithBoundary label="Envelopes & Expenses"><EnvelopesExpensesContent /></SectionWithBoundary>,
    },
    {
      id: 4,
      icon: History,
      title: 'Transactions',
      description: 'View complete transaction history with search and filtering. Edit or delete past expenses.',
      color: '#2d7a3f',
      content: <SectionWithBoundary label="Transactions"><TransactionsContent /></SectionWithBoundary>,
    },
    {
      id: 5,
      icon: Accessibility,
      title: 'Accessibility',
      description: 'Customize the app for your needs. Choose preset accessibility modes or adjust individual settings.',
      color: '#8b6944',
      content: (
        <SectionWithBoundary label="Accessibility">
        <AccessibilityContent
          textSize={textSize}
          setTextSize={setTextSize}
          lineHeight={lineHeight}
          setLineHeight={setLineHeight}
          letterSpacing={letterSpacing}
          setLetterSpacing={setLetterSpacing}
          layoutScale={layoutScale}
          setLayoutScale={setLayoutScale}
          wheelScale={wheelScale}
          setWheelScale={setWheelScale}
          scrollbarSize={scrollbarSize}
          setScrollbarSize={(v) => {
            saveScrollForRestore?.();
            setScrollbarSize(v);
          }}
          reducedMotion={reducedMotion}
          setReducedMotion={setReducedMotion}
          highContrast={highContrast}
          setHighContrast={setHighContrast}
          screenReaderMode={screenReaderMode}
          setScreenReaderMode={setScreenReaderMode}
          selectedMode={selectedMode as AccessibilityMode}
          setSelectedMode={setSelectedMode}
          resetToDefaults={resetToDefaults}
          onPresetApplied={onCloseSection}
          isMobile={isMobile}
          cardBarRows={cardBarRows}
          setCardBarRows={setCardBarRows}
          cardBarColumns={cardBarColumns}
          setCardBarColumns={setCardBarColumns}
          cardBarPosition={cardBarPosition}
          setCardBarPosition={setCardBarPosition}
          showCardBarRowSelector={showCardBarRowSelector}
          setShowCardBarRowSelector={setShowCardBarRowSelector}
          cardsSectionWidthPercent={cardsSectionWidthPercent}
          setCardsSectionWidthPercent={setCardsSectionWidthPercent}
          standardOptionsOpen={accessibilityStandardOptionsOpen}
          onStandardOptionsOpenChange={setAccessibilityStandardOptionsOpen}
          presetModesOpen={accessibilityPresetModesOpen}
          onPresetModesOpenChange={setAccessibilityPresetModesOpen}
          saveScrollForRestore={saveScrollForRestore}
          restoreScrollAfterLayout={restoreScrollAfterLayout}
        />
        </SectionWithBoundary>
      ),
    },
  ];

  // Map each core candidate to its module ID (must match CORE_MODULE_IDS order in modules.ts)
  const coreModuleIdMap: Record<number, string> = {
    1: 'overview',
    2: 'income',
    3: 'envelopes',
    4: 'transactions',
    5: 'accessibility',
  };

  const coreSections = allCoreCandidates.filter(
    (s) => enabledModules.includes(coreModuleIdMap[s.id] ?? '')
  );

  // Settings is always visible (it's how you re-enable things)
  const settingsSection: AppSection = {
    id: 6,
    icon: Settings,
    title: 'Settings',
    description: 'Configure the app, manage data, and discover additional features you can enable.',
    color: '#8b6944',
    content: (
      <SectionWithBoundary label="Settings">
        <SettingsContent
          enabledModules={enabledModules}
          enableModule={enableModule}
          disableModule={disableModule}
          enableCache={enableCache}
          onEnableAdvancedAICache={onEnableAdvancedAICache}
          onChooseBackupFolder={onChooseBackupFolder}
          onDownloadFullBackup={onDownloadFullBackup}
          encryptBackups={encryptBackups}
          setEncryptBackups={setEncryptBackups}
          getBackupPasswordRef={getBackupPasswordRef}
          setBackupPassword={setBackupPassword}
          onCheckForUpdates={onCheckForUpdates}
          checkingForUpdate={checkingForUpdate}
          onApplySettingsFromBackup={onApplySettingsFromBackup}
          uiMode={uiMode}
          setUiMode={setUiMode}
          isPremium={isPremium}
          optionalFeaturesOpen={settingsOptionalFeaturesOpen}
          onOptionalFeaturesOpenChange={setSettingsOptionalFeaturesOpen}
          coreFeaturesOpen={settingsCoreOpen}
          onCoreFeaturesOpenChange={setSettingsCoreOpen}
          dataMgmtOpen={settingsDataMgmtOpen}
          onDataMgmtOpenChange={setSettingsDataMgmtOpen}
          hasBackupFolder={hasBackupFolder}
          saveScrollForRestore={saveScrollForRestore}
          restoreScrollAfterLayout={restoreScrollAfterLayout}
          useCardLayout={useCardLayout}
          setUseCardLayout={setUseCardLayout}
        />
      </SectionWithBoundary>
    ),
  };

  const moduleSections: AppSection[] = [
    ...(enabledModules.includes('receiptScanner')
      ? [
          {
            id: 100,
            icon: Receipt as LucideIcon,
            title: 'Receipt Scanner',
            description: 'Scan receipts to automatically extract and categorize expenses.',
            color: '#2d7a3f',
            content: (
              <AppErrorBoundary fallback={receiptScannerFallback}>
                <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
                  <ReceiptScannerContentLazy />
                </Suspense>
              </AppErrorBoundary>
            ),
          },
          {
            id: 103,
            icon: Archive as LucideIcon,
            title: 'Receipt Archive',
            description: 'View and manage saved receipt images and data.',
            color: '#2d7a3f',
            content: <SectionWithBoundary label="Receipt Archive"><ReceiptArchiveContent /></SectionWithBoundary>,
          },
        ]
      : []),
    ...(enabledModules.includes('calendar')
      ? [
          {
            id: 101,
            icon: Calendar as LucideIcon,
            title: 'Calendar',
            description: 'View your expenses and income on a calendar.',
            color: '#2d7a3f',
            content: <SectionWithBoundary label="Calendar"><CalendarContent highContrast={highContrast} screenReaderMode={screenReaderMode} /></SectionWithBoundary>,
          },
        ]
      : []),
    ...(enabledModules.includes('analytics')
      ? [
          {
            id: 102,
            icon: BarChart3 as LucideIcon,
            title: 'Analytics',
            description: 'Charts and spending insights.',
            color: '#2d7a3f',
            content: <SectionWithBoundary label="Analytics"><AnalyticsContent selectedMode={selectedMode as AccessibilityMode} /></SectionWithBoundary>,
          },
        ]
      : []),
    ...(enabledModules.includes('cacheAssistant')
      ? [
          {
            id: 106,
            icon: Bot as LucideIcon,
            iconEmoji: '🐺',
            title: 'Cache the AI Assistant',
            description: 'Smart insights and budgeting help. Ask about spending, envelopes, or how to add expenses.',
            color: '#2d7a3f',
            content: (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Cache the AI Assistant is your budget assistant. Ask questions about your spending, envelopes, or how to add expenses.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenAssistant?.()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span aria-hidden>🐺</span>
                  Open Cache the AI Assistant
                </button>
              </div>
            ),
          },
        ]
      : []),
    ...(enabledModules.includes('advancedAICache')
      ? [
          {
            id: 104,
            icon: Crown,
            title: 'Cache the AI Assistant (Advanced)',
            description: 'Predictive insights and smarter suggestions.',
            color: '#2d7a3f',
            content: (
              <div className="space-y-4">
                <h3 className="text-lg text-primary">Cache the AI Assistant (Advanced)</h3>
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 flex items-center gap-2">
                  <Crown className="w-6 h-6 text-primary shrink-0" aria-hidden />
                  <p className="text-sm text-foreground">
                    Predictive insights and advanced suggestions will appear here in a future update.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  This section is reserved for advanced features like spending predictions and smarter budget recommendations.
                </p>
              </div>
            ),
          },
        ]
      : []),
    ...(enabledModules.includes('glossary')
      ? [
          {
            id: 105,
            icon: BookOpen as LucideIcon,
            title: 'Glossary',
            description: 'Financial and privacy terms, how we design for fairness, and links to helpful resources.',
            color: '#8b6944',
            content: <SectionWithBoundary label="Glossary"><GlossaryContent /></SectionWithBoundary>,
          },
        ]
      : []),
  ];

  return [...coreSections, settingsSection, ...moduleSections];
  // Intentionally minimal deps to avoid rebuilding sections when card bar / backup setters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabledModules,
    selectedMode,
    textSize,
    lineHeight,
    letterSpacing,
    layoutScale,
    wheelScale,
    scrollbarSize,
    setScrollbarSize,
    reducedMotion,
    highContrast,
    screenReaderMode,
    setTextSize,
    setLineHeight,
    setLetterSpacing,
    setLayoutScale,
    setWheelScale,
    setReducedMotion,
    setHighContrast,
    setScreenReaderMode,
    setSelectedMode,
    resetToDefaults,
    enableModule,
    disableModule,
    enableCache,
    onEnableAdvancedAICache,
    onChooseBackupFolder,
    onDownloadFullBackup,
    onCheckForUpdates,
    checkingForUpdate,
    onApplySettingsFromBackup,
    uiMode,
    setUiMode,
    isPremium,
    saveScrollForRestore,
    isMobile,
    onOpenAssistant,
    settingsOptionalFeaturesOpen,
    setSettingsOptionalFeaturesOpen,
    settingsCoreOpen,
    setSettingsCoreOpen,
    settingsDataMgmtOpen,
    setSettingsDataMgmtOpen,
    accessibilityStandardOptionsOpen,
    setAccessibilityStandardOptionsOpen,
    accessibilityPresetModesOpen,
    setAccessibilityPresetModesOpen,
    hasBackupFolder,
  ]);
}
