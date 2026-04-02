/**
 * Shared formatting utilities. Centralizes currency and other display formatting.
 * Locale and currency can be passed for i18n; defaults to en-US and USD.
 */

export interface FormatMoneyOptions {
  locale?: string;
  currency?: string;
}

const DEFAULT_LOCALE = 'en-US';
const DEFAULT_CURRENCY = 'USD';

/** Round to 2 decimal places for money math. Canonical location — do not redefine elsewhere. */
export function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Format a number as currency (e.g. $1,234.56). Defaults to en-US and USD. */
export function formatMoney(n: number, options?: FormatMoneyOptions): string {
  const locale = options?.locale ?? DEFAULT_LOCALE;
  const currency = options?.currency ?? DEFAULT_CURRENCY;
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };

/** Currency code to symbol for use as prefix/suffix (e.g. USD → $). */
export function getCurrencySymbol(currency?: string | null): string {
  const code = (currency ?? DEFAULT_CURRENCY).toUpperCase();
  return CURRENCY_SYMBOLS[code] ?? code;
}

export interface FormatDateOptions {
  locale?: string;
}

/** Format an ISO date string for display (e.g. Jan 15, 2025). Defaults to en-US.
 *  Date-only strings (YYYY-MM-DD) are interpreted at local noon to avoid UTC-midnight off-by-one
 *  in negative-offset timezones (e.g. UTC-5 would show April 14 for "2026-04-15" without this). */
export function formatDate(iso: string, options?: FormatDateOptions): string {
  try {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
    const d = new Date(isDateOnly ? `${iso}T12:00:00` : iso);
    const locale = options?.locale ?? DEFAULT_LOCALE;
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}
