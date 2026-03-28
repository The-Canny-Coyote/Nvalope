/**
 * Tests for accessibility constants and clamp functions.
 * Ensures bounds and defaults stay consistent and documented.
 */

import { describe, it, expect } from 'vitest';
import {
  TEXT_SIZE_MIN,
  TEXT_SIZE_MAX,
  TEXT_SIZE_DEFAULT,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_DEFAULT,
  LETTER_SPACING_MIN,
  LETTER_SPACING_MAX,
  LETTER_SPACING_DEFAULT,
  LAYOUT_SCALE_MIN,
  LAYOUT_SCALE_MAX,
  LAYOUT_SCALE_DEFAULT,
  WHEEL_SCALE_MIN,
  WHEEL_SCALE_MAX,
  WHEEL_SCALE_DEFAULT,
  CARD_BAR_SCALE_MIN,
  CARD_BAR_SCALE_MAX,
  CARD_BAR_ROWS_MIN,
  CARD_BAR_ROWS_MAX,
  CARD_BAR_ROWS_DEFAULT,
  SCROLLBAR_SIZE_MIN,
  SCROLLBAR_SIZE_MAX,
  SCROLLBAR_SIZE_DEFAULT,
  clampTextSize,
  clampLineHeight,
  clampLetterSpacing,
  clampLayoutScale,
  clampWheelScale,
  clampCardBarScale,
  clampCardBarRows,
  CARD_BAR_COLUMNS_MIN,
  CARD_BAR_COLUMNS_MAX,
  clampCardBarColumns,
  clampScrollbarSize,
} from './accessibility';

