import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { gotoAppWithOnboardingDone } from './helpers';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const fixture1 = path.join(e2eDir, 'fixtures', 'statement-e2e-1.csv');
const fixture2 = path.join(e2eDir, 'fixtures', 'statement-e2e-2.csv');

test.describe('bank statement import', () => {
  test('CSV upload, confirm, re-upload dedupes and imports only new row', async ({ page }) => {
    await gotoAppWithOnboardingDone(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: /Settings & Features/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Data Management/i }).click();
    await page.getByTestId('statement-import-input').setInputFiles(fixture1);
    await expect(page.getByText(/Statement preview/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/In preview queue: 1 debit row/i)).toBeVisible();
    await page.getByRole('button', { name: /Per-row view/i }).click();
    await expect(page.getByText(/E2E Statement Row Alpha/i)).toBeVisible();
    await page.getByRole('button', { name: /Confirm statement import/i }).click();
    await expect(page.getByText(/Statement preview/i)).not.toBeVisible({ timeout: 10_000 });

    await page.getByTestId('statement-import-input').setInputFiles(fixture2);
    await expect(page.getByText(/Statement preview/i)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /Per-row view/i }).click();
    await expect(page.getByText(/E2E Statement Row Beta/i)).toBeVisible();
    await page.getByRole('button', { name: /Confirm statement import/i }).click();
    await expect(page.getByText(/Imported 1 transactions/i)).toBeVisible({ timeout: 10_000 });
  });
});
