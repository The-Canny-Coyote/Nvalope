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

test('app loads and shows main content', async ({ page }) => {
  await expect(page.getByRole('application', { name: /nvalope budget app/i })).toBeVisible();
  await expect(page.getByText(/Nvalope/i).first()).toBeVisible();
});

test('wheel or list is visible', async ({ page }) => {
  const wheelOrList = page.locator('svg').first().or(page.getByText(/Focus Mode - Simple List/i));
  await expect(wheelOrList).toBeVisible({ timeout: 10000 });
});

test('Settings can be opened from wheel', async ({ page }) => {
  await page.locator('[data-section-id="6"]').first().click();
  await expect(page.getByRole('heading', { name: /Settings & Features/i })).toBeVisible({ timeout: 5000 });
});
