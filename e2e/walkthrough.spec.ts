/**
 * End-to-end walkthrough: opens major sections in sequence (wheel layout).
 * Uses persisted enabledModules so optional slices (Analytics, Calendar, etc.) are on the wheel.
 */
import { test, expect } from '@playwright/test';
import { gotoAppWithOnboardingDone } from './helpers';
import { CORE_MODULE_IDS } from '../src/app/constants/modules';

const WALKTHROUGH_MODULES = Array.from(
  new Set([...CORE_MODULE_IDS, 'transactions', 'analytics', 'calendar', 'glossary'])
);

async function ensureWheelLayout(page: import('@playwright/test').Page) {
  const wheelBtn = page.getByRole('button', { name: 'Wheel layout' });
  if (await wheelBtn.isVisible()) {
    await wheelBtn.click();
    await page.waitForTimeout(400);
  }
  await page.locator('[data-layout="wheel"]').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function openWheelSection(page: import('@playwright/test').Page, name: string | RegExp) {
  const wheel = page.locator('[data-layout="wheel"]').first();
  const btn = wheel.getByRole('button', { name }).first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ force: true });
}

async function closeOpenSection(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Close section' }).click();
  await page.waitForTimeout(300);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('nvalope-premium-ai-download-notice-seen', 'true');
    } catch {
      /* ignore */
    }
  });
  await gotoAppWithOnboardingDone(page, { enabledModules: WALKTHROUGH_MODULES });
  await ensureWheelLayout(page);
});

test('walkthrough: core and optional sections open without errors', async ({ page }) => {
  await openWheelSection(page, 'Overview');
  await expect(page.getByRole('heading', { name: /Budget Overview/i })).toBeVisible({ timeout: 10000 });
  await closeOpenSection(page);

  await openWheelSection(page, 'Income');
  await expect(page.getByRole('heading', { name: /Income Tracking/i })).toBeVisible({ timeout: 10000 });
  await closeOpenSection(page);

  await openWheelSection(page, 'Envelopes & Expenses');
  await expect(page.getByRole('heading', { name: /Quick Add Expense/i })).toBeVisible({ timeout: 10000 });
  await closeOpenSection(page);

  await openWheelSection(page, 'Transactions');
  await expect(page.getByRole('heading', { name: /Transaction History/i })).toBeVisible({ timeout: 10000 });
  await closeOpenSection(page);

  await openWheelSection(page, 'Analytics');
  await expect(page.getByRole('heading', { name: /^Analytics$/i, level: 3 })).toBeVisible({ timeout: 10000 });
  const chartOrEmpty = page
    .locator('.recharts-responsive-container')
    .first()
    .or(page.getByText(/Add expenses to envelopes|empty|no data/i).first());
  await expect(chartOrEmpty).toBeVisible({ timeout: 15000 });
  await closeOpenSection(page);

  await openWheelSection(page, 'Calendar');
  await expect(page.getByRole('heading', { name: /^Calendar$/i, level: 3 })).toBeVisible({ timeout: 10000 });
  await closeOpenSection(page);

  await openWheelSection(page, 'Glossary');
  await expect(page.getByRole('heading', { name: /^Glossary$/i }).last()).toBeVisible({ timeout: 10000 });
  await closeOpenSection(page);

  await openWheelSection(page, 'Accessibility');
  await expect(page.getByRole('button', { name: /Standard Accessibility Options/i })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: /Standard Accessibility Options/i }).click();
  await expect(page.getByRole('button', { name: /Reduced motion.*click to turn/i })).toBeVisible({ timeout: 10000 });
  await closeOpenSection(page);

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: /Settings & Features/i })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Close section' }).click();
});
