import { test, expect } from '@playwright/test';
import { gotoAppWithOnboardingDone } from './helpers';

test.beforeEach(async ({ page }) => {
  await gotoAppWithOnboardingDone(page);
});

test('open Settings and Check for updates button is present', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: /Settings & Features/i })).toBeVisible({ timeout: 5000 });
  await page.locator('#settings-data').getByRole('button', { name: /Data Management/i }).click();
  await expect(page.getByRole('button', { name: /Check for updates/i })).toBeVisible();
});

test('Data Management section has Choose backup folder', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: /Settings & Features/i })).toBeVisible({ timeout: 5000 });
  await page.locator('#settings-data').getByRole('button', { name: /Data Management/i }).click();
  await expect(page.locator('#settings-data').getByText(/Choose backup folder/i)).toBeVisible({ timeout: 5000 });
});

test('Data Management has Encrypt backups and backup actions', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: /Settings & Features/i })).toBeVisible({ timeout: 5000 });
  await page.locator('#settings-data').getByRole('button', { name: /Data Management/i }).click();
  await expect(page.getByText(/Encrypt backups/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('checkbox', { name: /Encrypt backup files with a password/i })).toBeVisible();
  await expect(page.getByText(/Export budget data only/i)).toBeVisible();
  await expect(page.getByText(/Import from file/i)).toBeVisible();
});
