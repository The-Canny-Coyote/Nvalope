const LONG_DIGIT_RUN = /\b\d{7,}\b/g;
const ARTIFACTS =
  /\b(POS|ACH|TFR|CHECKCARD|DEBIT|CREDIT|CARD|PURCHASE|PMT|PAYMENT)\b/gi;
/** MM/DD, MM-DD-YY, YYYY-MM-DD fragments */
const DATE_FRAGMENTS = /\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b/g;

function toTitleCaseWords(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * @param raw Original payee / description from statement
 */
export function normalizePayee(raw: string): string {
  let s = raw.trim();
  s = s.replace(LONG_DIGIT_RUN, ' ');
  s = s.replace(ARTIFACTS, ' ');
  s = s.replace(DATE_FRAGMENTS, ' ');
  s = s.replace(/[^a-zA-Z0-9\s'.&/-]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return toTitleCaseWords(s);
}
