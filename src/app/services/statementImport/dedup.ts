const SEP = '\u001f';

/** Concatenation used before digest — documented for test stability. */
export function importHashPayload(accountId: string, postedDate: string, amountSigned: number, payeeRaw: string): string {
  return `${accountId}${SEP}${postedDate}${SEP}${amountSigned}${SEP}${payeeRaw}`;
}

function hexFromBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Web Crypto SHA-256 (hex). Prefer in browser and worker; Vitest uses Node webcrypto.
 */
export async function computeImportHash(
  accountId: string,
  postedDate: string,
  amountSigned: number,
  payeeRaw: string
): Promise<string> {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) {
    throw new Error('crypto.subtle is not available');
  }
  const data = new TextEncoder().encode(importHashPayload(accountId, postedDate, amountSigned, payeeRaw));
  const digest = await cryptoObj.subtle.digest('SHA-256', data);
  return hexFromBuffer(digest);
}

/** Signed amount for debits (negative) / credits (positive) as stored in canonical form. */
export function debitAmountToSignedExpense(amount: number): number {
  return -Math.abs(amount);
}

export function signedExpenseToDebitAmount(signed: number): number {
  return Math.abs(signed);
}

/** SHA-256 hex for arbitrary UTF-8 text (e.g. CSV header fingerprint). */
export async function sha256HexFromString(text: string): Promise<string> {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) {
    throw new Error('crypto.subtle is not available');
  }
  const data = new TextEncoder().encode(text);
  const digest = await cryptoObj.subtle.digest('SHA-256', data);
  return hexFromBuffer(digest);
}
