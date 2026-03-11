# E2E tests

Playwright tests for Nvalope.

- **Run all e2e:** `npm run test:e2e`
- The config starts the **built** app (`npm run build && npx vite preview --port 5174`) so the app is ready as soon as the URL responds. Base URL is `http://localhost:5174`.
- If you see "port 5174 is already in use", stop any process on that port (e.g. a previous `vite preview` or e2e run) and try again. With `reuseExistingServer: true` (when `CI` is not set), Playwright will reuse an existing server on 5174 if one is already running.
- Each spec’s `beforeEach` goes to `/`, sets localStorage, reloads, waits for the app (`waitForApp`), then dismisses any blocking dialog (`dismissDialogs`) so tests run against a clean UI.
