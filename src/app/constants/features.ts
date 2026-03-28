/**
 * Bank statement import (Settings → Data Management). On by default.
 * Set `VITE_E2E_BANK_IMPORT=false` in the Playwright webServer env to hide it for targeted E2E.
 */
export const SHOW_BANK_STATEMENT_IMPORT = import.meta.env.VITE_E2E_BANK_IMPORT !== 'false';
