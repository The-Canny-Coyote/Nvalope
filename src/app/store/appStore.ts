import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AccessibilityMode } from '@/app/components/AccessibilityContent';
import {
  TEXT_SIZE_DEFAULT,
  LINE_HEIGHT_DEFAULT,
  LETTER_SPACING_DEFAULT,
  LAYOUT_SCALE_DEFAULT,
  WHEEL_SCALE_DEFAULT,
  SCROLLBAR_SIZE_DEFAULT,
  CARD_BAR_ROWS_DEFAULT,
  CARD_BAR_COLUMNS_DEFAULT,
  CARDS_SECTION_WIDTH_DEFAULT,
  clampTextSize,
  clampLineHeight,
  clampLetterSpacing,
  clampLayoutScale,
  clampWheelScale,
  clampScrollbarSize,
  clampCardBarRows,
  clampCardBarColumns,
  clampCardsSectionWidth,
} from '@/app/constants/accessibility';
import { CORE_MODULE_IDS } from '@/app/constants/modules';

const PERSIST_KEY = 'nvalope-app-persist';
const COLORBLIND_MODE_KEY = 'nvalope-colorblind-mode';

export type ColorblindMode = 'none' | 'deuteranopia' | 'tritanopia' | 'monochromacy';

function isColorblindMode(v: unknown): v is ColorblindMode {
  return v === 'none' || v === 'deuteranopia' || v === 'tritanopia' || v === 'monochromacy';
}

function readColorblindModeFromStorage(): ColorblindMode {
  try {
    if (typeof window === 'undefined') return 'none';
    const raw = localStorage.getItem(COLORBLIND_MODE_KEY);
    if (isColorblindMode(raw)) return raw;
  } catch {
    /* ignore */
  }
  return 'none';
}

function getInitialPersisted(): {
  layoutScale: number;
  wheelScale: number;
  isPremiumLocal: boolean;
  webLLMEnabled: boolean;
  useCardLayout: boolean;
  colorblindMode: ColorblindMode;
} {
  try {
    if (typeof window === 'undefined') {
      return {
        layoutScale: LAYOUT_SCALE_DEFAULT,
        wheelScale: WHEEL_SCALE_DEFAULT,
        isPremiumLocal: false,
        webLLMEnabled: false,
        useCardLayout: true,
        colorblindMode: 'none',
      };
    }
    const layout = localStorage.getItem('nvalope-layout-scale');
    const wheel = localStorage.getItem('nvalope-wheel-scale');
    const premium = localStorage.getItem('nvalope-premium');
    return {
      layoutScale: layout
        ? clampLayoutScale(Number.parseInt(layout, 10) || LAYOUT_SCALE_DEFAULT)
        : LAYOUT_SCALE_DEFAULT,
      wheelScale: wheel
        ? clampWheelScale(Number.parseInt(wheel, 10) || WHEEL_SCALE_DEFAULT)
        : WHEEL_SCALE_DEFAULT,
      isPremiumLocal: premium === 'true',
      webLLMEnabled: false,
      useCardLayout: true,
      colorblindMode: readColorblindModeFromStorage(),
    };
  } catch {
    return {
      layoutScale: LAYOUT_SCALE_DEFAULT,
      wheelScale: WHEEL_SCALE_DEFAULT,
      isPremiumLocal: false,
      webLLMEnabled: false,
      useCardLayout: true,
      colorblindMode: 'none',
    };
  }
}

