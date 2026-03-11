/**
 * Password-based encryption for backup files. Uses Web Crypto API:
 * PBKDF2 (SHA-256) for key derivation, AES-GCM for encryption.
 * Encrypted backup format: { encrypted: true, salt, iv, data } (all base64).
 * No password or key is ever persisted.
 */

const PBKDF2_ITERATIONS = 120_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const ALGORITHM = 'AES-GCM';

function getCrypto(): Crypto {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Encryption is not available in this environment.');
  }
  return window.crypto;
}

/**
 * Encrypts a string (e.g. JSON backup). Returns a JSON string of the form
 * { encrypted: true, salt, iv, data } (base64). Same password + same plaintext
 * yields different ciphertext each time (random salt and IV).
 */
export async function encryptBackupPayload(plaintext: string, password: string): Promise<string> {
  const crypto = getCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: 128,
    },
    derivedKey,
    enc.encode(plaintext)
  );

  const payload = {
    encrypted: true,
    salt: b64Encode(salt),
    iv: b64Encode(iv),
    data: b64Encode(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(payload);
}

/**
 * Decrypts a string produced by encryptBackupPayload. Throws if password is wrong
 * or payload is invalid.
 */
export async function decryptBackupPayload(encryptedJson: string, password: string): Promise<string> {
  const crypto = getCrypto();
  let payload: { encrypted?: boolean; salt?: string; iv?: string; data?: string };
  try {
    payload = JSON.parse(encryptedJson) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid encrypted backup format.');
  }
  if (!payload.encrypted || typeof payload.salt !== 'string' || typeof payload.iv !== 'string' || typeof payload.data !== 'string') {
    throw new Error('Invalid encrypted backup format.');
  }

  const salt = b64Decode(payload.salt);
  const iv = b64Decode(payload.iv);
  const data = b64Decode(payload.data);

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['decrypt']
  );

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv as BufferSource,
        tagLength: 128,
      },
      derivedKey,
      data as BufferSource
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Wrong password or corrupted backup.');
  }
}

/** Returns true if the file content looks like an encrypted backup (has encrypted: true). */
export function isEncryptedBackup(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return parsed?.encrypted === true && typeof (parsed as { data?: unknown }).data === 'string';
  } catch {
    return false;
  }
}

function b64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function b64Decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
