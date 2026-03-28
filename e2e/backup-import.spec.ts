import { test, expect } from '@playwright/test';
import { waitForApp, dismissDialogs, prepareE2EStorageBeforeLoad } from './helpers';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.beforeEach(async ({ page }) => {
  await prepareE2EStorageBeforeLoad(page);
  await page.goto('/');
  await waitForApp(page);
  await dismissDialogs(page);
});

test('Import backup file restores envelope data', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: /Settings & Features/i })).toBeVisible({ timeout: 5000 });
  const dataMgmtBtn = page.locator('#settings-data').getByRole('button', { name: /Data Management/i });
  await dataMgmtBtn.click();
  await page.waitForTimeout(300);
  const backupPath = path.join(__dirname, 'fixtures', 'backup.json');
  await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles(backupPath);
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /Close section/i }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Envelopes & Expenses' }).click();
  await expect(page.getByText('E2E Import Envelope').first()).toBeVisible({ timeout: 8000 });
});