export interface AppState {
  enabledModules: string[];
  selectedMode: AccessibilityMode;
  textSize: number;
  reducedMotion: boolean;
  highContrast: boolean;
  screenReaderMode: boolean;
  lineHeight: number;
  letterSpacing: number;
  layoutScale: number;
  wheelScale: number;
  scrollbarSize: number;
  isPremiumLocal: boolean;
  webLLMEnabled: boolean;
  /** When true, assistant uses local LLM when available; when false, assistant uses rule-based only (persisted). */
  assistantUseLLM: boolean;
  /** Desktop: use card layout instead of wheel (persisted). */
  useCardLayout: boolean;
  /** Card bar rows: 0 = auto, 1–3 = fixed (persisted). */
  cardBarRows: number;
  /** Card bar columns when position is left/right: 0 = auto, 1–3 = fixed (persisted). */
  cardBarColumns: number;
  /** Card bar position: bottom (horizontal), left or right (vertical) (persisted). */
  cardBarPosition: 'bottom' | 'left' | 'right';
  /** When true, the whole card bar (selector + tabs) is minimized to a strip (persisted). */
  cardBarMinimized: boolean;
  /** When true, the card bar stays expanded (hover won't collapse it); user can lock from the bar (persisted). */
  cardBarLockExpanded: boolean;
  /** Section ids in display order for card bar; null = default order (persisted). */
  cardBarSectionOrder: number[] | null;
  /** When true, show the row/column selector strip on the card bar (persisted). Can be toggled in Settings → Accessibility. */
  showCardBarRowSelector: boolean;
  /** Cards section width 60–120%: bottom bar max-width % of viewport; left/right bar width as % of 72px (persisted). */
  cardsSectionWidthPercent: number;
  /** Show grid background on main screen (persisted). Turn off to reduce distraction for focus/accessibility. */
  showGridBackground: boolean;
  /** Color vision adjustment (persisted; separate from preset accessibility modes). */
  colorblindMode: 'none' | 'deuteranopia' | 'tritanopia' | 'monochromacy';
  /** When true, title card shows only "Nvalope™" and a chevron to expand. Persisted. */
  titleAreaMinimized: boolean;
  /** When true, Support / Buy me a coffee block is minimized to a single row with chevron to expand. Persisted. */
  supportBlockMinimized: boolean;
  /** When true, storage capacity bar at bottom is minimized to a single row with chevron to expand. Persisted. */
  storageBarMinimized: boolean;
  /** When true, section wheel is minimized to a single row with chevron to expand. Persisted. */
  wheelMinimized: boolean;
  /** When true, full backups (folder and download) are encrypted with the session password. Persisted. */
  encryptBackups: boolean;
  /** Budget period: monthly, biweekly, or weekly. Synced from app data (set in Envelopes tab). */
  budgetPeriodMode: 'monthly' | 'biweekly' | 'weekly';
  /** When user chose "monthly from now on" when switching from biweekly/weekly; dates before this still use previous mode for past view. */
  budgetPeriodModeSwitchDate: string | null;
  /** When switching to monthly "from now on", remember which mode we were using for historical dates. */
  previousBudgetPeriodMode: 'biweekly' | 'weekly' | null;
  /** Biweekly only: first day of period 1 (1–31). Synced from app data. */
  biweeklyPeriod1StartDay: number;
  /** Biweekly only: last day of period 1 (1–31). Period 2 starts the next day. Synced from app data. */
  biweeklyPeriod1EndDay: number;
  /** Weekly only: 0 = Sunday, 1 = Monday. Synced from app data. */
  weekStartDay: number;
  // Actions
  setEnabledModules: (next: string[] | ((prev: string[]) => string[])) => void;
  setSelectedMode: (mode: AccessibilityMode) => void;
  setTextSize: (v: number) => void;
  setReducedMotion: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setScreenReaderMode: (v: boolean) => void;
  setLineHeight: (v: number) => void;
  setLetterSpacing: (v: number) => void;
  setLayoutScale: (v: number) => void;
  setWheelScale: (v: number) => void;
  setScrollbarSize: (v: number) => void;
  setPremiumLocal: (v: boolean) => void;
  setWebLLMEnabled: (v: boolean) => void;
  setAssistantUseLLM: (v: boolean) => void;
  setUseCardLayout: (v: boolean) => void;
  setCardBarRows: (v: number) => void;
  setCardBarColumns: (v: number) => void;
  setCardBarPosition: (v: 'bottom' | 'left' | 'right') => void;
  setCardBarMinimized: (v: boolean) => void;
  setCardBarLockExpanded: (v: boolean) => void;
  setCardBarSectionOrder: (order: number[] | null) => void;
  setShowCardBarRowSelector: (v: boolean) => void;
  setCardsSectionWidthPercent: (v: number) => void;
  setShowGridBackground: (v: boolean) => void;
  setColorblindMode: (v: 'none' | 'deuteranopia' | 'tritanopia' | 'monochromacy') => void;
  setTitleAreaMinimized: (v: boolean) => void;
  setSupportBlockMinimized: (v: boolean) => void;
  setStorageBarMinimized: (v: boolean) => void;
  setWheelMinimized: (v: boolean) => void;
  setEncryptBackups: (v: boolean) => void;
  setBudgetPeriodMode: (mode: 'monthly' | 'biweekly' | 'weekly') => void;
  setBudgetPeriodModeSwitchDate: (date: string | null) => void;
  setPreviousBudgetPeriodMode: (mode: 'biweekly' | 'weekly' | null) => void;
  setBiweeklyPeriod1StartDay: (day: number) => void;
  setBiweeklyPeriod1EndDay: (day: number) => void;
  setWeekStartDay: (day: number) => void;
}

