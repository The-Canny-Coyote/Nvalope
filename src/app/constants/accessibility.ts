/** Accessibility slider bounds and defaults. Used by App and AccessibilityContent. */

/** Reject NaN/Infinity so corrupted storage or merges never produce invalid <input type="range"> values (avoids section error boundaries on mobile). */
function sanitizeFinite(value: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Text size: 85–130% keeps body text readable without breaking layout. */
export const TEXT_SIZE_MIN = 85;
export const TEXT_SIZE_MAX = 130;
export const TEXT_SIZE_DEFAULT = 100;

/** Line height: 120–200% (1.2–2.0) is a typical readable range. */
export const LINE_HEIGHT_MIN = 120;
export const LINE_HEIGHT_MAX = 200;
export const LINE_HEIGHT_DEFAULT = 150;

/** Letter spacing: 0–4px; enough for readability without excessive spread. */
export const LETTER_SPACING_MIN = 0;
export const LETTER_SPACING_MAX = 4;
export const LETTER_SPACING_DEFAULT = 0;

/** Layout scale: 75–100%. 100 = no scaling; below 75% creates usability problems. */
export const LAYOUT_SCALE_MIN = 75;
export const LAYOUT_SCALE_MAX = 100;
export const LAYOUT_SCALE_DEFAULT = 100;

/** Wheel size: 60–120% keeps the wheel usable without dominating or shrinking too much. */
export const WHEEL_SCALE_MIN = 60;
export const WHEEL_SCALE_MAX = 120;
/** Default 75% (25% smaller than full size) so the wheel does not dominate the screen. */
export const WHEEL_SCALE_DEFAULT = 75;

/** Mobile bottom card bar: 75–120% so cards stay readable and don’t dominate the screen. */
export const CARD_BAR_SCALE_MIN = 75;
export const CARD_BAR_SCALE_MAX = 120;

/** Cards section width: 60–120%. Bottom = max-width % of viewport; left/right = width as % of default 72px. */
export const CARDS_SECTION_WIDTH_MIN = 60;
export const CARDS_SECTION_WIDTH_MAX = 120;
export const CARDS_SECTION_WIDTH_DEFAULT = 100;

/** Card bar rows: 0 = auto (2 rows on narrow screens), 1–3 = fixed row count. */
export const CARD_BAR_ROWS_MIN = 0;
export const CARD_BAR_ROWS_MAX = 3;
export const CARD_BAR_ROWS_DEFAULT = 0;

/** Card bar columns (when position is left/right): 0 = auto, 1–3 = fixed column count. */
export const CARD_BAR_COLUMNS_MIN = 0;
export const CARD_BAR_COLUMNS_MAX = 3;
export const CARD_BAR_COLUMNS_DEFAULT = 0;

/** Width of one section cell when card bar is on left/right (px). */
export const CARD_BAR_SIDE_CELL_WIDTH_PX = 72;
/** Height of the column selector strip when expanded (vertical bar). */
export const CARD_BAR_SIDE_SELECTOR_STRIP_PX = 36;
/** Minimized bar strip size (height when bottom, width when left/right). */
export const CARD_BAR_MINIMIZED_STRIP_PX = 36;
/** Height of the row selector strip when expanded (bottom bar). */
export const BOTTOM_NAV_BAR_ROW_SELECTOR_STRIP_PX = 36;
/** Height of the row selector strip when minimized (legacy; full-bar minimize uses CARD_BAR_MINIMIZED_STRIP_PX). */
export const BOTTOM_NAV_BAR_ROW_SELECTOR_STRIP_MINIMIZED_PX = 28;

/** Scrollbar thickness (px). “Chonkiness” – larger is easier to see and grab. */
export const SCROLLBAR_SIZE_MIN = 6;
export const SCROLLBAR_SIZE_MAX = 28;
export const SCROLLBAR_SIZE_DEFAULT = 10;

export function clampTextSize(value: number): number {
  const v = sanitizeFinite(value, TEXT_SIZE_DEFAULT);
  return Math.min(TEXT_SIZE_MAX, Math.max(TEXT_SIZE_MIN, v));
}

export function clampLineHeight(value: number): number {
  const v = sanitizeFinite(value, LINE_HEIGHT_DEFAULT);
  return Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, v));
}

export function clampLetterSpacing(value: number): number {
  const v = sanitizeFinite(value, LETTER_SPACING_DEFAULT);
  return Math.min(LETTER_SPACING_MAX, Math.max(LETTER_SPACING_MIN, v));
}

export function clampLayoutScale(value: number): number {
  const v = sanitizeFinite(value, LAYOUT_SCALE_DEFAULT);
  return Math.min(LAYOUT_SCALE_MAX, Math.max(LAYOUT_SCALE_MIN, v));
}

export function clampWheelScale(value: number): number {
  const v = sanitizeFinite(value, WHEEL_SCALE_DEFAULT);
  return Math.min(WHEEL_SCALE_MAX, Math.max(WHEEL_SCALE_MIN, v));
}

export function clampCardBarScale(value: number): number {
  const v = sanitizeFinite(value, CARD_BAR_SCALE_MIN);
  return Math.min(CARD_BAR_SCALE_MAX, Math.max(CARD_BAR_SCALE_MIN, v));
}

export function clampCardBarRows(value: number): number {
  const v = sanitizeFinite(value, CARD_BAR_ROWS_DEFAULT);
  return Math.min(CARD_BAR_ROWS_MAX, Math.max(CARD_BAR_ROWS_MIN, Math.round(v)));
}

export function clampCardBarColumns(value: number): number {
  const v = sanitizeFinite(value, CARD_BAR_COLUMNS_DEFAULT);
  return Math.min(CARD_BAR_COLUMNS_MAX, Math.max(CARD_BAR_COLUMNS_MIN, Math.round(v)));
}

export function clampCardsSectionWidth(value: number): number {
  const v = sanitizeFinite(value, CARDS_SECTION_WIDTH_DEFAULT);
  return Math.min(CARDS_SECTION_WIDTH_MAX, Math.max(CARDS_SECTION_WIDTH_MIN, v));
}

export function clampScrollbarSize(value: number): number {
  const v = sanitizeFinite(value, SCROLLBAR_SIZE_DEFAULT);
  return Math.min(SCROLLBAR_SIZE_MAX, Math.max(SCROLLBAR_SIZE_MIN, v));
}
