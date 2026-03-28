import { test, expect } from '@playwright/test';
import { waitForApp, dismissDialogs, prepareE2EStorageBeforeLoad } from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await prepareE2EStorageBeforeLoad(page);
  await page.goto('/');
  await waitForApp(page);
  await dismissDialogs(page);
});

test('Receipt Scanner section opens and shows upload and recent scans', async ({ page }) => {
  await page.getByRole('button', { name: 'Wheel layout' }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);

  const settingsEntry = page.getByRole('button', { name: 'Settings' });
  await settingsEntry.scrollIntoViewIfNeeded();
  await settingsEntry.click({ timeout: 10000 });
  await expect(page.getByTestId('section-content')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: /Settings & Features/i })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Optional features', exact: true }).click();
  await page.waitForTimeout(300);
  const receiptToggle = page.getByTestId('module-receiptScanner').getByRole('checkbox', { name: /Receipt Scanner/i });
  if (await receiptToggle.getAttribute('aria-checked') === 'false') {
    await receiptToggle.click();
    await page.waitForTimeout(200);
  }

  await page.locator('[data-layout="wheel"]').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const receiptSlice = page.locator('[data-layout="wheel"] [data-section-id="100"]');
  await receiptSlice.waitFor({ state: 'visible', timeout: 8000 });
  await receiptSlice.click();

  await expect(page.getByRole('heading', { name: 'Receipt Scanner', level: 2 })).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('button', { name: /Upload image/i })).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole('button', { name: /Take photo/i })).toBeVisible({ timeout: 3000 });
  await expect(page.getByText('Recent scans')).toBeVisible({ timeout: 3000 });
  await expect(page.getByText(/No receipts scanned yet|Upload an image above/i)).toBeVisible({ timeout: 3000 });
});

test('Receipt Scanner shows supported image formats and glossary', async ({ page }) => {
  await page.getByRole('button', { name: 'Wheel layout' }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);
  const settingsEntry = page.getByRole('button', { name: 'Settings' });
  await settingsEntry.scrollIntoViewIfNeeded();
  await settingsEntry.click({ timeout: 10000 });
  await expect(page.getByTestId('section-content')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: /Settings & Features/i })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Optional features', exact: true }).click();
  await page.waitForTimeout(300);
  const receiptToggle = page.getByTestId('module-receiptScanner').getByRole('checkbox', { name: /Receipt Scanner/i });
  if (await receiptToggle.getAttribute('aria-checked') === 'false') {
    await receiptToggle.click();
    await page.waitForTimeout(200);
  }
  await page.locator('[data-layout="wheel"]').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const receiptSlice = page.locator('[data-layout="wheel"] [data-section-id="100"]');
  await receiptSlice.waitFor({ state: 'visible', timeout: 8000 });
  await receiptSlice.click();

  await expect(page.getByRole('heading', { name: 'Receipt Scanner', level: 2 })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/JPEG|PNG|WebP|GIF|BMP|AVIF|HEIC/i)).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole('link', { name: 'Download sample' })).toBeVisible({ timeout: 3000 });
});
