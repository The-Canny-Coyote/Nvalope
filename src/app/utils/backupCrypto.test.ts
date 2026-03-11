import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  encryptBackupPayload,
  decryptBackupPayload,
  isEncryptedBackup,
} from './backupCrypto';
import { parseBudgetBackup } from '@/app/store/budgetTypes';
import type { BudgetState } from '@/app/store/budgetTypes';

describe('backupCrypto', () => {
  beforeEach(() => {
    const webcrypto = globalThis.crypto;
    if (webcrypto?.subtle) {
      vi.stubGlobal('window', { crypto: webcrypto });
    }
  });

  const hasWebCrypto = typeof globalThis.crypto?.subtle !== 'undefined';

  describe('isEncryptedBackup', () => {
    it('returns false for plain JSON', () => {
      expect(isEncryptedBackup('{}')).toBe(false);
      expect(isEncryptedBackup('{"version":2,"budget":{}}')).toBe(false);
      expect(isEncryptedBackup('{"encrypted":false}')).toBe(false);
      expect(isEncryptedBackup('{"encrypted":true}')).toBe(false);
      expect(isEncryptedBackup('{"encrypted":true,"data":123}')).toBe(false);
    });

    it('returns true for valid encrypted shape', () => {
      expect(isEncryptedBackup('{"encrypted":true,"salt":"x","iv":"y","data":"z"}')).toBe(true);
    });

    it('returns false for invalid JSON', () => {
      expect(isEncryptedBackup('not json')).toBe(false);
      expect(isEncryptedBackup('')).toBe(false);
    });
  });

  describe('encryptBackupPayload / decryptBackupPayload', () => {
    it('roundtrips plaintext when Web Crypto is available', async () => {
      if (!hasWebCrypto) {
        return;
      }
      const plain = '{"budget":{},"version":2}';
      const password = 'test-password-123';
      const encrypted = await encryptBackupPayload(plain, password);
      expect(isEncryptedBackup(encrypted)).toBe(true);
      const parsed = JSON.parse(encrypted) as Record<string, unknown>;
      expect(parsed.salt).toBeDefined();
      expect(parsed.iv).toBeDefined();
      expect(parsed.data).toBeDefined();
      expect(typeof parsed.salt).toBe('string');
      expect(typeof parsed.iv).toBe('string');
      expect(typeof parsed.data).toBe('string');

      const decrypted = await decryptBackupPayload(encrypted, password);
      expect(decrypted).toBe(plain);
    });

    it('same password and plaintext yield different ciphertext (random salt/IV)', async () => {
      if (!hasWebCrypto) {
        return;
      }
      const plain = '{"x":1}';
      const enc1 = await encryptBackupPayload(plain, 'pwd');
      const enc2 = await encryptBackupPayload(plain, 'pwd');
      expect(enc1).not.toBe(enc2);
      const p1 = JSON.parse(enc1) as Record<string, string>;
      const p2 = JSON.parse(enc2) as Record<string, string>;
      expect(p1.salt).not.toBe(p2.salt);
      expect(p1.iv).not.toBe(p2.iv);
      expect(p1.data).not.toBe(p2.data);
    });

    it('wrong password throws on decrypt', async () => {
      if (!hasWebCrypto) {
        return;
      }
      const encrypted = await encryptBackupPayload('secret', 'right');
      await expect(decryptBackupPayload(encrypted, 'wrong')).rejects.toThrow(
        /Wrong password or corrupted backup/
      );
    });

    it('invalid encrypted format throws on decrypt', async () => {
      if (!hasWebCrypto) {
        return;
      }
      await expect(decryptBackupPayload('{}', 'pwd')).rejects.toThrow(/Invalid encrypted backup format/);
      await expect(decryptBackupPayload('{"encrypted":true}', 'pwd')).rejects.toThrow(/Invalid encrypted backup format/);
      await expect(decryptBackupPayload('not json', 'pwd')).rejects.toThrow(/Invalid encrypted backup format/);
    });

    it('throws when encryption not available (no window.crypto.subtle)', async () => {
      vi.stubGlobal('window', {});
      await expect(encryptBackupPayload('x', 'p')).rejects.toThrow(/Encryption is not available/);
    });

    it('full backup roundtrip: encrypt snapshot, decrypt, parseBudgetBackup yields valid state', async () => {
      if (!hasWebCrypto) return;
      const budget: BudgetState = {
        envelopes: [{ id: 'e1', name: 'Groceries', limit: 500, spent: 50 }],
        transactions: [{ id: 't1', amount: 50, envelopeId: 'e1', description: 'Test', date: '2025-01-15', createdAt: new Date().toISOString() }],
        income: [{ id: 'i1', amount: 3000, source: 'Job', date: '2025-01-01', createdAt: new Date().toISOString() }],
        savingsGoals: [],
        bills: [],
      };
      const fullSnapshot = { budget, settings: { layoutScale: 100 }, premium: false, appData: { assistantMessages: [] } };
      const plain = JSON.stringify(fullSnapshot);
      const encrypted = await encryptBackupPayload(plain, 'backup-pwd');
      expect(isEncryptedBackup(encrypted)).toBe(true);
      const decrypted = await decryptBackupPayload(encrypted, 'backup-pwd');
      const parsed = parseBudgetBackup(JSON.parse(decrypted) as Record<string, unknown>);
      expect(parsed.envelopes).toHaveLength(1);
      expect(parsed.envelopes[0].name).toBe('Groceries');
      expect(parsed.transactions).toHaveLength(1);
      expect(parsed.transactions[0].amount).toBe(50);
      expect(parsed.income).toHaveLength(1);
      expect(parsed.income[0].source).toBe('Job');
    });
  });
});
