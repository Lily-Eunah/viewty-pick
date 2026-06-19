# fix/ci-node-22 — worklog

The daily cron workflow (`.github/workflows/crawl.yml`)'s `sheets:import` step was failing with:
`Error: Node.js 20 detected without native WebSocket support`
This error occurs because `@supabase/supabase-js` (via `realtime-js`) expects native WebSocket support (available in Node 22+). While the crawler does not use realtime features, `createClient` automatically initializes the RealtimeClient.

## Changes
- `.github/workflows/crawl.yml`
  - Bumped Node.js version from `20` to `22` in the `Set up Node.js` step.
  - Removed the `Install Playwright Browsers` step (`npx playwright install --with-deps chromium`), as crawlers are now fully API-driven (crawling page via browser is disabled). This speeds up execution and avoids unnecessary browser setup.
- `.github/workflows/ci.yml`
  - Already configured to use Node.js `22` (no change needed).

## Tests / Verification
- Local build, lint, and typecheck commands run on Node 22 successfully.
- Will verify via CI pipeline and manual workflow run of "Daily Price Sync & Crawl" after merging.
