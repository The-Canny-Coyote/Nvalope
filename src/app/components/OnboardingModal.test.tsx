import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getOnboardingDone, setOnboardingDone, resetOnboardingForTesting, OnboardingModal } from './OnboardingModal';

const KEY = 'nvalope-onboarding-done';

describe('OnboardingModal', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getOnboardingDone returns false when not set', () => {
    expect(getOnboardingDone()).toBe(false);
  });

  it('setOnboardingDone then getOnboardingDone returns true', () => {
    setOnboardingDone();
    expect(getOnboardingDone()).toBe(true);
  });

  it('resetOnboardingForTesting clears the key', () => {
    setOnboardingDone();
    expect(getOnboardingDone()).toBe(true);
    resetOnboardingForTesting();
    expect(getOnboardingDone()).toBe(false);
  });

  it('Skip sets storage and calls onComplete', () => {
    const onComplete = vi.fn();
    render(<OnboardingModal open={true} onComplete={onComplete} />);
    const skipBtn = screen.getByRole('button', { name: /skip/i });
    skipBtn.click();
    expect(getOnboardingDone()).toBe(true);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      reducedMotion: false,
      highContrast: false,
      screenReaderMode: false,
      mode: 'standard',
      uiMode: 'normal',
    }));
  });
});
