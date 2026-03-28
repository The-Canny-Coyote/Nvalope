import type { Page } from '@playwright/test';

/**
 * Set localStorage before the app bundle runs (via addInitScript) so Zustand persist
 * does not overwrite tests with default `useCardLayout: true` on first paint.
 */
export async function prepareE2EStorageBeforeLoad(page: Page, persistPartial: Record<string, unknown> = {}): Promise<void> {
  const serialized = JSON.stringify(persistPartial);
  await page.addInitScript((s) => {
    const partial = JSON.parse(s as string) as Record<string, unknown>;
    try {
      localStorage.setItem('nvalope-backup-prompt-seen', 'true');
    } catch {
      // ignore
    }
    const key = 'nvalope-app-persist';
    let state: Record<string, unknown> = {};
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: Record<string, unknown> } | Record<string, unknown>;
        state =
          'state' in parsed && parsed.state && typeof parsed.state === 'object'
            ? { ...parsed.state }
            : { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      // ignore
    }
    const next = { ...state, ...partial, useCardLayout: false };
    localStorage.setItem(key, JSON.stringify({ state: next, version: 0 }));
  }, serialized);
}

/**
 * Merge keys into Zustand persist after navigation (e.g. mid-test). Prefer prepareE2EStorageBeforeLoad for first load.
 */
export async function mergeE2EAppPersist(page: Page, partial: Record<string, unknown>): Promise<void> {
  const serialized = JSON.stringify(partial);
  await page.evaluate((s) => {
    const key = 'nvalope-app-persist';
    const partial = JSON.parse(s) as Record<string, unknown>;
    try {
      const raw = localStorage.getItem(key);
      let state: Record<string, unknown> = {};
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: Record<string, unknown> } | Record<string, unknown>;
        state =
          'state' in parsed && parsed.state && typeof parsed.state === 'object'
            ? { ...parsed.state }
            : { ...(parsed as Record<string, unknown>) };
      }
      const next = { ...state, ...partial };
      localStorage.setItem(key, JSON.stringify({ state: next, version: 0 }));
    } catch {
      localStorage.setItem(key, JSON.stringify({ state: { ...partial }, version: 0 }));
    }
  }, serialized);
}

/** Navigate to app with backup prompt dismissed, then wait for app and dismiss any dialogs. */
export async function gotoAppWithOnboardingDone(page: Page, persistPartial: Record<string, unknown> = {}): Promise<void> {
  await prepareE2EStorageBeforeLoad(page, persistPartial);
  await page.goto('/');
  await waitForApp(page);
  // PWA "offline ready" may mount shortly after first paint
  await page.waitForTimeout(600);
  await dismissDialogs(page);
}

/** Wait for the app root (data-testid="app") to be in the DOM. Use after goto/reload in e2e. */
export async function waitForApp(page: Page, timeout = 25_000): Promise<void> {
  await page.getByTestId('app').waitFor({ state: 'attached', timeout });
}

/** Dismiss any blocking dialog (PWA offline ready, backup folder, Premium AI, etc.). Call after waitForApp when needed. */
export async function dismissDialogs(page: Page): Promise<void> {
  const overlay = page.locator('[data-slot="alert-dialog-overlay"]');
  for (let round = 0; round < 10; round++) {
    if (round > 0) await page.waitForTimeout(400);
    const visible = await overlay.isVisible().catch(() => false);
    if (!visible) continue;
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
