import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/components/ui/collapsible';
import { useAppStore } from '@/app/store/appStore';
import {
  TEXT_SIZE_MIN,
  TEXT_SIZE_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  LETTER_SPACING_MIN,
  LETTER_SPACING_MAX,
  TEXT_SIZE_DEFAULT,
  LINE_HEIGHT_DEFAULT,
  LETTER_SPACING_DEFAULT,
  LAYOUT_SCALE_MIN,
  LAYOUT_SCALE_MAX,
  LAYOUT_SCALE_DEFAULT,
  clampLayoutScale,
  clampWheelScale,
  clampCardBarScale,
  clampScrollbarSize,
  WHEEL_SCALE_MIN,
  WHEEL_SCALE_MAX,
  WHEEL_SCALE_DEFAULT,
  CARD_BAR_SCALE_MIN,
  CARD_BAR_SCALE_MAX,
  CARD_BAR_ROWS_DEFAULT,
  clampCardBarRows,
  CARD_BAR_COLUMNS_DEFAULT,
  clampCardBarColumns,
  CARDS_SECTION_WIDTH_MIN,
  CARDS_SECTION_WIDTH_MAX,
  CARDS_SECTION_WIDTH_DEFAULT,
  clampCardsSectionWidth,
  SCROLLBAR_SIZE_MIN,
  SCROLLBAR_SIZE_MAX,
  SCROLLBAR_SIZE_DEFAULT,
} from '@/app/constants/accessibility';

export type AccessibilityMode = 'standard' | 'focus' | 'calm' | 'clear' | 'contrast' | 'tactile';

