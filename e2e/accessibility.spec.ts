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

test('Accessibility section opens and shows sliders with correct bounds', async ({ page }) => {
  await page.locator('[data-section-id="5"]').first().click();
  await expect(page.getByText('Standard Accessibility Options')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Standard Accessibility Options/i }).first().click();
  await page.waitForTimeout(300);

  const textSizeSlider = page.locator('#accessibility-text-size');
  await expect(textSizeSlider).toHaveAttribute('min', '85');
  await expect(textSizeSlider).toHaveAttribute('max', '130');

  const lineHeightSlider = page.locator('#accessibility-line-height');
  await expect(lineHeightSlider).toHaveAttribute('min', '120');
  await expect(lineHeightSlider).toHaveAttribute('max', '200');

  const letterSpacingSlider = page.locator('#accessibility-letter-spacing');
  await expect(letterSpacingSlider).toHaveAttribute('min', '0');
  await expect(letterSpacingSlider).toHaveAttribute('max', '6');
});

test('Preset modes can be toggled', async ({ page }) => {
  await page.locator('[data-section-id="5"]').first().click();
  await expect(page.getByText('Standard Accessibility Options')).toBeVisible({ timeout: 5000 });
  const presetBtn = page.getByRole('button').filter({ hasText: 'Preset modes' }).first();
  await presetBtn.scrollIntoViewIfNeeded();
  await presetBtn.click();
  await expect(page.getByText(/Minimize distractions/i)).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(300);
  const dialog = page.getByRole('dialog').first();
  if (await dialog.isVisible()) {
    const dismiss = dialog.getByRole('button', { name: /acknowledge|no thanks|later|^ok$/i }).first();
    await dismiss.click({ timeout: 5000 });
  }

  // Focus mode switches to list view; turn on then turn off via list.
  // Applying a preset calls onPresetApplied and closes the section, so we assert via the app class.
  const focusBtn = page.getByRole('button', { name: /Focus Mode/i }).first();
  await focusBtn.scrollIntoViewIfNeeded();
  await focusBtn.click();
  await expect(page.getByRole('application')).toHaveClass(/accessibility-focus-mode/, { timeout: 5000 });
  await page.getByRole('button', { name: /Accessibility/i }).first().click();
  await expect(page.getByRole('button', { name: /Standard Accessibility Options/i }).first()).toBeVisible({ timeout: 5000 });
  // Preset modes collapsible stays open in app state when section closed, so content is already visible after reopen.
  await expect(page.getByText(/Minimize distractions/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Focus Mode/i }).first().click();
  await expect(page.getByRole('application')).not.toHaveClass(/accessibility-focus-mode/, { timeout: 5000 });
});

test('Sliders and presets description mentions refinement', async ({ page }) => {
  await page.locator('[data-section-id="5"]').first().click();
  await expect(page.getByText('Standard Accessibility Options')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button').filter({ hasText: 'Preset modes' }).first().click();
  await expect(page.getByText(/Text size, line height, and letter spacing sliders above still apply/i)).toBeVisible({ timeout: 5000 });
});
