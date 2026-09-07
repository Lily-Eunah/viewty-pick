/**
 * LOCAL scheduled Naver page crawl (HEADFUL).
 *
 * Runs on the operator's OWN machine — a real display. NOT GitHub Actions.
 *
 * WHY: the Naver Shopping Search API was terminated 2026-07-31 with no replacement, so
 * the curated product page IS the price source now. Naver throttles by client, not by
 * IP — measured 2026-09 on one machine and IP: plain fetch 429, headless Chromium 429,
 * HEADFUL Chromium 200 with a complete __PRELOADED_STATE__. Headful needs a real
 * display, hence this out-of-band run; the daily GitHub crawl skips Naver
 * (crawl.yml uses --skip-seller=naver) and keeps everything else.
 *
 * It writes ONLY the Naver listings' price snapshots to production Supabase
 * (--only-seller=naver); current_prices / viewty_score / product images stay owned by
 * the daily GitHub crawl. The site reads the listing_prices_public view, so fresh Naver
 * snapshots surface immediately.
 *
 * ⚠️ WRITES PRODUCTION Supabase. This process forces CRAWLER_ALLOW_PROD_WRITE=true (the
 * intentional-prod-write guard) for ITSELF ONLY — never put that in .env, or every local
 * crawler run would write prod.
 *
 * Prereqs: `npx playwright install chromium`; .env with the Supabase/Discord/revalidate
 * secrets the crawler already uses. Verify first with `npm run live-check:naver-page`
 * (read-only) — if that prints OK verdicts, this run should price the listings.
 *
 * Run: npm run naver:crawl:local   (schedule daily via Windows Task Scheduler, and note
 * that headful REQUIRES "Run only when user is logged on" — session 0 has no display).
 */
process.env.NAVER_PAGE_CRAWL = 'on';
process.env.CRAWLER_ALLOW_PROD_WRITE = 'true';

// Scope to Naver + skip the sheet import (the daily GitHub crawl already imports; this
// run only reads the already-imported Naver listings and prices them).
for (const arg of ['--only-seller=naver', '--skip-import']) {
  if (!process.argv.includes(arg)) process.argv.push(arg);
}

// Import AFTER the env is set (async IIFE — this project transpiles to CJS, so no
// top-level await) so the pipeline reads the intended flags.
void (async () => {
  const { crawlPipeline } = await import('../../crawler/run');
  try {
    await crawlPipeline();
    process.exit(0);
  } catch (e) {
    console.error('[Naver local crawl] crash:', e);
    process.exit(1);
  }
})();

export {}; // module scope (isolate from other script files' globals)
