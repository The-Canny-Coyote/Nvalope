import { test, expect } from '@playwright/test';
import { waitForApp, dismissDialogs, prepareE2EStorageBeforeLoad, mergeE2EAppPersist } from './helpers';
import { getSeedBudgetState } from '../src/app/fixtures/seedBudget';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await prepareE2EStorageBeforeLoad(page);
  await page.goto('/');
  await waitForApp(page);
  await dismissDialogs(page);
});

test('AI Assistant opens and replies to a message', async ({ page }) => {
  const wheelBtn = page.getByRole('button', { name: 'Wheel layout' });
  if (await wheelBtn.isVisible()) {
    await wheelBtn.click();
    await page.waitForTimeout(200);
  }

  const wheelLayout = page.locator('[data-layout="wheel"]').first();
  await wheelLayout.waitFor({ state: 'visible', timeout: 10000 });

  // Open Settings and enable Cache the AI Assistant so the center button appears (avoids relying on persist for optional module)
  await page.getByRole('button', { name: 'Settings' }).click({ timeout: 5000 });
  await expect(page.getByRole('heading', { name: /Settings & Features|^Settings$/i }).first()).toBeVisible({ timeout: 5000 });
  await dismissDialogs(page);
  await page.getByRole('button', { name: 'Optional features', exact: true }).click();
  await page.waitForTimeout(300);
  const cacheToggle = page.getByTestId('module-cacheAssistant').getByRole('checkbox', { name: /Cache the AI Assistant/i });
  if ((await cacheToggle.getAttribute('aria-checked')) === 'false') {
    await cacheToggle.click();
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: /Close section/i }).first().click();
  await page.waitForTimeout(300);

  await wheelLayout.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const openAssistantBtn = page.getByTestId('open-ai-assistant').or(page.getByRole('button', { name: /Open Cache the AI Assistant/i }));
  await openAssistantBtn.first().waitFor({ state: 'attached', timeout: 8000 });
  await openAssistantBtn.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await openAssistantBtn.first().click({ force: true });

  const messageInput = page.getByRole('textbox', { name: /Message/i });
  await expect(messageInput).toBeVisible({ timeout: 5000 });
  await messageInput.fill('How much have I spent?');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByText(/\$|spent|budget|income|envelope/i).first()).toBeVisible({ timeout: 10000 });
});

test('AI Assistant shows reply with seeded budget data', async ({ page }) => {
  const seedState = getSeedBudgetState();
  await page.evaluate(
    async (state) => {
      const DB_NAME = 'nvalope-db';
      const DB_VERSION = 2;
      const STORE_BUDGET = 'budget';
      const BUDGET_KEY = 'state';
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains(STORE_BUDGET)) d.createObjectStore(STORE_BUDGET);
        };
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_BUDGET, 'readwrite');
        tx.objectStore(STORE_BUDGET).put(state, BUDGET_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    seedState
  );
  await mergeE2EAppPersist(page, { useCardLayout: false });
  await page.reload();
  await waitForApp(page);
  await dismissDialogs(page);

  const wheelBtn = page.getByRole('button', { name: 'Wheel layout' });
  if (await wheelBtn.isVisible()) {
    await wheelBtn.click();
    await page.waitForTimeout(200);
  }

  const wheelLayout = page.locator('[data-layout="wheel"]').first();
  await wheelLayout.waitFor({ state: 'visible', timeout: 10000 });

  await page.getByRole('button', { name: 'Settings' }).click({ timeout: 5000 });
  await expect(page.getByRole('heading', { name: /Settings & Features|^Settings$/i }).first()).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Optional features', exact: true }).click();
  await page.waitForTimeout(300);
  const cacheToggle = page.getByTestId('module-cacheAssistant').getByRole('checkbox', { name: /Cache the AI Assistant/i });
  if ((await cacheToggle.getAttribute('aria-checked')) === 'false') {
    await cacheToggle.click();
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: /Close section/i }).first().click();
  await page.waitForTimeout(300);

  await wheelLayout.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const openAssistantBtn = page.getByTestId('open-ai-assistant').or(page.getByRole('button', { name: /Open Cache the AI Assistant/i }));
  await openAssistantBtn.first().waitFor({ state: 'attached', timeout: 8000 });
  await openAssistantBtn.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await openAssistantBtn.first().click({ force: true });

  const messageInput = page.getByRole('textbox', { name: /Message/i });
  await expect(messageInput).toBeVisible({ timeout: 5000 });
  await messageInput.fill('What envelopes do I have?');
  await page.getByRole('button', { name: 'Send' }).click();

  const replyArea = page.getByRole('log', { name: 'Chat messages' });
  await expect(replyArea.getByText(/Groceries|Dining|Transport/i).first()).toBeVisible({ timeout: 10000 });
});
