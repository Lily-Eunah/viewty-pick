/**
 * Naver page-crawl LIVE verification (READ-ONLY — no DB writes, no .env needed).
 *
 * Runs the production parser (`parseNaverPagePrices` / `detectSoldOut`) against real,
 * freshly-loaded Naver product pages and prints what it recovered. This is the 5-second
 * answer to "did Naver change something, or is our crawl broken?" — a question that
 * previously took a bespoke investigation.
 *
 * It deliberately uses the SAME browser mode as the crawler (headful, see
 * naverPageCrawl.ts), so a PASS here means the daily crawl should also succeed. A
 * headless run gets 429; that is Naver's throttle, not a parser fault.
 *
 * Run: npm run live-check:naver-page  [-- <url> ...]
 * Prereqs: npx playwright install chromium; a real display (headful).
 */
import { parseNaverPagePrices, detectSoldOut, isNaverStorefrontUrl } from '../../crawler/core/naverPageCrawl';

// Curated defaults (operator-provided brand-store SKUs). Override via argv.
const DEFAULT_TARGETS: [string, string][] = [
  ['이니스프리', 'https://brand.naver.com/innisfree/products/13155811785'],
  ['에뛰드 순정', 'https://brand.naver.com/etude/products/10516809109'],
];

const NAV_ATTEMPTS = 3;

async function main() {
  const argv = process.argv.slice(2).filter((a) => isNaverStorefrontUrl(a));
  const targets: [string, string][] = argv.length
    ? argv.map((u, i) => [`argv[${i}]`, u] as [string, string])
    : DEFAULT_TARGETS;

  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('playwright not installed. Run: npx playwright install chromium');
    process.exit(1);
  }

  // Headful, matching crawlNaverPagePrice. NO UA spoofing, NO anti-detection flags.
  const browser = await chromium.launch({ headless: false });
  let anyFail = false;
  try {
    const ctx = await browser.newContext();
    for (const [label, url] of targets) {
      let html: string | null = null;
      let status: number | null = null;
      for (let attempt = 1; attempt <= NAV_ATTEMPTS && html === null; attempt++) {
        const page = await ctx.newPage();
        try {
          const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
          await page.waitForTimeout(3000);
          status = resp ? resp.status() : null;
          if (status === 200) html = await page.content();
          else console.log(`  [${label}] attempt ${attempt}: status=${status}`);
        } catch (e) {
          console.log(`  [${label}] attempt ${attempt}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
        } finally {
          await page.close().catch(() => {});
        }
        if (html === null) await new Promise((r) => setTimeout(r, 2000));
      }

      console.log(`\n=== ${label} === status=${status}`);
      if (!html) {
        console.log('  LOAD FAILED — Naver served no 200. Headless mode, or an IP-level throttle.');
        anyFail = true;
        continue;
      }
      const parsed = parseNaverPagePrices(html);
      console.log(`  parseNaverPagePrices → ${JSON.stringify(parsed)}`);
      console.log(`  detectSoldOut        → ${detectSoldOut(html)}`);
      const ok = parsed.found && parsed.salePrice !== null && !parsed.soldOut;
      if (!ok) anyFail = true;
      console.log(
        `  VERDICT: ${
          ok
            ? 'OK — a usable price was recovered; the daily crawl should price this listing.'
            : parsed.found
              ? 'PRICE FOUND BUT WITHHELD — soldOut is set; check that the MAIN node is the one saying so.'
              : 'PARSE MISS — page loaded but no price keys matched; the embedded state may have changed.'
        }`
      );
      await new Promise((r) => setTimeout(r, 1500));
    }
  } finally {
    await browser.close().catch(() => {});
  }
  if (anyFail) process.exitCode = 1;
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
