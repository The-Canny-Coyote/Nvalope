import { test, expect } from '@playwright/test';
import { waitForApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('nvalope-onboarding-done');
    localStorage.setItem('nvalope-backup-prompt-seen', 'true');
  });
  await page.reload();
});

test('Skip closes onboarding and app is usable', async ({ page }) => {
  await waitForApp(page);
  const modal = page.getByRole('dialog').filter({ has: page.getByText(/Welcome to Nvalope/i) });
  await expect(modal).toBeVisible({ timeout: 8000 });
  const skipBtn = page.getByRole('button', { name: /skip/i });
  await expect(skipBtn).toBeVisible({ timeout: 3000 });
  await skipBtn.click();
  await expect(modal).not.toBeVisible({ timeout: 5000 });
  const wheelOrList = page.locator('svg').first().or(page.getByText(/Focus Mode - Simple List/i));
  await expect(wheelOrList).toBeVisible({ timeout: 10000 });
});