const initialPersisted = getInitialPersisted();

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      enabledModules: CORE_MODULE_IDS,
      selectedMode: 'standard',
      textSize: TEXT_SIZE_DEFAULT,
      reducedMotion: false,
      highContrast: false,
      screenReaderMode: false,
      lineHeight: LINE_HEIGHT_DEFAULT,
      letterSpacing: LETTER_SPACING_DEFAULT,
      layoutScale: initialPersisted.layoutScale,
      wheelScale: initialPersisted.wheelScale,
      scrollbarSize: SCROLLBAR_SIZE_DEFAULT,
      isPremiumLocal: initialPersisted.isPremiumLocal,
      webLLMEnabled: false,
      assistantUseLLM: true,
      useCardLayout: initialPersisted.useCardLayout,
      cardBarRows: CARD_BAR_ROWS_DEFAULT,
      cardBarColumns: CARD_BAR_COLUMNS_DEFAULT,
      cardBarPosition: 'bottom',
      cardBarMinimized: false,
      cardBarLockExpanded: false,
      cardBarSectionOrder: null,
      showCardBarRowSelector: true,
      cardsSectionWidthPercent: CARDS_SECTION_WIDTH_DEFAULT,
      showGridBackground: true,
      colorblindMode: 'none',
      titleAreaMinimized: false,
      supportBlockMinimized: false,
      storageBarMinimized: false,
      wheelMinimized: false,
      encryptBackups: false,
      budgetPeriodMode: 'monthly',
      budgetPeriodModeSwitchDate: null,
      previousBudgetPeriodMode: null,
      biweeklyPeriod1StartDay: 1,
      biweeklyPeriod1EndDay: 14,
      weekStartDay: 0,

      setEnabledModules: (next) =>
        set((s) => ({
          enabledModules: typeof next === 'function' ? next(s.enabledModules) : next,
        })),
      setSelectedMode: (mode) => set({ selectedMode: mode }),
      setTextSize: (v) => set({ textSize: clampTextSize(v) }),
      setReducedMotion: (v) => set({ reducedMotion: v }),
      setHighContrast: (v) => set({ highContrast: v }),
      setScreenReaderMode: (v) => set({ screenReaderMode: v }),
      setLineHeight: (v) => set({ lineHeight: clampLineHeight(v) }),
      setLetterSpacing: (v) => set({ letterSpacing: clampLetterSpacing(v) }),
      setLayoutScale: (v) => set({ layoutScale: clampLayoutScale(v) }),
      setWheelScale: (v) => set({ wheelScale: clampWheelScale(v) }),
      setScrollbarSize: (v) => set({ scrollbarSize: clampScrollbarSize(v) }),
      setPremiumLocal: (v) => set({ isPremiumLocal: v }),
      setWebLLMEnabled: (v) => set({ webLLMEnabled: v }),
      setAssistantUseLLM: (v) => set({ assistantUseLLM: v }),
      setUseCardLayout: (v) => set({ useCardLayout: v }),
      setCardBarRows: (v) => set({ cardBarRows: clampCardBarRows(v) }),
      setCardBarColumns: (v) => set({ cardBarColumns: clampCardBarColumns(v) }),
      setCardBarPosition: (v) => set({ cardBarPosition: v }),
      setCardBarMinimized: (v) => set({ cardBarMinimized: v }),
      setCardBarLockExpanded: (v) => set({ cardBarLockExpanded: v }),
      setCardBarSectionOrder: (order) => set({ cardBarSectionOrder: order }),
      setShowCardBarRowSelector: (v) => set({ showCardBarRowSelector: v === true }),
      setCardsSectionWidthPercent: (v) => set({ cardsSectionWidthPercent: clampCardsSectionWidth(v) }),
      setShowGridBackground: (v) => set({ showGridBackground: v }),
      setColorblindMode: (v) => set({ colorblindMode: v }),
      setTitleAreaMinimized: (v) => set({ titleAreaMinimized: v }),
      setSupportBlockMinimized: (v) => set({ supportBlockMinimized: v }),
      setStorageBarMinimized: (v) => set({ storageBarMinimized: v }),
      setWheelMinimized: (v) => set({ wheelMinimized: v }),
      setEncryptBackups: (v) => set({ encryptBackups: v }),
      setBudgetPeriodMode: (mode) =>
        set((s) => {
          const currentMode = s.budgetPeriodMode;
          const next: Partial<AppState> = { budgetPeriodMode: mode };
          if (mode === 'monthly' && (currentMode === 'biweekly' || currentMode === 'weekly')) {
            next.previousBudgetPeriodMode = currentMode;
          } else if (currentMode === 'monthly' && mode !== 'monthly') {
            next.previousBudgetPeriodMode = null;
          }
          return next;
        }),
      setBudgetPeriodModeSwitchDate: (date) => set({ budgetPeriodModeSwitchDate: date }),
      setPreviousBudgetPeriodMode: (mode) => set({ previousBudgetPeriodMode: mode }),
      setBiweeklyPeriod1StartDay: (day) => set({ biweeklyPeriod1StartDay: Math.min(31, Math.max(1, day)) }),
      setBiweeklyPeriod1EndDay: (day) => set({ biweeklyPeriod1EndDay: Math.min(31, Math.max(1, day)) }),
      setWeekStartDay: (day) => set({ weekStartDay: day === 1 ? 1 : 0 }),
    }),
    {
      name: PERSIST_KEY,
      partialize: (s) => ({
        enabledModules: s.enabledModules,
        layoutScale: s.layoutScale,
        wheelScale: s.wheelScale,
        isPremiumLocal: s.isPremiumLocal,
        webLLMEnabled: s.webLLMEnabled,
        assistantUseLLM: s.assistantUseLLM,
        useCardLayout: s.useCardLayout,
        cardBarRows: s.cardBarRows,
        cardBarColumns: s.cardBarColumns,
        cardBarPosition: s.cardBarPosition,
        cardBarMinimized: s.cardBarMinimized,
        cardBarLockExpanded: s.cardBarLockExpanded,
        cardBarSectionOrder: s.cardBarSectionOrder,
        showCardBarRowSelector: s.showCardBarRowSelector,
        cardsSectionWidthPercent: s.cardsSectionWidthPercent,
        showGridBackground: s.showGridBackground,
        colorblindMode: s.colorblindMode,
        titleAreaMinimized: s.titleAreaMinimized,
        supportBlockMinimized: s.supportBlockMinimized,
        storageBarMinimized: s.storageBarMinimized,
        wheelMinimized: s.wheelMinimized,
        encryptBackups: s.encryptBackups,
        previousBudgetPeriodMode: s.previousBudgetPeriodMode,
      }),
      // Merge persisted enabledModules with core IDs so core features are always on by default
      // even for users who have an older persisted state without the new core module IDs.
      merge: (persisted, current) => {
        const raw = persisted as Partial<typeof current> | { state?: Partial<typeof current> };
        const p = 'state' in raw && raw.state && typeof raw.state === 'object' ? raw.state : (raw as Partial<typeof current>);
        const persistedModules: string[] = Array.isArray(p.enabledModules) ? p.enabledModules : [];
        const merged = Array.from(new Set([...CORE_MODULE_IDS, ...persistedModules]));
        const colorblindMode = isColorblindMode(p.colorblindMode)
          ? p.colorblindMode
          : readColorblindModeFromStorage();
        return { ...current, ...p, enabledModules: merged, colorblindMode };
      },
    }
  )
);

