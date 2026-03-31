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

import { useEffect, useMemo, useState } from 'react';
import { fetchEntitlements, getApiBase, hasEntitlement, isPremiumFeatureEnabled } from '@/app/premium/entitlements';
import { getModuleConfig } from '@/app/constants/modules';

const PREMIUM_MODULE_ENTITLEMENTS: Record<string, 'premium_full' | 'premium_ai'> = {};

export function usePremiumEntitlements(enabledModules: string[]) {
  const [entitlementsFromApi, setEntitlementsFromApi] = useState<Awaited<ReturnType<typeof fetchEntitlements>>>(null);

  useEffect(() => {
    fetchEntitlements().then(setEntitlementsFromApi);
  }, []);

  const apiConfigured = getApiBase().length > 0;
  const isPremium =
    isPremiumFeatureEnabled() &&
    (apiConfigured
      ? entitlementsFromApi !== null &&
        enabledModules.some((id) => {
          const module = getModuleConfig(id);
          if (!module?.premiumOnly) return false;
          const required = PREMIUM_MODULE_ENTITLEMENTS[id] ?? 'premium_full';
          return hasEntitlement(required, entitlementsFromApi);
        })
      : false);

  const effectiveEnabledModules = useMemo(
    () =>
      enabledModules.filter((id) => {
        const module = getModuleConfig(id);
        if (!module?.premiumOnly) return true;
        const required = PREMIUM_MODULE_ENTITLEMENTS[id] ?? 'premium_full';
        return hasEntitlement(required, entitlementsFromApi);
      }),
    [enabledModules, entitlementsFromApi]
  );

  return { entitlementsFromApi, isPremium, effectiveEnabledModules };
}
