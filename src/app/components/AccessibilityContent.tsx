import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/components/ui/collapsible';
import {
  TEXT_SIZE_DEFAULT,
  LINE_HEIGHT_DEFAULT,
  LETTER_SPACING_DEFAULT,
  LAYOUT_SCALE_DEFAULT,
  WHEEL_SCALE_DEFAULT,
  CARD_BAR_ROWS_DEFAULT,
  CARD_BAR_COLUMNS_DEFAULT,
  CARDS_SECTION_WIDTH_DEFAULT,
  SCROLLBAR_SIZE_DEFAULT,
} from '@/app/constants/accessibility';
import type { AccessibilityMode } from '@/app/components/accessibilityMode';
import { AccessibilityTypographySliders, AccessibilityCardsAndBarSliders } from '@/app/components/AccessibilitySliders';
import { AccessibilityToggles } from '@/app/components/AccessibilityToggles';
import { AccessibilityPresets } from '@/app/components/AccessibilityPresets';

export type { AccessibilityMode } from '@/app/components/accessibilityMode';

export interface AccessibilityContentProps {
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
  /** When a preset mode is applied, call to close the Accessibility panel so the user sees the home screen for that mode. */
  onPresetApplied?: () => void;
  /** When true, show "Card bar size" instead of "Feature wheel size" (mobile bottom bar). */
  isMobile?: boolean;
  /** Card bar rows when using Cards layout (bottom): 0 = auto, 1–3 = fixed. */
  cardBarRows?: number;
  setCardBarRows?: (v: number) => void;
  /** Card bar columns when position is left/right: 0 = auto, 1–3 = fixed. */
  cardBarColumns?: number;
  setCardBarColumns?: (v: number) => void;
  /** Card bar position: bottom (horizontal), left or right (vertical). */
  cardBarPosition?: 'bottom' | 'left' | 'right';
  setCardBarPosition?: (v: 'bottom' | 'left' | 'right') => void;
  /** When true, show the row/column selector strip on the card bar (minimize collapses whole bar). */
  showCardBarRowSelector?: boolean;
  setShowCardBarRowSelector?: (v: boolean) => void;
  /** Cards section width 60–120%: bottom = max-width % of viewport; left/right = bar width % of 72px. */
  cardsSectionWidthPercent?: number;
  setCardsSectionWidthPercent?: (v: number) => void;
  /** Collapsible open state (lifted so panels stay open when changing sliders/presets). */
  standardOptionsOpen?: boolean;
  onStandardOptionsOpenChange?: (open: boolean) => void;
  presetModesOpen?: boolean;
  onPresetModesOpenChange?: (open: boolean) => void;
  /** Call before opening a collapsible so main scroll can be restored after layout (no screen movement). */
  saveScrollForRestore?: () => void;
  /** Call after collapsible content has expanded to restore main scroll position. */
  restoreScrollAfterLayout?: () => void;
}