function DisplayGridToggle() {
  const showGridBackground = useAppStore((s) => s.showGridBackground);
  const setShowGridBackground = useAppStore((s) => s.setShowGridBackground);
  return (
    <div className="p-3 border border-primary/20 rounded-lg bg-card flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-sm font-medium text-foreground block">Show grid background</span>
        <p className="text-xs text-muted-foreground mt-0.5">
          Show a subtle grid behind the main content. Turn off to reduce visual distraction.
        </p>
      </div>
      <Switch
        checked={showGridBackground}
        onCheckedChange={setShowGridBackground}
        aria-label="Show grid background on or off"
        className="shrink-0"
      />
    </div>
  );
}

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
  const setStandardOptionsOpen = onStandardOptionsOpenChange ?? setDefaultStandardOpen;

  const handlePresetModesOpenChange = useCallback(
    (open: boolean) => {
      if (open) saveScrollForRestore?.();
      if (onPresetModesOpenChange) onPresetModesOpenChange(open);
      else setDefaultPresetModesOpen(open);
      if (open) scheduleScrollRestore();
    },
    [saveScrollForRestore, onPresetModesOpenChange, scheduleScrollRestore]
  );
  const setPresetModesOpen = onPresetModesOpenChange ?? setDefaultPresetModesOpen;

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
    <div className="space-y-4">
      {showReset && (
        <div className="p-4 bg-destructive/10 border-2 border-destructive/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-foreground">Reset to Defaults</h4>
              <p className="text-xs text-muted-foreground">Press Ctrl+0 (or Cmd+0 on Mac)</p>
            </div>
            <button
              onClick={resetToDefaults}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 font-medium"
            >
              Reset All
            </button>
          </div>
        </div>
      )}

      <Collapsible open={standardOptionsOpen} onOpenChange={handleStandardOptionsOpenChange} className="border-t border-border pt-4">
        <CollapsibleTrigger
          className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-expanded={standardOptionsOpen}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden>
              <span className="text-xl" aria-hidden>⚙️</span>
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Standard Accessibility Options</span>
              <span className="block text-xs text-muted-foreground">Text size, line height, sliders, toggles</span>
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
          <div className="p-3 border border-primary/20 rounded-lg bg-card">
            <label
              id="text-size-label"
              className="flex items-center justify-between cursor-pointer"
              htmlFor="accessibility-text-size"
            >
              <div>
                <span className="text-sm font-medium text-foreground">Text Size</span>
                <p className="text-xs text-muted-foreground">
                  Adjust font size ({TEXT_SIZE_MIN}% to {TEXT_SIZE_MAX}%)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-medium text-primary"
                  style={{ fontFamily: 'Courier New, monospace' }}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {textSize}%
                </span>
                <input
                  id="accessibility-text-size"
                  type="range"
                  min={TEXT_SIZE_MIN}
                  max={TEXT_SIZE_MAX}
                  value={Math.min(TEXT_SIZE_MAX, Math.max(TEXT_SIZE_MIN, textSize))}
                  onChange={(e) =>
                    setTextSize(
                      Math.min(TEXT_SIZE_MAX, Math.max(TEXT_SIZE_MIN, parseInt(e.target.value, 10)))
                    )
                  }
                  className="w-24"
                  aria-valuenow={textSize}
                  aria-valuemin={TEXT_SIZE_MIN}
                  aria-valuemax={TEXT_SIZE_MAX}
                  aria-labelledby="text-size-label"
                  aria-describedby="text-size-desc"
                />
              </div>
            </label>
            <p id="text-size-desc" className="sr-only">
              Current text size is {textSize} percent. Use arrow keys to adjust.
            </p>
          </div>

          <div className="p-3 border border-primary/20 rounded-lg bg-card">
            <label id="layout-scale-label" className="block text-sm font-medium text-foreground mb-1">
              Screen fit (layout scale)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8">{LAYOUT_SCALE_MIN}%</span>
              <span
                className="text-xs font-medium text-primary min-w-[2.5rem] text-right"
                style={{ fontFamily: 'Courier New, monospace' }}
                aria-live="polite"
                aria-atomic="true"
              >
                {layoutScale}%
              </span>
              <input
                id="accessibility-layout-scale"
                type="range"
                min={LAYOUT_SCALE_MIN}
                max={LAYOUT_SCALE_MAX}
                value={clampLayoutScale(layoutScale)}
                onChange={(e) => setLayoutScale(clampLayoutScale(parseInt(e.target.value, 10)))}
                className="flex-1 max-w-24"
                aria-valuenow={layoutScale}
                aria-valuemin={LAYOUT_SCALE_MIN}
                aria-valuemax={LAYOUT_SCALE_MAX}
                aria-labelledby="layout-scale-label"
              />
              <span className="text-xs text-muted-foreground w-8">{LAYOUT_SCALE_MAX}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Shrink the whole screen to fit small displays (e.g. mobile). Persists in backup.
            </p>
          </div>

          <div className="p-3 border border-primary/20 rounded-lg bg-card">
            <label id="wheel-scale-label" className="block text-sm font-medium text-foreground mb-1">
              {isMobile ? 'Card size' : 'Feature wheel size'}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8">
                {isMobile ? CARD_BAR_SCALE_MIN : WHEEL_SCALE_MIN}%
              </span>
              <span
                className="text-xs font-medium text-primary min-w-[2.5rem] text-right"
                style={{ fontFamily: 'Courier New, monospace' }}
                aria-live="polite"
                aria-atomic="true"
              >
                {wheelScale}%
              </span>
              <input
                id="accessibility-wheel-scale"
                type="range"
                min={isMobile ? CARD_BAR_SCALE_MIN : WHEEL_SCALE_MIN}
                max={isMobile ? CARD_BAR_SCALE_MAX : WHEEL_SCALE_MAX}
                value={isMobile ? clampCardBarScale(wheelScale) : clampWheelScale(wheelScale)}
                onChange={(e) =>
                  setWheelScale(
                    isMobile
                      ? clampCardBarScale(parseInt(e.target.value, 10))
                      : clampWheelScale(parseInt(e.target.value, 10))
                  )
                }
                className="flex-1 max-w-24"
                aria-valuenow={wheelScale}
                aria-valuemin={isMobile ? CARD_BAR_SCALE_MIN : WHEEL_SCALE_MIN}
                aria-valuemax={isMobile ? CARD_BAR_SCALE_MAX : WHEEL_SCALE_MAX}
                aria-labelledby="wheel-scale-label"
              />
              <span className="text-xs text-muted-foreground w-8">
                {isMobile ? CARD_BAR_SCALE_MAX : WHEEL_SCALE_MAX}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isMobile
                ? 'Resize the section cards (icons and labels). Persists in backup.'
                : 'Resize the feature wheel. Persists in backup.'}
            </p>
          </div>

          {setCardsSectionWidthPercent != null && (
            <div className="p-3 border border-primary/20 rounded-lg bg-card">
              <label id="cards-section-width-label" className="block text-sm font-medium text-foreground mb-1">
                Cards section width
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-8">{CARDS_SECTION_WIDTH_MIN}%</span>
                <span
                  className="text-xs font-medium text-primary min-w-[2.5rem] text-right"
                  style={{ fontFamily: 'Courier New, monospace' }}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {cardsSectionWidthPercent}%
                </span>
                <input
                  id="accessibility-cards-section-width"
                  type="range"
                  min={CARDS_SECTION_WIDTH_MIN}
                  max={CARDS_SECTION_WIDTH_MAX}
                  value={clampCardsSectionWidth(cardsSectionWidthPercent)}
                  onChange={(e) => setCardsSectionWidthPercent(clampCardsSectionWidth(parseInt(e.target.value, 10)))}
                  className="flex-1 max-w-24"
                  aria-valuenow={cardsSectionWidthPercent}
                  aria-valuemin={CARDS_SECTION_WIDTH_MIN}
                  aria-valuemax={CARDS_SECTION_WIDTH_MAX}
                  aria-labelledby="cards-section-width-label"
                />
                <span className="text-xs text-muted-foreground w-8">{CARDS_SECTION_WIDTH_MAX}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                When the bar is at the bottom: max width of the bar as % of screen. When left/right: width of the bar (100% = 72px). Persists in backup.
              </p>
            </div>
          )}

          {(setCardBarRows != null || setCardBarColumns != null || setCardBarPosition != null || setShowCardBarRowSelector != null) && (
            <div className="p-3 border border-primary/20 rounded-lg bg-card">
              {setShowCardBarRowSelector != null && (
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="min-w-0 flex items-start gap-2">
                    <div>
                      <span className="text-sm font-medium text-foreground block">Show row/column selector on card bar</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        When checked, a strip appears above or beside the section tabs (Rows for bottom, Columns for left/right). The minimize chevron collapses the whole bar.
                      </p>
                    </div>
                  </div>
                  <Checkbox
                    checked={showCardBarRowSelector}
                    onCheckedChange={setShowCardBarRowSelector}
                    aria-label="Show row/column selector on card bar"
                    className="size-5 shrink-0 rounded"
                  />
                </div>
              )}
              {setCardBarPosition != null && (
                <>
                  <label id="card-bar-position-label" className="block text-sm font-medium text-foreground mb-1">
                    Card bar position
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Place the section bar at the bottom (rows), or vertically on the left or right (columns).
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mb-3" role="group" aria-labelledby="card-bar-position-label">
                    {(['bottom', 'left', 'right'] as const).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setCardBarPosition(pos)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border-2 ${
                          cardBarPosition === pos
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                        }`}
                        aria-pressed={cardBarPosition === pos}
                        aria-label={`Card bar position: ${pos}`}
                      >
                        {pos === 'bottom' ? 'Bottom' : pos === 'left' ? 'Left' : 'Right'}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {setCardBarRows != null && cardBarPosition === 'bottom' && (
                <>
                  <label id="card-bar-rows-label" className="block text-sm font-medium text-foreground mb-1">
                    Card bar rows
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    When the bar is at the bottom, show it in 1–3 rows. Auto uses 2 rows on small screens.
                  </p>
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="card-bar-rows-label">
                    {[
                      { value: 0, label: 'Auto' },
                      { value: 1, label: '1 row' },
                      { value: 2, label: '2 rows' },
                      { value: 3, label: '3 rows' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCardBarRows(clampCardBarRows(value))}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border-2 ${
                          cardBarRows === value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                        }`}
                        aria-pressed={cardBarRows === value}
                        aria-label={`Card bar rows: ${label}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {setCardBarColumns != null && (cardBarPosition === 'left' || cardBarPosition === 'right') && (
                <>
                  <label id="card-bar-columns-label" className="block text-sm font-medium text-foreground mb-1">
                    Card bar columns
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    When the bar is on the left or right, show it in 1–3 columns. Auto uses 2 columns on small screens.
                  </p>
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="card-bar-columns-label">
                    {[
                      { value: 0, label: 'Auto' },
                      { value: 1, label: '1 col' },
                      { value: 2, label: '2 cols' },
                      { value: 3, label: '3 cols' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCardBarColumns(clampCardBarColumns(value))}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border-2 ${
                          cardBarColumns === value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                        }`}
                        aria-pressed={cardBarColumns === value}
                        aria-label={`Card bar columns: ${label}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">
                You can also drag sections in the card bar to reorder them.
              </p>
            </div>
          )}

          <div className="p-3 border border-primary/20 rounded-lg bg-card">
            <div className="flex items-center gap-2 mb-1">
              <label id="scrollbar-size-label" className="block text-sm font-medium text-foreground">
                Chonkiness
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8">{SCROLLBAR_SIZE_MIN}</span>
              <span
                className="text-xs font-medium text-primary min-w-[2.5rem] text-right"
                style={{ fontFamily: 'Courier New, monospace' }}
                aria-live="polite"
                aria-atomic="true"
              >
                {scrollbarSize}px
              </span>
              <input
                id="accessibility-scrollbar-size"
                type="range"
                min={SCROLLBAR_SIZE_MIN}
                max={SCROLLBAR_SIZE_MAX}
                value={clampScrollbarSize(scrollbarSize)}
                onChange={(e) =>
                  setScrollbarSize(clampScrollbarSize(parseInt(e.target.value, 10)))
                }
                className="flex-1 max-w-24"
                aria-valuenow={scrollbarSize}
                aria-valuemin={SCROLLBAR_SIZE_MIN}
                aria-valuemax={SCROLLBAR_SIZE_MAX}
                aria-labelledby="scrollbar-size-label"
              />
              <span className="text-xs text-muted-foreground w-8">{SCROLLBAR_SIZE_MAX}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Affects scrollbars, wheel outline, borders, and button/touch target size for visibility and easier tapping.
            </p>
          </div>

          <DisplayGridToggle />

          <div className="p-3 border border-primary/20 rounded-lg bg-card">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">Reduced Motion</span>
                <p className="text-xs text-muted-foreground">Disable animations and transitions</p>
              </div>
              <button
                onClick={() => setReducedMotion(!reducedMotion)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border-2 ${
                  reducedMotion
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                }`}
                aria-pressed={reducedMotion}
                aria-label={
                  reducedMotion ? 'Reduced motion on; click to turn off' : 'Reduced motion off; click to turn on'
                }
              >
                {reducedMotion ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          <div className="p-3 border border-primary/20 rounded-lg bg-card">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">High Contrast</span>
                <p className="text-xs text-muted-foreground">Bold borders and stronger contrast</p>
              </div>
              <button
                onClick={() => setHighContrast(!highContrast)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border-2 ${
                  highContrast
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                }`}
                aria-pressed={highContrast}
                aria-label={
                  highContrast ? 'High contrast on; click to turn off' : 'High contrast off; click to turn on'
                }
              >
                {highContrast ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          <div className="p-3 border border-primary/20 rounded-lg bg-card">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">Screen Reader Mode</span>
                <p className="text-xs text-muted-foreground">Enhanced focus indicators and ARIA</p>
              </div>
              <button
                onClick={() => setScreenReaderMode(!screenReaderMode)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border-2 ${
                  screenReaderMode
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                }`}
                aria-pressed={screenReaderMode}
                aria-label={
                  screenReaderMode
                    ? 'Screen reader mode on; click to turn off'
                    : 'Screen reader mode off; click to turn on'
                }
              >
                {screenReaderMode ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          <div className="p-3 border border-primary/20 rounded-lg bg-card">
            <label
              id="line-height-label"
              className="flex items-center justify-between cursor-pointer"
              htmlFor="accessibility-line-height"
            >
              <div>
                <span className="text-sm font-medium text-foreground">Line Height</span>
                <p className="text-xs text-muted-foreground">
                  Adjust line spacing ({LINE_HEIGHT_MIN}% to {LINE_HEIGHT_MAX}%)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-medium text-primary"
                  style={{ fontFamily: 'Courier New, monospace' }}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {lineHeight}%
                </span>
                <input
                  id="accessibility-line-height"
                  type="range"
                  min={LINE_HEIGHT_MIN}
                  max={LINE_HEIGHT_MAX}
                  value={Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, lineHeight))}
                  onChange={(e) =>
                    setLineHeight(
                      Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, parseInt(e.target.value, 10)))
                    )
                  }
                  className="w-24"
                  aria-valuenow={lineHeight}
                  aria-valuemin={LINE_HEIGHT_MIN}
                  aria-valuemax={LINE_HEIGHT_MAX}
                  aria-labelledby="line-height-label"
                />
              </div>
            </label>
          </div>

          <div className="p-3 border border-primary/20 rounded-lg bg-card">
            <label
              id="letter-spacing-label"
              className="flex items-center justify-between cursor-pointer"
              htmlFor="accessibility-letter-spacing"
            >
              <div>
                <span className="text-sm font-medium text-foreground">Letter Spacing</span>
                <p className="text-xs text-muted-foreground">
                  Adjust letter spacing ({LETTER_SPACING_MIN} to {LETTER_SPACING_MAX} px)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-medium text-primary"
                  style={{ fontFamily: 'Courier New, monospace' }}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {letterSpacing}px
                </span>
                <input
                  id="accessibility-letter-spacing"
                  type="range"
                  min={LETTER_SPACING_MIN}
                  max={LETTER_SPACING_MAX}
                  value={Math.min(LETTER_SPACING_MAX, Math.max(LETTER_SPACING_MIN, letterSpacing))}
                  onChange={(e) =>
                    setLetterSpacing(
                      Math.min(
                        LETTER_SPACING_MAX,
                        Math.max(LETTER_SPACING_MIN, parseInt(e.target.value, 10))
                      )
                    )
                  }
                  className="w-24"
                  aria-valuenow={letterSpacing}
                  aria-valuemin={LETTER_SPACING_MIN}
                  aria-valuemax={LETTER_SPACING_MAX}
                  aria-labelledby="letter-spacing-label"
                />
              </div>
            </label>
          </div>
        </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={presetModesOpen} onOpenChange={handlePresetModesOpenChange} className="border-t border-border pt-4">
        <CollapsibleTrigger
          className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-expanded={presetModesOpen}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
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
        <div className="flex items-center gap-1.5 mb-2">
          <h3 id="preset-modes-heading" className="text-lg text-primary">
            Preset modes
          </h3>
        </div>
        <p id="preset-modes-desc" className="text-sm text-muted-foreground mb-4">
          Each mode applies a different set of visual and interaction options. Click a mode to turn it on; click again to disable. Text size,
          line height, and letter spacing sliders above still apply so you can refine any preset.
        </p>

        <div className="space-y-3">
          {(
            [
              {
                id: 'focus' as const,
                emoji: '⚡',
                title: 'Focus Mode',
                subtitle: 'Minimize distractions, one task at a time',
                bullets: [
                  'No animations or flashing; secondary UI hidden',
                  'List of sections for clear navigation; one task at a time',
                  'Stronger focus indicators and bold headings',
                ],
                ariaLabel: 'Focus Mode',
              },
              {
                id: 'calm' as const,
                emoji: '🧘',
                title: 'Calm Mode',
                subtitle: 'Muted colors and extra space',
                bullets: [
                  'Muted colors (40% desaturation)',
                  'Extra whitespace & breathing room',
                  'No animations or sudden movements',
                  'Softer visual appearance',
                ],
                ariaLabel: 'Calm Mode',
              },
              {
                id: 'clear' as const,
                emoji: '📖',
                title: 'Clear Mode',
                subtitle: 'Readability and typography',
                bullets: [
                  'Readability-focused sans-serif (Verdana, Arial); no ligatures',
                  'Min 16px; letter-spacing 0.12em+, word-spacing 0.16em+',
                  'Line height 1.5–1.8×; paragraph spacing 2× font size',
                  'High-contrast cream background (4.5:1); optional Read aloud',
                ],
                ariaLabel: 'Clear Mode',
              },
              {
                id: 'contrast' as const,
                emoji: '💪',
                title: 'Maximum Contrast',
                subtitle: 'High contrast and bold borders',
                bullets: [
                  'Very high contrast',
                  'Bold 3px borders everywhere',
                  'Large 4px focus indicators',
                  '125% larger text size',
                ],
                ariaLabel: 'Maximum Contrast',
              },
              {
                id: 'tactile' as const,
                emoji: '👆',
                title: 'Tactile',
                subtitle: 'Touch-friendly and easy to tap',
                bullets: [
                  'Larger tap targets (min 48px) for fingers and styli',
                  'Extra padding on buttons, inputs, and controls',
                  'Rounded, graspable feel—borders and spacing that suit touch',
                  'Works great on phones and tablets',
                ],
                ariaLabel: 'Tactile Mode',
              },
            ] as const
          ).map(({ id, emoji, title, subtitle, bullets, ariaLabel }) => (
            <button
              key={id}
              onClick={() => {
                const next = selectedMode === id ? 'standard' : id;
                setSelectedMode(next);
                if (next !== 'standard') onPresetApplied?.();
              }}
              className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                selectedMode === id
                  ? 'border-primary bg-primary/20 shadow-lg'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
              aria-pressed={selectedMode === id}
              aria-label={
                selectedMode === id ? `${ariaLabel} is on; click to turn off` : `${ariaLabel}; click to turn on`
              }
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden>
                  {emoji}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">{title}</h4>
                    {selectedMode === id && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                    {bullets.map((b) => (
                      <li key={b}>• {b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          ))}
        </div>
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
        <div className="p-3 border border-primary/20 rounded-lg bg-card space-y-2">
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
