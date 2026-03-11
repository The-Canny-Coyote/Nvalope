/**
 * Payment link URLs for Pricing & packages modal.
 * Set via build env for each product.
 */

const PLACEHOLDER = '#';

function get(key: string): string {
  if (typeof import.meta === 'undefined' || !import.meta.env) return PLACEHOLDER;
  const v = (import.meta.env as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim() ? v.trim() : PLACEHOLDER;
}

export const paymentLinks = {
  premiumFull: get('VITE_STRIPE_PAYMENT_LINK_PREMIUM_FULL'),
  starter: get('VITE_STRIPE_PAYMENT_LINK_STARTER'),
  team: get('VITE_STRIPE_PAYMENT_LINK_TEAM'),
  bulkReceipt: get('VITE_STRIPE_PAYMENT_LINK_BULK_RECEIPT'),
  premiumAi: get('VITE_STRIPE_PAYMENT_LINK_PREMIUM_AI'),
  bankPull: get('VITE_STRIPE_PAYMENT_LINK_BANK_PULL'),
} as const;

export function isPlaceholder(url: string): boolean {
  return url === PLACEHOLDER || !url;
}
