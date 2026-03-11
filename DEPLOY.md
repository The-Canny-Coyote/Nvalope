# Deploying Nvalope to Cloudflare Pages

**Production site:** https://nvalope.app  
**Project:** nvalope (subdomain: nvalope.pages.dev)

## Why the site might “not update” or “keep switching”

If **Cloudflare Pages is connected to GitHub**, every push can trigger an automatic build. That build can become the new **production** deployment and overwrite the one from `npm run deploy:pages`.

- Your repo’s default branch is **master**.
- In the Cloudflare project, **Production branch** is set in **Settings → Builds & deployments** (often to **main**).
- If Production branch is **main**, only builds from the **main** branch are used for production. Pushing to **master** only updates **preview** (e.g. master.nvalope.pages.dev), not nvalope.app.
- If Production branch is **master**, then each push to master runs a new build and can replace the deployment you made with `npm run deploy:pages`, so the site can “switch” to whatever that Git build produced.

## Option A: Use manual deploys only for production (recommended if you want `npm run deploy:pages` to control nvalope.app)

1. In **Cloudflare Dashboard** → **Pages** → **nvalope** → **Settings** → **Builds & deployments**.
2. Under **Branch deployments** or **Build configuration**, **disable** “Auto-deploy” or “Deploy from Git” for the **production** environment, or set it so production is updated only by **Direct Upload** (manual/wrangler).
3. Then only `npm run deploy:pages` will update https://nvalope.app.

(Exact labels depend on the current Cloudflare UI; the goal is: production is not updated automatically by Git.)

## Option B: Use Git to drive production (so a push updates nvalope.app)

1. In **Cloudflare** → **Pages** → **nvalope** → **Settings** → **Builds & deployments**, set **Production branch** to **master** (to match your repo).
2. Ensure **Build command** and **Build output directory** are correct (e.g. `npm run build` and `dist`).
3. Then every push to **master** will trigger a build and update production. You can stop using `npm run deploy:pages` for normal updates.

If the repo uses **main** instead of **master**, either push to **main** or set Production branch to **main** in Cloudflare.

## Manual deploy (updates production when Option A is configured)

From the project root:

```bash
npm run deploy:pages
```

This runs `npm run build` then `wrangler pages deploy dist --project-name=nvalope --branch=production`, which deploys the local `dist/` to the **production** branch so https://nvalope.app is updated.
