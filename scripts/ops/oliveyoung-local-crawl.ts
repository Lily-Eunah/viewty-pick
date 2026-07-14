/**
 * LOCAL scheduled OliveYoung page crawl (HEADFUL).
 *
 * Runs on the operator's OWN machine — a real display + a residential IP. NOT GitHub
 * Actions: the Cloudflare managed challenge blocks a headful browser from GitHub's
 * datacenter IP ~2/3 of the time (probe: 1/3 pass vs 3/3 residential), so the daily
 * crawl hands OliveYoung off to this local run (crawl.yml uses --skip-seller=oliveyoung).
 * See docs/ops/oliveyoung-local-crawl.md + docs/worklog/feature-oliveyoung-page-crawl.md.
 *
 * It writes ONLY the OliveYoung listings' price snapshots to production Supabase
 * (--only-seller=oliveyoung); current_prices / viewty_score / product images stay owned
 * by the daily GitHub crawl. The site reads the listing_prices_public view, so the fresh
 * OliveYoung snapshots surface immediately.
 *
 * ⚠️ WRITES PRODUCTION Supabase. This process forces CRAWLER_ALLOW_PROD_WRITE=true (the
 * intentional-prod-write guard) for ITSELF ONLY — never put that in .env, or every local
 * crawler run would write prod. OLIVEYOUNG_PAGE_CRAWL=on switches the OliveYoung adapter
 * from the Naver-sourced fallback to the headful page crawl.
 *
 * Run: npm run oliveyoung:crawl:local   (schedule daily via Windows Task Scheduler)
 */
process.env.OLIVEYOUNG_PAGE_CRAWL = 'on';
process.env.CRAWLER_ALLOW_PROD_WRITE = 'true';

// Scope to OliveYoung + skip the sheet import (the daily GitHub crawl already imports;
// this run only reads the already-imported OliveYoung listings and prices them).
for (const arg of ['--only-seller=oliveyoung', '--skip-import']) {
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
    console.error('[OliveYoung local crawl] crash:', e);
    process.exit(1);
  }
})();

export {}; // module scope (isolate from other script files' globals)
