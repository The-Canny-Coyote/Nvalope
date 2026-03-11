import { test, expect } from '@playwright/test';
import { waitForApp, dismissDialogs } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('nvalope-onboarding-done', 'true');
    localStorage.setItem('nvalope-backup-prompt-seen', 'true');
  });
  await page.reload();
  await waitForApp(page);
  await dismissDialogs(page);
});

test('open Settings and Check for updates button is present', async ({ page }) => {
  await page.locator('[data-section-id="6"]').first().click();
  await expect(page.getByRole('heading', { name: /Settings & Features/i })).toBeVisible({ timeout: 5000 });
  await page.locator('#settings-data').getByRole('button', { name: /Data Management/i }).click();
  await expect(page.getByRole('button', { name: /Check for updates/i })).toBeVisible();
});

test('Data Management section has Choose backup folder', async ({ page }) => {
  await page.locator('[data-section-id="6"]').first().click();
  await expect(page.getByRole('heading', { name: /Settings & Features/i })).toBeVisible({ timeout: 5000 });
  await page.locator('#settings-data').getByRole('button', { name: /Data Management/i }).click();
  await expect(page.locator('#settings-data').getByText(/Choose backup folder/i)).toBeVisible({ timeout: 5000 });
});

test('Data Management has Encrypt backups and backup actions', async ({ page }) => {
  await page.locator('[data-section-id="6"]').first().click();
  await expect(page.getByRole('heading', { name: /Settings & Features/i })).toBeVisible({ timeout: 5000 });
  await page.locator('#settings-data').getByRole('button', { name: /Data Management/i }).click();
  await expect(page.getByText(/Encrypt backups/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('switch', { name: /Encrypt backup files/i })).toBeVisible();
  await expect(page.getByText(/Export budget data only/i)).toBeVisible();
  await expect(page.getByText(/Import from file/i)).toBeVisible();
});
