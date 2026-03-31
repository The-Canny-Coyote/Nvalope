/**
 * NVALOPE PREMIUM — RESTRICTED USE
 *
 * This file is part of the Nvalope Premium feature set.
 * Licensed under MIT + Commons Clause. See LICENSE in the project root for full terms.
 *
 * You may read, fork, and modify this file for personal or self-hosted non-commercial use.
 * You may NOT use this file, or any derivative of it, as part of a product or service
 * that is sold or monetized without a separate commercial license from the author.
 *
 * To inquire about a commercial license: support@nvalope.com
 */

export type EntitlementKey =
  | 'premium_full'
  // Future: multi-user and collaboration mode (not yet client-side implemented)
  | 'team'
  // Gates bulk receipt scanner uploads (batch processing)
  | 'bulk_receipt'
  // Reserved for future premium AI features (voice, actions).
  // WebLLM and the advanced assistant are free — no entitlement required.
  | 'premium_ai'
  // Gates PDF bank statement import and bulk CSV statement import
  | 'premium_import';

export interface EntitlementsResponse {
  premium_full?: boolean;
  team?: boolean;
  bulk_receipt?: boolean;
  premium_ai?: boolean;
  premium_import?: boolean;
}

const ENTITLEMENTS_API_PATH = '/api/entitlements';
const SESSION_API_PATH = '/api/session';
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
    const doFetch = () =>
      fetch(`${base}${ENTITLEMENTS_API_PATH}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

    let res = await doFetch();
    if (res.status === 401) {
      const bootstrap = await fetch(`${base}${SESSION_API_PATH}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!bootstrap.ok) return null;
      res = await doFetch();
    }

    if (!res.ok) return null;
    const data = (await res.json()) as EntitlementsResponse;
    return data;
  } catch {
    return null;
  }
}

export async function bootstrapSession(): Promise<boolean> {
  const base = getApiBase();
  if (!base) return false;
  try {
    const res = await fetch(`${base}${SESSION_API_PATH}`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
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
  // No API URL: production builds must not grant entitlements via localStorage (security).
  // Use VITE_ENABLE_LOCAL_ENTITLEMENTS=true or run the dev server to test entitlement keys locally.
  const allowLocalEntitlementFallback =
    import.meta.env.DEV === true ||
    (import.meta.env.VITE_ENABLE_LOCAL_ENTITLEMENTS as string | undefined) === 'true';
  if (!allowLocalEntitlementFallback) {
    return false;
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
