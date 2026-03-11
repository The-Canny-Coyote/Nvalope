/**
 * Entitlements: premium gate and hasEntitlement behavior.
 * When VITE_PREMIUM_AVAILABLE is not 'true', premium is disabled (prod default).
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  hasEntitlement,
  isPremiumFeatureEnabled,
  getApiBase,
} from './entitlements';

describe('entitlements', () => {
  const fullEntitlements = {
    premium_full: true,
    team: true,
    bulk_receipt: true,
    premium_ai: true,
    bank_pull: true,
  };

  describe('isPremiumFeatureEnabled', () => {
    const env = import.meta.env as { VITE_PREMIUM_AVAILABLE?: string };
    const original = env.VITE_PREMIUM_AVAILABLE;

    afterEach(() => {
      env.VITE_PREMIUM_AVAILABLE = original;
    });

    it('returns false when VITE_PREMIUM_AVAILABLE is unset (prod default)', () => {
      delete env.VITE_PREMIUM_AVAILABLE;
      expect(isPremiumFeatureEnabled()).toBe(false);
    });

    it('returns false when VITE_PREMIUM_AVAILABLE is not exactly "true"', () => {
      env.VITE_PREMIUM_AVAILABLE = 'false';
      expect(isPremiumFeatureEnabled()).toBe(false);
      env.VITE_PREMIUM_AVAILABLE = '1';
      expect(isPremiumFeatureEnabled()).toBe(false);
    });

    it('returns true only when VITE_PREMIUM_AVAILABLE is "true"', () => {
      env.VITE_PREMIUM_AVAILABLE = 'true';
      expect(isPremiumFeatureEnabled()).toBe(true);
    });
  });

  describe('hasEntitlement when premium feature is disabled', () => {
    it('returns false for any key when premium is disabled (no entitlements)', () => {
      // In test env, VITE_PREMIUM_AVAILABLE is typically unset, so premium is off
      if (!isPremiumFeatureEnabled()) {
        expect(hasEntitlement('premium_full', fullEntitlements)).toBe(false);
        expect(hasEntitlement('team', fullEntitlements)).toBe(false);
        expect(hasEntitlement('bank_pull', null)).toBe(false);
      }
    });
  });

  describe('getApiBase', () => {
    it('returns empty string when VITE_API_BASE is unset', () => {
      expect(getApiBase()).toBe('');
    });
  });
});
