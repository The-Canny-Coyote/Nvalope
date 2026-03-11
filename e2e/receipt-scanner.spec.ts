import { test, expect } from '@playwright/test';
import { waitForApp, dismissDialogs } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('nvalope-onboarding-done', 'true');
    localStorage.setItem('nvalope-backup-prompt-seen', 'true');
    const persist = {
      state: {
        enabledModules: ['overview', 'income', 'envelopes', 'accessibility', 'transactions'],
        useCardLayout: false,
        uiMode: 'normal',
      },
      version: 0,
    };
    localStorage.setItem('nvalope-app-persist', JSON.stringify(persist));
  });
  await page.reload();
  await waitForApp(page);
  await dismissDialogs(page);
});

test('Receipt Scanner section opens and shows upload and recent scans', async ({ page }) => {
  await page.getByRole('button', { name: 'Wheel layout' }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);

  await page.locator('[data-section-id="6"], [aria-label="Settings"]').first().click({ force: true });
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Optional features', exact: true }).click();
  await page.waitForTimeout(300);
  const receiptSwitch = page.getByTestId('module-receiptScanner').getByRole('switch', { name: /Receipt Scanner/i });
  if (await receiptSwitch.getAttribute('aria-checked') === 'false') {
    await receiptSwitch.click();
    await page.waitForTimeout(200);
  }

  await page.locator('[data-layout="wheel"]').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const receiptSlice = page.locator('[data-section-id="100"], [aria-label="Receipt Scanner"]').first();
  await receiptSlice.waitFor({ state: 'visible', timeout: 8000 });
  await receiptSlice.click({ force: true });

  await expect(page.getByRole('heading', { name: 'Receipt Scanner', level: 2 })).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('button', { name: /Upload image/i })).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole('button', { name: /Take photo/i })).toBeVisible({ timeout: 3000 });
  await expect(page.getByText('Recent scans')).toBeVisible({ timeout: 3000 });
  await expect(page.getByText(/No receipts scanned yet|Upload an image above/i)).toBeVisible({ timeout: 3000 });
});

test('Receipt Scanner shows supported image formats and glossary', async ({ page }) => {
  await page.getByRole('button', { name: 'Wheel layout' }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);
  await page.locator('[data-section-id="6"], [aria-label="Settings"]').first().click({ force: true });
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Optional features', exact: true }).click();
  await page.waitForTimeout(300);
  const receiptSwitch = page.getByTestId('module-receiptScanner').getByRole('switch', { name: /Receipt Scanner/i });
  if (await receiptSwitch.getAttribute('aria-checked') === 'false') {
    await receiptSwitch.click();
    await page.waitForTimeout(200);
  }
  await page.locator('[data-layout="wheel"]').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const receiptSlice = page.locator('[data-section-id="100"], [aria-label="Receipt Scanner"]').first();
  await receiptSlice.waitFor({ state: 'visible', timeout: 8000 });
  await receiptSlice.click({ force: true });

  await expect(page.getByRole('heading', { name: 'Receipt Scanner', level: 2 })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/JPEG|PNG|WebP|GIF|BMP|AVIF|HEIC/i)).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole('link', { name: 'Download sample' })).toBeVisible({ timeout: 3000 });
});
