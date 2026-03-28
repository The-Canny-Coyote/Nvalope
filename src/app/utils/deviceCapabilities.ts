/**
 * Detects device performance tier based on available hardware.
 * Helps determine if we can enable "Beefed Up" basic logic (Basic+) without Premium.
 */

interface NavigatorDeviceMemory {
  deviceMemory?: number;
}

export type PerformanceTier = 'low' | 'medium' | 'high';

export function getDevicePerformanceTier(): PerformanceTier {
  if (typeof navigator === 'undefined') return 'low';

  const nav = navigator as Navigator & NavigatorDeviceMemory;
  const cores = nav.hardwareConcurrency ?? 2;
  const ram = nav.deviceMemory ?? 4;

  if (cores >= 8 && ram >= 8) return 'high';
  if (cores >= 4 && ram >= 4) return 'medium';
  return 'low';
}