describe('accessibility constants', () => {
  describe('text size', () => {
    it('has min <= default <= max', () => {
      expect(TEXT_SIZE_MIN).toBeLessThanOrEqual(TEXT_SIZE_DEFAULT);
      expect(TEXT_SIZE_DEFAULT).toBeLessThanOrEqual(TEXT_SIZE_MAX);
    });
    it('clampTextSize clamps to bounds', () => {
      expect(clampTextSize(TEXT_SIZE_MIN - 1)).toBe(TEXT_SIZE_MIN);
      expect(clampTextSize(TEXT_SIZE_MAX + 1)).toBe(TEXT_SIZE_MAX);
      expect(clampTextSize(TEXT_SIZE_DEFAULT)).toBe(TEXT_SIZE_DEFAULT);
    });
  });

  describe('line height', () => {
    it('has min <= default <= max', () => {
      expect(LINE_HEIGHT_MIN).toBeLessThanOrEqual(LINE_HEIGHT_DEFAULT);
      expect(LINE_HEIGHT_DEFAULT).toBeLessThanOrEqual(LINE_HEIGHT_MAX);
    });
    it('clampLineHeight clamps to bounds', () => {
      expect(clampLineHeight(LINE_HEIGHT_MIN - 1)).toBe(LINE_HEIGHT_MIN);
      expect(clampLineHeight(LINE_HEIGHT_MAX + 1)).toBe(LINE_HEIGHT_MAX);
    });
  });

  describe('letter spacing', () => {
    it('has min <= default <= max', () => {
      expect(LETTER_SPACING_MIN).toBeLessThanOrEqual(LETTER_SPACING_DEFAULT);
      expect(LETTER_SPACING_DEFAULT).toBeLessThanOrEqual(LETTER_SPACING_MAX);
    });
    it('clampLetterSpacing clamps to bounds', () => {
      expect(clampLetterSpacing(LETTER_SPACING_MIN - 1)).toBe(LETTER_SPACING_MIN);
      expect(clampLetterSpacing(LETTER_SPACING_MAX + 1)).toBe(LETTER_SPACING_MAX);
    });
  });

  describe('layout scale', () => {
    it('has min <= default <= max', () => {
      expect(LAYOUT_SCALE_MIN).toBeLessThanOrEqual(LAYOUT_SCALE_DEFAULT);
      expect(LAYOUT_SCALE_DEFAULT).toBeLessThanOrEqual(LAYOUT_SCALE_MAX);
    });
    it('clampLayoutScale clamps to bounds', () => {
      expect(clampLayoutScale(LAYOUT_SCALE_MIN - 1)).toBe(LAYOUT_SCALE_MIN);
      expect(clampLayoutScale(LAYOUT_SCALE_MAX + 1)).toBe(LAYOUT_SCALE_MAX);
    });
  });

  describe('wheel scale', () => {
    it('has min <= default <= max', () => {
      expect(WHEEL_SCALE_MIN).toBeLessThanOrEqual(WHEEL_SCALE_DEFAULT);
      expect(WHEEL_SCALE_DEFAULT).toBeLessThanOrEqual(WHEEL_SCALE_MAX);
    });
    it('clampWheelScale clamps to bounds', () => {
      expect(clampWheelScale(WHEEL_SCALE_MIN - 1)).toBe(WHEEL_SCALE_MIN);
      expect(clampWheelScale(WHEEL_SCALE_MAX + 1)).toBe(WHEEL_SCALE_MAX);
    });
  });

  describe('card bar scale', () => {
    it('has min < max', () => {
      expect(CARD_BAR_SCALE_MIN).toBeLessThan(CARD_BAR_SCALE_MAX);
    });
    it('clampCardBarScale clamps to bounds', () => {
      expect(clampCardBarScale(CARD_BAR_SCALE_MIN - 1)).toBe(CARD_BAR_SCALE_MIN);
      expect(clampCardBarScale(CARD_BAR_SCALE_MAX + 1)).toBe(CARD_BAR_SCALE_MAX);
    });
  });

  describe('card bar rows', () => {
    it('has min <= default <= max', () => {
      expect(CARD_BAR_ROWS_MIN).toBeLessThanOrEqual(CARD_BAR_ROWS_DEFAULT);
      expect(CARD_BAR_ROWS_DEFAULT).toBeLessThanOrEqual(CARD_BAR_ROWS_MAX);
    });
    it('clampCardBarRows clamps and rounds', () => {
      expect(clampCardBarRows(CARD_BAR_ROWS_MIN - 1)).toBe(CARD_BAR_ROWS_MIN);
      expect(clampCardBarRows(CARD_BAR_ROWS_MAX + 1)).toBe(CARD_BAR_ROWS_MAX);
      expect(clampCardBarRows(1.4)).toBe(1);
      expect(clampCardBarRows(2.6)).toBe(3);
    });
    it('clampCardBarColumns clamps and rounds', () => {
      expect(clampCardBarColumns(CARD_BAR_COLUMNS_MIN - 1)).toBe(CARD_BAR_COLUMNS_MIN);
      expect(clampCardBarColumns(CARD_BAR_COLUMNS_MAX + 1)).toBe(CARD_BAR_COLUMNS_MAX);
      expect(clampCardBarColumns(1.4)).toBe(1);
      expect(clampCardBarColumns(2.6)).toBe(3);
    });
  });

  describe('scrollbar size', () => {
    it('has min <= default <= max', () => {
      expect(SCROLLBAR_SIZE_MIN).toBeLessThanOrEqual(SCROLLBAR_SIZE_DEFAULT);
      expect(SCROLLBAR_SIZE_DEFAULT).toBeLessThanOrEqual(SCROLLBAR_SIZE_MAX);
    });
    it('clampScrollbarSize clamps to bounds', () => {
      expect(clampScrollbarSize(SCROLLBAR_SIZE_MIN - 1)).toBe(SCROLLBAR_SIZE_MIN);
      expect(clampScrollbarSize(SCROLLBAR_SIZE_MAX + 1)).toBe(SCROLLBAR_SIZE_MAX);
    });
  });

  describe('invalid numbers (corrupted storage)', () => {
    it('maps NaN and Infinity to safe defaults so range inputs never receive NaN', () => {
      expect(clampTextSize(Number.NaN)).toBe(TEXT_SIZE_DEFAULT);
      expect(clampLineHeight(Number.POSITIVE_INFINITY)).toBe(LINE_HEIGHT_DEFAULT);
      expect(clampWheelScale(Number.NaN)).toBe(WHEEL_SCALE_DEFAULT);
      expect(clampCardBarScale(Number.NaN)).toBe(CARD_BAR_SCALE_MIN);
      expect(clampScrollbarSize(Number.NaN)).toBe(SCROLLBAR_SIZE_DEFAULT);
      expect(clampCardBarRows(Number.NaN)).toBe(CARD_BAR_ROWS_DEFAULT);
    });
  });
});
