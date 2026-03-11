import type { Page } from '@playwright/test';

/** Wait for the app root (data-testid="app") to be in the DOM. Use after goto/reload in e2e. */
export async function waitForApp(page: Page, timeout = 25_000): Promise<void> {
  await page.getByTestId('app').waitFor({ state: 'attached', timeout });
}

/** Dismiss any blocking dialog (PWA offline ready, backup folder, Premium AI, etc.). Call after waitForApp when needed. */
export async function dismissDialogs(page: Page): Promise<void> {
  const overlay = page.locator('[data-slot="alert-dialog-overlay"]');
  await overlay.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  const maxAttempts = 5;
  for (let i = 0; i < maxAttempts; i++) {
    const visible = await overlay.isVisible().catch(() => false);
    if (!visible) return;
    const dialog = page.getByRole('alertdialog').first();
    const okBtn = dialog.getByRole('button', { name: /^(ok|acknowledge|no thanks|later|close|i understand|close and update later)$/i }).first();
    const closeBtn = dialog.getByRole('button', { name: /close and update later/i }).first();
    try {
      await okBtn.click({ timeout: 2000 });
    } catch {
      try {
        await closeBtn.click({ timeout: 2000 });
      } catch {
        await dialog.getByRole('button').first().click({ timeout: 2000 }).catch(() => {});
      }
    }
    await overlay.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
}