export function AccessibilityContent({
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
  onPresetApplied,
  isMobile = false,
  cardBarRows = CARD_BAR_ROWS_DEFAULT,
  setCardBarRows,
  cardBarColumns = CARD_BAR_COLUMNS_DEFAULT,
  setCardBarColumns,
  cardBarPosition = 'bottom',
  setCardBarPosition,
  showCardBarRowSelector = true,
  setShowCardBarRowSelector,
  cardsSectionWidthPercent = CARDS_SECTION_WIDTH_DEFAULT,
  setCardsSectionWidthPercent,
  standardOptionsOpen: standardOptionsOpenProp,
  onStandardOptionsOpenChange,
  presetModesOpen: presetModesOpenProp,
  onPresetModesOpenChange,
  saveScrollForRestore,
  restoreScrollAfterLayout,
}: AccessibilityContentProps) {
  const [defaultStandardOpen, setDefaultStandardOpen] = useState(false);
  const [defaultPresetModesOpen, setDefaultPresetModesOpen] = useState(false);
  const standardOptionsOpen = standardOptionsOpenProp ?? defaultStandardOpen;
  const presetModesOpen = presetModesOpenProp ?? defaultPresetModesOpen;

  const scheduleScrollRestore = useCallback(() => {
    if (!restoreScrollAfterLayout) return;
    requestAnimationFrame(() => requestAnimationFrame(restoreScrollAfterLayout));
  }, [restoreScrollAfterLayout]);

  const handleStandardOptionsOpenChange = useCallback(
    (open: boolean) => {
      if (open) saveScrollForRestore?.();
      if (onStandardOptionsOpenChange) onStandardOptionsOpenChange(open);
      else setDefaultStandardOpen(open);
      if (open) scheduleScrollRestore();
    },
    [saveScrollForRestore, onStandardOptionsOpenChange, scheduleScrollRestore]
  );

  const handlePresetModesOpenChange = useCallback(
    (open: boolean) => {
      if (open) saveScrollForRestore?.();
      if (onPresetModesOpenChange) onPresetModesOpenChange(open);
      else setDefaultPresetModesOpen(open);
      if (open) scheduleScrollRestore();
    },
    [saveScrollForRestore, onPresetModesOpenChange, scheduleScrollRestore]
  );

  const [ttsEnabled, setTtsEnabled] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('nvalope-tts-enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [ttsSpeaking, setTtsSpeaking] = useState(false);

  const handleReadAloud = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    if (ttsSpeaking) {
      synth.cancel();
      setTtsSpeaking(false);
      return;
    }
    const app = document.querySelector('[role="application"]');
    const text = app?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text.slice(0, 5000));
    u.lang = document.documentElement.lang || 'en-US';
    u.onend = () => setTtsSpeaking(false);
    u.onerror = () => setTtsSpeaking(false);
    synth.speak(u);
    setTtsSpeaking(true);
  }, [ttsSpeaking]);

  const handleTtsToggle = useCallback((on: boolean) => {
    setTtsEnabled(on);
    if (!on && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setTtsSpeaking(false);
    }
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem('nvalope-tts-enabled', String(on));
    } catch {
      /* ignore */
    }
  }, []);

  const showReset =
    selectedMode !== 'standard' ||
    textSize !== TEXT_SIZE_DEFAULT ||
    lineHeight !== LINE_HEIGHT_DEFAULT ||
    letterSpacing !== LETTER_SPACING_DEFAULT ||
    layoutScale !== LAYOUT_SCALE_DEFAULT ||
    wheelScale !== WHEEL_SCALE_DEFAULT ||
    scrollbarSize !== SCROLLBAR_SIZE_DEFAULT ||
    cardsSectionWidthPercent !== CARDS_SECTION_WIDTH_DEFAULT ||
    reducedMotion ||
    highContrast ||
    screenReaderMode;

  return (
    <div className="min-w-0 space-y-4">
      {showReset && (
        <div className="min-w-0 rounded-lg border-2 border-destructive/30 bg-destructive/10 p-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-foreground">Reset to Defaults</h4>
              <p className="text-xs text-muted-foreground">Press Ctrl+0 (or Cmd+0 on Mac)</p>
            </div>
            <button
              type="button"
              onClick={resetToDefaults}
              className="shrink-0 rounded-lg bg-destructive px-4 py-2 font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              Reset All
            </button>
          </div>
        </div>
      )}

      <Collapsible open={standardOptionsOpen} onOpenChange={handleStandardOptionsOpenChange} className="border-t border-border pt-4">
        <CollapsibleTrigger
          className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4"
          aria-expanded={standardOptionsOpen}
          onPointerDownCapture={() => saveScrollForRestore?.()}
          onKeyDownCapture={(e) => {
            if (e.key === 'Enter' || e.key === ' ') saveScrollForRestore?.();
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden>
              <span className="text-xl" aria-hidden>⚙️</span>
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Standard Accessibility Options</span>
              <span className="block text-xs text-muted-foreground">Typography and layout sliders, chonkiness, then toggles and card bar</span>
            </div>
          </div>
          {standardOptionsOpen ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
        <p className="text-sm text-muted-foreground">
          Enable individual accessibility features that work together.
        </p>

        <div className="space-y-2" role="group" aria-labelledby="accessibility-standard-heading">
          <h4 id="accessibility-standard-heading" className="sr-only">
            Standard accessibility options
          </h4>
          <AccessibilityTypographySliders
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
            setScrollbarSize={setScrollbarSize}
            isMobile={isMobile}
          />
          <AccessibilityToggles
            reducedMotion={reducedMotion}
            setReducedMotion={setReducedMotion}
            highContrast={highContrast}
            setHighContrast={setHighContrast}
            screenReaderMode={screenReaderMode}
            setScreenReaderMode={setScreenReaderMode}
          />
          <AccessibilityCardsAndBarSliders
            cardsSectionWidthPercent={cardsSectionWidthPercent}
            setCardsSectionWidthPercent={setCardsSectionWidthPercent}
            cardBarRows={cardBarRows}
            setCardBarRows={setCardBarRows}
            cardBarColumns={cardBarColumns}
            setCardBarColumns={setCardBarColumns}
            cardBarPosition={cardBarPosition}
            setCardBarPosition={setCardBarPosition}
            showCardBarRowSelector={showCardBarRowSelector}
            setShowCardBarRowSelector={setShowCardBarRowSelector}
          />
        </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={presetModesOpen} onOpenChange={handlePresetModesOpenChange} className="border-t border-border pt-4">
        <CollapsibleTrigger
          className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4"
          aria-expanded={presetModesOpen}
          onPointerDownCapture={() => saveScrollForRestore?.()}
          onKeyDownCapture={(e) => {
            if (e.key === 'Enter' || e.key === ' ') saveScrollForRestore?.();
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden>
              <span className="text-xl" aria-hidden>🎨</span>
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Preset modes</span>
              <span className="block text-xs text-muted-foreground">Focus, Calm, Clear, Maximum Contrast, Tactile</span>
            </div>
          </div>
          {presetModesOpen ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent
          className="pt-2"
          role="region"
          aria-labelledby="preset-modes-heading"
          aria-describedby="preset-modes-desc"
        >
          <AccessibilityPresets
            selectedMode={selectedMode}
            setSelectedMode={setSelectedMode}
            onPresetApplied={onPresetApplied}
          />
        </CollapsibleContent>
      </Collapsible>

      {selectedMode !== 'standard' && (
        <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
          <p className="text-sm text-primary font-medium">
            ✓{' '}
            {selectedMode === 'focus'
              ? 'Focus'
              : selectedMode === 'calm'
                ? 'Calm'
                : selectedMode === 'clear'
                  ? 'Clear'
                  : selectedMode === 'contrast'
                    ? 'Maximum Contrast'
                    : 'Tactile'}{' '}
            Mode Active
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Click the mode button again to disable, or choose a different mode.
          </p>
        </div>
      )}

      {selectedMode === 'clear' && (
        <div className="min-w-0 space-y-2 rounded-lg border border-primary/20 bg-card p-3">
          <h4 className="text-sm font-medium text-foreground">Text-to-speech (Read aloud)</h4>
          <p className="text-xs text-muted-foreground">
            Use the Web Speech API to read the current page aloud. Works offline in supported browsers.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ttsEnabled}
                onChange={(e) => handleTtsToggle(e.target.checked)}
                className="rounded border-primary"
                aria-describedby="tts-desc"
              />
              <span className="text-sm text-foreground">Enable text-to-speech</span>
            </label>
            {ttsEnabled && (
              <button
                type="button"
                onClick={handleReadAloud}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                aria-label={ttsSpeaking ? 'Stop reading' : 'Read aloud'}
              >
                {ttsSpeaking ? 'Stop' : 'Read aloud'}
              </button>
            )}
          </div>
          <p id="tts-desc" className="text-xs text-muted-foreground sr-only">
            When enabled, use Read aloud to hear the main app content. Stop to cancel.
          </p>
        </div>
      )}
    </div>
  );
}
