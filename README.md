# Nvalope

A **free, privacy-focused, offline-capable envelope budgeting PWA.** No ads or tracking. All data stays on your device. Works offline after first load.

**Live app:** [nvalope.app](https://nvalope.app) · **Website:** [https://nvalope.app](https://nvalope.app)

*Suggested GitHub topics:* `pwa` `budgeting` `privacy` `react` `typescript` `vite`

## Features

- **Core budgeting** — Overview, Income, Envelopes, Transactions
- **Accessibility** — Text size, spacing, reduced motion, high contrast, screen reader support, preset modes (focus, calm, readability, low vision)
- **Additional features** — Receipt scanner, calendar, analytics, AI assistant (when enabled)
- **Backup** — Export/import; optional autobackup to a folder you choose (File System Access API)
- **Manual bank statement import** — Import CSV, OFX/QFX, and QIF files with preview + duplicate-safe append
- **PWA** — Installable; offline after first load; “Check for updates” in Settings

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test:run` | Unit tests |
| `npm run test:e2e` | Playwright E2E (run `npx playwright install` once) |
| `npm run test:predeploy` | Unit tests + E2E (run before deploy) |
| `npm run test:coverage` | Unit tests with coverage |
| `npm run lint` | Lint source |
| `npm run audit` | Dependency vulnerability check |
| `npm run deploy:pages` | Build and deploy to Cloudflare Pages (add `-- --branch=main` for production) |

## Pre-deploy checklist

Before deploying, run the full test suite to confirm nothing is broken:

```bash
npm run test:predeploy
```

Optionally run `npm run test:coverage` to check coverage. Tests are additive and do not remove or revert features; they only fail if something breaks.

## License

Nvalope is source-available under the [MIT + Commons Clause license](./LICENSE).

The core budgeting engine, UI, PWA infrastructure, and Cloudflare Worker are free
for personal and self-hosted non-commercial use under the MIT terms.

Files in `src/app/premium/`, `src/app/hooks/usePremiumEntitlements.ts`, and
`src/app/services/advancedAssistant.ts` are additionally subject to the Commons
Clause restriction and may not be used as the basis of a commercial product
without a separate license.

To inquire about commercial licensing, contact: support@nvalope.com

## Support

Nvalope is free to use. Voluntary support: [Buy Me a Coffee — TheCannyCoyote](https://www.buymeacoffee.com/thecannycoyote). Donations do not create a contract for features or support.

## Privacy and terms

Privacy Policy and Terms of Use apply worldwide. In the app: **Settings → Legal & support**, or [privacy](https://nvalope.app/privacy.html) and [terms](https://nvalope.app/terms.html).

## Trademark

**Nvalope**, **THE CANNY COYOTE LLC**, **Cache**, and related names and logos are reserved to THE CANNY COYOTE LLC and contributors. The code is MIT-licensed; the license does not grant use of these names, marks, or branding for derivative works or your own products without permission. See in-app Terms of Use for the full trademark section.
