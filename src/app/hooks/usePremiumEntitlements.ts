import { useEffect, useMemo, useState } from 'react';
import { fetchEntitlements, getApiBase, hasEntitlement, isPremiumFeatureEnabled } from '@/app/premium/entitlements';
import { getModuleConfig } from '@/app/constants/modules';

const PREMIUM_MODULE_ENTITLEMENTS: Record<string, 'premium_full' | 'premium_ai'> = {
  advancedAICache: 'premium_ai',
};

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
