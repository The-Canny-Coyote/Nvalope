import { Checkbox } from '@/app/components/ui/checkbox';
import {
  TEXT_SIZE_MIN,
  TEXT_SIZE_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  LETTER_SPACING_MIN,
  LETTER_SPACING_MAX,
  LAYOUT_SCALE_MIN,
  LAYOUT_SCALE_MAX,
  clampLayoutScale,
  clampWheelScale,
  clampCardBarScale,
  clampScrollbarSize,
  WHEEL_SCALE_MIN,
  WHEEL_SCALE_MAX,
  CARD_BAR_SCALE_MIN,
  CARD_BAR_SCALE_MAX,
  clampCardBarRows,
  clampCardBarColumns,
  CARDS_SECTION_WIDTH_MIN,
  CARDS_SECTION_WIDTH_MAX,
  clampCardsSectionWidth,
  SCROLLBAR_SIZE_MIN,
  SCROLLBAR_SIZE_MAX,
} from '@/app/constants/accessibility';

export type AccessibilityTypographySlidersProps = {
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
  isMobile?: boolean;
};

export function AccessibilityTypographySliders({
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
  isMobile = false,
}: AccessibilityTypographySlidersProps) {
  return (
    <>
          <div className="min-w-0 rounded-lg border border-primary/20 bg-card p-3">
            <label
              id="text-size-label"
              className="flex min-w-0 cursor-pointer flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              htmlFor="accessibility-text-size"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground">Text Size</span>
                <p className="text-xs text-muted-foreground">
                  Adjust font size ({TEXT_SIZE_MIN}% to {TEXT_SIZE_MAX}%)
                </p>
              </div>
              <div className="flex min-w-0 shrink-0 items-center gap-3">
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
                  className="min-w-[5.5rem] flex-1 sm:w-24 sm:flex-none"
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

          <div className="min-w-0 rounded-lg border border-primary/20 bg-card p-3">
            <label
              id="line-height-label"
              className="flex min-w-0 cursor-pointer flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              htmlFor="accessibility-line-height"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground">Line Height</span>
                <p className="text-xs text-muted-foreground">
                  Adjust line spacing ({LINE_HEIGHT_MIN}% to {LINE_HEIGHT_MAX}%)
                </p>
              </div>
              <div className="flex min-w-0 shrink-0 items-center gap-3">
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
                  className="min-w-[5.5rem] flex-1 sm:w-24 sm:flex-none"
                  aria-valuenow={lineHeight}
                  aria-valuemin={LINE_HEIGHT_MIN}
                  aria-valuemax={LINE_HEIGHT_MAX}
                  aria-labelledby="line-height-label"
                />
              </div>
            </label>
          </div>

          <div className="min-w-0 rounded-lg border border-primary/20 bg-card p-3">
            <label
              id="letter-spacing-label"
              className="flex min-w-0 cursor-pointer flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              htmlFor="accessibility-letter-spacing"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground">Letter Spacing</span>
                <p className="text-xs text-muted-foreground">
                  Adjust letter spacing ({LETTER_SPACING_MIN} to {LETTER_SPACING_MAX} px)
                </p>
              </div>
              <div className="flex min-w-0 shrink-0 items-center gap-3">
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
                  className="min-w-[5.5rem] flex-1 sm:w-24 sm:flex-none"
                  aria-valuenow={letterSpacing}
                  aria-valuemin={LETTER_SPACING_MIN}
                  aria-valuemax={LETTER_SPACING_MAX}
                  aria-labelledby="letter-spacing-label"
                />
              </div>
            </label>
          </div>

          <div className="min-w-0 rounded-lg border border-primary/20 bg-card p-3">
            <label id="layout-scale-label" className="mb-1 block text-sm font-medium text-foreground">
              Screen fit (layout scale)
            </label>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                className="min-w-[4rem] flex-1 max-w-[12rem]"
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

          <div className="min-w-0 rounded-lg border border-primary/20 bg-card p-3">
            <label id="wheel-scale-label" className="mb-1 block text-sm font-medium text-foreground">
              {isMobile ? 'Card size' : 'Feature wheel size'}
            </label>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                className="min-w-[4rem] flex-1 max-w-[12rem]"
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

          <div className="min-w-0 rounded-lg border border-primary/20 bg-card p-3">
            <div className="mb-1 flex items-center gap-2">
              <label id="scrollbar-size-label" className="block text-sm font-medium text-foreground">
                Chonkiness
              </label>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                className="min-w-[4rem] flex-1 max-w-[12rem]"
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
    </>
  );
}

export type AccessibilityCardsAndBarSlidersProps = {
  cardsSectionWidthPercent?: number;
  setCardsSectionWidthPercent?: (v: number) => void;
  cardBarRows?: number;
  setCardBarRows?: (v: number) => void;
  cardBarColumns?: number;
  setCardBarColumns?: (v: number) => void;
  cardBarPosition?: 'bottom' | 'left' | 'right';
  setCardBarPosition?: (v: 'bottom' | 'left' | 'right') => void;
  showCardBarRowSelector?: boolean;
  setShowCardBarRowSelector?: (v: boolean) => void;
};

export function AccessibilityCardsAndBarSliders({
  cardsSectionWidthPercent,
  setCardsSectionWidthPercent,
  cardBarRows,
  setCardBarRows,
  cardBarColumns,
  setCardBarColumns,
  cardBarPosition,
  setCardBarPosition,
  showCardBarRowSelector,
  setShowCardBarRowSelector,
}: AccessibilityCardsAndBarSlidersProps) {
  return (
    <>
          {setCardsSectionWidthPercent != null && (
            <div className="min-w-0 rounded-lg border border-primary/20 bg-card p-3">
              <label id="cards-section-width-label" className="mb-1 block text-sm font-medium text-foreground">
                Cards section width
              </label>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                  className="min-w-[4rem] flex-1 max-w-[12rem]"
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
            <div className="min-w-0 rounded-lg border border-primary/20 bg-card p-3">
              {setShowCardBarRowSelector != null && (
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex flex-1 items-start gap-2">
                    <div>
                      <span className="text-sm font-medium text-foreground block">Show row/column selector on card bar</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        When checked, a strip appears above or beside the section tabs (Rows for bottom, Columns for left/right). The minimize chevron collapses the whole bar.
                      </p>
                    </div>
                  </div>
                  <Checkbox
                    checked={showCardBarRowSelector}
                    onCheckedChange={(c) => setShowCardBarRowSelector(c === true)}
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
    </>
  );
}