// Persist colorblind mode to its own localStorage key (alongside other `nvalope-*` persisted values).
if (typeof window !== 'undefined') {
  try {
    useAppStore.subscribe(
      (s) => s.colorblindMode,
      (v) => {
        try {
          localStorage.setItem(COLORBLIND_MODE_KEY, v);
        } catch {
          /* ignore */
        }
      }
    );
  } catch {
    /* ignore */
  }
}

/** Settings slice for backup snapshot (no actions). */
export function getAppStoreSettingsSnapshot(): Record<string, unknown> {
  const s = useAppStore.getState();
  return {
    enabledModules: s.enabledModules,
    selectedMode: s.selectedMode,
    textSize: s.textSize,
    reducedMotion: s.reducedMotion,
    highContrast: s.highContrast,
    screenReaderMode: s.screenReaderMode,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    layoutScale: s.layoutScale,
    wheelScale: s.wheelScale,
    scrollbarSize: s.scrollbarSize,
    isPremiumLocal: s.isPremiumLocal,
    webLLMEnabled: s.webLLMEnabled,
    assistantUseLLM: s.assistantUseLLM,
    useCardLayout: s.useCardLayout,
    cardBarRows: s.cardBarRows,
    cardBarColumns: s.cardBarColumns,
    cardBarPosition: s.cardBarPosition,
    cardBarMinimized: s.cardBarMinimized,
    cardBarLockExpanded: s.cardBarLockExpanded,
    cardBarSectionOrder: s.cardBarSectionOrder,
    showCardBarRowSelector: s.showCardBarRowSelector,
    cardsSectionWidthPercent: s.cardsSectionWidthPercent,
    showGridBackground: s.showGridBackground,
    colorblindMode: s.colorblindMode,
    titleAreaMinimized: s.titleAreaMinimized,
    supportBlockMinimized: s.supportBlockMinimized,
    storageBarMinimized: s.storageBarMinimized,
    wheelMinimized: s.wheelMinimized,
    encryptBackups: s.encryptBackups,
    budgetPeriodMode: s.budgetPeriodMode,
    budgetPeriodModeSwitchDate: s.budgetPeriodModeSwitchDate,
    previousBudgetPeriodMode: s.previousBudgetPeriodMode,
    biweeklyPeriod1StartDay: s.biweeklyPeriod1StartDay,
    biweeklyPeriod1EndDay: s.biweeklyPeriod1EndDay,
    weekStartDay: s.weekStartDay,
  };
}
