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
  premiumImport: get('VITE_STRIPE_PAYMENT_LINK_PREMIUM_IMPORT'),
} as const;

export function isPlaceholder(url: string): boolean {
  return url === PLACEHOLDER || !url;
}
