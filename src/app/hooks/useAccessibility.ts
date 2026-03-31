/**
 * Accessibility: media-query wiring, keyboard reset, and CSS vars.
 * State lives in appStore; this hook subscribes and wires system prefs.
 */

import { useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { AccessibilityMode } from '@/app/components/AccessibilityContent';
import { useAppStore } from '@/app/store/appStore';
import {
  TEXT_SIZE_DEFAULT,
  LINE_HEIGHT_DEFAULT,
  LETTER_SPACING_DEFAULT,
  LAYOUT_SCALE_DEFAULT,
  WHEEL_SCALE_DEFAULT,
  SCROLLBAR_SIZE_DEFAULT,
  CARD_BAR_ROWS_DEFAULT,
  clampTextSize,
  clampLineHeight,
  clampLetterSpacing,
  clampLayoutScale,
  clampWheelScale,
  clampScrollbarSize,
  SCROLLBAR_SIZE_MIN,
  SCROLLBAR_SIZE_MAX,
  CARDS_SECTION_WIDTH_DEFAULT,
} from '@/app/constants/accessibility';

const CHONK_SPAN = SCROLLBAR_SIZE_MAX - SCROLLBAR_SIZE_MIN;

/** Apply accessibility CSS variables to :root for real-time, smooth updates without waiting for React re-renders. */
function applyAccessibilityVarsToRoot(): void {
  if (typeof document === 'undefined') return;
  const s = useAppStore.getState();
  const chonk = clampScrollbarSize(s.scrollbarSize);
  const chonkBorderWidth = chonk <= 10 ? 1 : chonk <= 15 ? 2 : chonk <= 21 ? 3 : 4;
  const chonkTouchMin = Math.round(44 + ((chonk - SCROLLBAR_SIZE_MIN) / CHONK_SPAN) * 18);
  const chonkPaddingRem = 0.25 + ((chonk - SCROLLBAR_SIZE_MIN) / CHONK_SPAN) * 0.25;
  const root = document.documentElement;
  root.style.setProperty('--text-scale', String(clampTextSize(s.textSize) / 100));
  root.style.setProperty('--line-height-scale', String(clampLineHeight(s.lineHeight) / 100));
  root.style.setProperty('--letter-spacing-px', `${clampLetterSpacing(s.letterSpacing)}px`);
  root.style.setProperty('--layout-scale', String(clampLayoutScale(s.layoutScale) / 100));
  root.style.setProperty('--wheel-scale', String(clampWheelScale(s.wheelScale) / 100));
  root.style.setProperty('--scrollbar-size', `${chonk}px`);
  root.style.setProperty('--chonk-border-width', `${chonkBorderWidth}px`);
  root.style.setProperty('--chonk-touch-min', `${chonkTouchMin}px`);
  root.style.setProperty('--chonk-touch-padding-y', `${chonkPaddingRem}rem`);
  root.style.setProperty('--chonk-touch-padding-x', `${chonkPaddingRem}rem`);
}

export interface UseAccessibilityOptions {
  /** Called at the start of resetToDefaults (e.g. save scroll position). */
  onBeforeReset?: () => void;
}

export interface UseAccessibilityReturn {
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
  selectedMode: AccessibilityMode;
  setSelectedMode: (mode: AccessibilityMode) => void;
  resetToDefaults: () => void;
  /** CSS custom properties for the root container. */
  accessibilityStyle: CSSProperties;
}

export function useAccessibility(
  options: UseAccessibilityOptions = {}
): UseAccessibilityReturn {
  const { onBeforeReset } = options;

  const textSize = useAppStore((s) => clampTextSize(s.textSize));
  const setTextSize = useAppStore((s) => s.setTextSize);
  const lineHeight = useAppStore((s) => clampLineHeight(s.lineHeight));
  const setLineHeight = useAppStore((s) => s.setLineHeight);
  const letterSpacing = useAppStore((s) => clampLetterSpacing(s.letterSpacing));
  const setLetterSpacing = useAppStore((s) => s.setLetterSpacing);
  const layoutScale = useAppStore((s) => clampLayoutScale(s.layoutScale));
  const setLayoutScale = useAppStore((s) => s.setLayoutScale);
  const wheelScale = useAppStore((s) => clampWheelScale(s.wheelScale));
  const setWheelScale = useAppStore((s) => s.setWheelScale);
  const scrollbarSize = useAppStore((s) => clampScrollbarSize(s.scrollbarSize));
  const setScrollbarSize = useAppStore((s) => s.setScrollbarSize);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const setReducedMotion = useAppStore((s) => s.setReducedMotion);
  const highContrast = useAppStore((s) => s.highContrast);
  const setHighContrast = useAppStore((s) => s.setHighContrast);
  const screenReaderMode = useAppStore((s) => s.screenReaderMode);
  const setScreenReaderMode = useAppStore((s) => s.setScreenReaderMode);
  const selectedMode = useAppStore((s) => s.selectedMode);
  const setSelectedMode = useAppStore((s) => s.setSelectedMode);

  const resetToDefaults = useCallback(() => {
    onBeforeReset?.();
    useAppStore.getState().setSelectedMode('standard');
    useAppStore.getState().setTextSize(TEXT_SIZE_DEFAULT);
    useAppStore.getState().setLineHeight(LINE_HEIGHT_DEFAULT);
    useAppStore.getState().setLetterSpacing(LETTER_SPACING_DEFAULT);
    useAppStore.getState().setLayoutScale(LAYOUT_SCALE_DEFAULT);
    useAppStore.getState().setWheelScale(WHEEL_SCALE_DEFAULT);
    useAppStore.getState().setScrollbarSize(SCROLLBAR_SIZE_DEFAULT);
    useAppStore.getState().setCardBarRows(CARD_BAR_ROWS_DEFAULT);
    useAppStore.getState().setCardBarSectionOrder(null);
    useAppStore.getState().setShowCardBarRowSelector(true);
    useAppStore.getState().setCardsSectionWidthPercent(CARDS_SECTION_WIDTH_DEFAULT);
    useAppStore.getState().setReducedMotion(false);
    useAppStore.getState().setHighContrast(false);
    useAppStore.getState().setScreenReaderMode(false);
    useAppStore.getState().setColorblindMode('none');
  }, [onBeforeReset]);

  const resetRef = useRef(resetToDefaults);
  resetRef.current = resetToDefaults;

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotionQuery.matches) {
      setReducedMotion(true);
    }

    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    if (highContrastQuery.matches) {
      setHighContrast(true);
    }

    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      setHighContrast(e.matches);
    };

    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
    highContrastQuery.addEventListener('change', handleHighContrastChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        resetRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setReducedMotion, setHighContrast]);

  // Apply accessibility CSS vars to :root in real time via store subscription so slider
  // moves update the DOM immediately without waiting for React re-renders (smooth, no jerkiness).
  useLayoutEffect(() => {
    applyAccessibilityVarsToRoot();
    const unsub = useAppStore.subscribe(() => applyAccessibilityVarsToRoot());
    return unsub;
  }, []);

  const accessibilityStyle = useMemo(() => {
    const chonk = clampScrollbarSize(scrollbarSize);
    /* Border: 6→1px, 11–15→2px, 16–21→3px, 22+→4px */
    const chonkBorderWidth =
      chonk <= 10 ? 1 : chonk <= 15 ? 2 : chonk <= 21 ? 3 : 4;
    /* Touch min-height: min→44px, max→62px */
    const chonkTouchMin = Math.round(44 + ((chonk - SCROLLBAR_SIZE_MIN) / CHONK_SPAN) * 18);
    /* Padding: min→0.25rem, max→0.5rem */
    const chonkPaddingRem = 0.25 + ((chonk - SCROLLBAR_SIZE_MIN) / CHONK_SPAN) * 0.25;
    return {
      '--text-scale': clampTextSize(textSize) / 100,
      '--line-height-scale': clampLineHeight(lineHeight) / 100,
      '--letter-spacing-px': `${clampLetterSpacing(letterSpacing)}px`,
      '--layout-scale': clampLayoutScale(layoutScale) / 100,
      '--wheel-scale': clampWheelScale(wheelScale) / 100,
      '--scrollbar-size': `${chonk}px`,
      '--chonk-border-width': `${chonkBorderWidth}px`,
      '--chonk-touch-min': `${chonkTouchMin}px`,
      '--chonk-touch-padding-y': `${chonkPaddingRem}rem`,
      '--chonk-touch-padding-x': `${chonkPaddingRem}rem`,
    } as React.CSSProperties;
  }, [textSize, lineHeight, letterSpacing, layoutScale, wheelScale, scrollbarSize]);

  return {
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
    accessibilityStyle,
  };
}
