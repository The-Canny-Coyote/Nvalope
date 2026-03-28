/**
 * Tests for hint labels used in Settings "re-enable hints" and by HintIcon.
 */

import { describe, it, expect } from 'vitest';
import { HINT_LABELS, getHintLabel } from './hints';

describe('hints', () => {
  describe('getHintLabel', () => {
    it('returns label for known id', () => {
      expect(getHintLabel('main-wheel')).toBe('Wheel menu');
      expect(getHintLabel('accessibility-sliders')).toBe('Sliders');
    });
    it('returns id when unknown', () => {
      expect(getHintLabel('unknown-id')).toBe('unknown-id');
    });
  });

  describe('HINT_LABELS', () => {
    it('has non-empty labels for all entries', () => {
      for (const [id, label] of Object.entries(HINT_LABELS)) {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    });
  });
});
