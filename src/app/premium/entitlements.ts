export type EntitlementKey =
  | 'premium_full'
  | 'team'
  | 'bulk_receipt'
  | 'premium_ai'
  | 'bank_pull';

export interface EntitlementsResponse {
  premium_full?: boolean;
  team?: boolean;
  bulk_receipt?: boolean;
  premium_ai?: boolean;
  bank_pull?: boolean;
}

const ENTITLEMENTS_API_PATH = '/api/entitlements';
const STORAGE_KEY_PREFIX = 'nvalope-entitlement-';

export function isPremiumFeatureEnabled(): boolean {
  return (import.meta.env?.VITE_PREMIUM_AVAILABLE as string) === 'true';
}

export function getApiBase(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) {
    return (import.meta.env.VITE_API_BASE as string).replace(/\/$/, '');
  }
  return '';
}

export async function fetchEntitlements(): Promise<EntitlementsResponse | null> {
  const base = getApiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}${ENTITLEMENTS_API_PATH}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as EntitlementsResponse;
    return data;
  } catch {
    return null;
  }
}

export function hasEntitlement(
  key: EntitlementKey,
  fromApi: EntitlementsResponse | null
): boolean {
  if (!isPremiumFeatureEnabled()) return false;
  const apiConfigured = getApiBase().length > 0;
  if (apiConfigured) {
    if (fromApi === null) return false;
    if (fromApi.premium_full) return true;
    return !!(fromApi as Record<string, boolean>)[key];
  }
  if (fromApi?.premium_full) return true;
  if (fromApi && key in fromApi && (fromApi as Record<string, boolean>)[key]) return true;
  try {
    if (localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`) === 'true') return true;
    if (key !== 'premium_full' && localStorage.getItem(`${STORAGE_KEY_PREFIX}premium_full`) === 'true') return true;
  } catch {
    // ignore
  }
  return false;
}

export function setLocalEntitlement(key: EntitlementKey, value: boolean): void {
  if (getApiBase().length > 0) return;
  try {
    if (value) localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, 'true');
    else localStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
  } catch {
    // ignore
  }
}
