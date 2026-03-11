# Nvalope API Worker

Cloudflare Worker for Nvalope: auth (session cookie + Bearer JWT), **GET /api/entitlements**, CORS.

## Setup (you already created the Worker and D1)

1. **D1 database id**  
   In `wrangler.jsonc`, replace `REPLACE_WITH_YOUR_DATABASE_ID` in `d1_databases[0].database_id` with your actual D1 database id (from `npx wrangler d1 list` or the create output).

2. **JWT secret**  
   Set a secret for signing session JWTs:
   ```bash
   npx wrangler secret put JWT_SECRET
   ```
   For **local dev**, create a `.dev.vars` file in this directory (not committed):
   ```
   JWT_SECRET=your-dev-secret-at-least-32-chars
   ```

3. **Run migrations** (if not already done)  
   Use your D1 schema/migrations and run them against the database, for example:
   ```bash
   npx wrangler d1 execute nvalope-db --remote --file=path/to/your/migrations.sql
   ```

## Commands

- `npm run dev` — local Worker at http://localhost:8787
- `npm run deploy` — deploy to Cloudflare
- `npm run cf-typegen` — regenerate `worker-configuration.d.ts` from wrangler (includes DB binding types)

## Behaviour

- **GET /api/entitlements**  
  If the request has no valid auth (cookie or `Authorization: Bearer <token>`), the Worker creates a new user in D1 and sets an HTTP-only session cookie, then returns entitlements (all `false` until you add rows to `one_time_entitlements`).  
  The app calls this with `credentials: 'include'`, so the cookie is sent on subsequent requests.

- **CORS**  
  Allowed origins: `https://nvalope.app`, `http://localhost:5173`, `http://localhost:5174`, and 127.0.0.1 variants. Credentials are allowed.

- **Auth**  
  Session is a JWT in cookie `nvalope_session` or in `Authorization: Bearer <token>`. Same JWT is used for both.

## App configuration

In the Nvalope app, set **VITE_API_BASE** to your Worker URL (e.g. `https://nvalope-api.<your-subdomain>.workers.dev` for production, or `http://localhost:8787` when running the Worker locally).
