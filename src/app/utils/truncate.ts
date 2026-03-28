/**
 * If text is longer than maxLength (in UTF-16 code units), returns the first maxLength
 * characters plus an ellipsis (…). Otherwise returns text unchanged.
 */
export function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
}
