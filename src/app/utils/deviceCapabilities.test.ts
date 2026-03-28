import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDevicePerformanceTier } from './deviceCapabilities';

describe('getDevicePerformanceTier', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
    vi.restoreAllMocks();
  });

  it('returns low when navigator is undefined (e.g. SSR)', () => {
    const nav = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });
    expect(getDevicePerformanceTier()).toBe('low');
    Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
  });

  it('returns high when cores >= 8 and ram >= 8', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { hardwareConcurrency: 8, deviceMemory: 8 },
      configurable: true,
    });
    expect(getDevicePerformanceTier()).toBe('high');
  });

  it('returns medium when cores >= 4 and ram >= 4 but not high', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { hardwareConcurrency: 4, deviceMemory: 4 },
      configurable: true,
    });
    expect(getDevicePerformanceTier()).toBe('medium');
  });

  it('returns low when cores and ram below thresholds', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { hardwareConcurrency: 2, deviceMemory: 2 },
      configurable: true,
    });
    expect(getDevicePerformanceTier()).toBe('low');
  });

  it('uses default 2 cores and 4 ram when values missing', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
    });
    expect(getDevicePerformanceTier()).toBe('low');
  });
});
