/**
 * Naver official-store product-page price crawl — 정가(정상가) + 할인가(판매가).
 *
 * WHY a page crawl when the Shopping Search API already gives a price: the API's
 * `lprice` is only the lowest CURRENT (할인) price and NEVER exposes the 정가
 * (정상가, 할인 전). To power "공식몰 대비 픽" against the official REGULAR price — and
 * to recover anchor-miss products whose curated brand.naver.com SKU is absent from
 * the Shopping API result window — we load the curated product page itself and read
 * BOTH prices from its embedded state (`__PRELOADED_STATE__`).
 *
 * ⚠️ robots.txt: brand.naver.com / smartstore.naver.com both serve
 * `User-agent: * Disallow: /`. This crawl runs under an EXPLICIT operator decision
 * that accepts the ToS/robots risk for our own curated links. It is kept
 * low-impact and honest:
 *   - serial + rate-limited (one page at a time, ≥ NAVER_CRAWL_INTERVAL_MS apart),
 *   - HEADFUL (see HEADFUL below) with NO user-agent spoofing and NO anti-detection
 *     flags — a real browser reporting its own real UA,
 *   - volume ≤ the number of curated Naver links/day (currently ~수십 개),
 *   - FAIL-SAFE: any block / timeout / parse miss falls back to link-only. We never
 *     fabricate a price.
 *
 * ⚠️ This crawl became the PRIMARY Naver price path when the Shopping Search API was
 * terminated on 2026-07-31 with no official replacement. Until then it was an
 * anchor-miss fallback.
 *
 * Naver price-field mapping (documented so the regular/sale assignment is auditable):
 *   - `salePrice`            → the seller's listed price = our 정가 (regularPrice)
 *   - `discountedSalePrice`  → after 즉시할인 (top-level OR under `benefitsView`)
 *                              = our 할인가 (salePrice). Absent ⇒ no discount ⇒
 *                              sale = 정가.
 */

export interface NaverPageParseResult {
  regularPrice: number | null; // 정가 (Naver `salePrice`)
  salePrice: number | null;    // 할인가 (Naver `discountedSalePrice`, else 정가)
  soldOut: boolean;            // explicit out-of-stock / sale-suspended signal
  title: string | null;        // product name (og:title) — for volume/단품 normalize
  found: boolean;              // a usable price was located on the page
}

/** Parse a positive integer KRW amount; null for 0 / NaN / negative. */
function positiveInt(s: string | undefined): number | null {
  if (s === undefined) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * First numeric value of an embedded-state key (`"key": 12345`). Non-global match
 * → the FIRST occurrence, which for the main product node appears before any
 * recommendation/related-product nodes in `__PRELOADED_STATE__`. Case-sensitive so
 * `discountedSalePrice` does NOT also catch `mobileDiscountedSalePrice`.
 */
function firstStateNumber(html: string, key: string): number | null {
  const m = html.match(new RegExp(`"${key}"\\s*:\\s*(\\d{2,9})`));
  return m ? positiveInt(m[1]) : null;
}

/** og: meta content (e.g. og:title) — DOM-level fallback when state is absent. */
function ogMeta(html: string, property: string): string | null {
  const m = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i')
  );
  return m ? m[1] : null;
}

// The main product node's neighbourhood inside `__PRELOADED_STATE__`, measured
// from the same anchor the price comes from. Observed live (2026-09): the node
// reads `…"productNo":N,"salePrice":20000,"saleType":"NEW","productStatusType":
// "SALE"…` and its `benefitsView.discountedSalePrice` sits ~600 chars further on,
// while unrelated `"stockQuantity":0` rows sat ~7KB away. A tight window keeps the
// product's OWN status and excludes its neighbours'.
const MAIN_NODE_BACK = 500;
const MAIN_NODE_FWD = 2500;

/**
 * Slice of HTML around the MAIN product node, or null when it cannot be located.
 *
 * Anchored on the first `"salePrice"` carrying a real (2+ digit) amount — exactly
 * what `firstStateNumber` picks — so the sold-out check and the price always
 * describe the SAME node. Naver embeds a decoy `"salePrice":0` earlier in the
 * document; the `\d{2,9}` bound skips it in both places.
 */
function mainProductWindow(html: string): string | null {
  const m = html.match(/"salePrice"\s*:\s*\d{2,9}/);
  if (!m || m.index === undefined) return null;
  return html.slice(Math.max(0, m.index - MAIN_NODE_BACK), m.index + MAIN_NODE_FWD);
}

/**
 * Explicit out-of-stock / sale-suspended signals (conservative — no guessing).
 *
 * ⚠️ Scoped to the MAIN product node, NOT the whole document. The unscoped version
 * tested all of `html`, so ONE `"stockQuantity":0` belonging to an option row or a
 * related-product card marked the entire page sold out — and `naver.ts`'s
 * `!crawled.soldOut` gate then threw away a perfectly good price. Verified live
 * (2026-09) on 에뛰드 순정 / 이니스프리: the main node said `productStatusType:"SALE"`
 * while a stray `"stockQuantity":0` sat ~7KB away, and BOTH products were reported
 * sold out. That silent false positive is a large part of why the page-crawl
 * fallback "recovered 0 prices".
 *
 * No main node ⇒ false: the parser cannot produce a price for such a page either,
 * so the caller goes link-only regardless and a sold-out verdict is meaningless.
 */
export function detectSoldOut(html: string): boolean {
  const win = mainProductWindow(html);
  if (win === null) return false;
  if (/"saleStatus"\s*:\s*"(SUSPENSION|OUTOFSTOCK|PROHIBITION|DELETE|END|WAIT)"/i.test(win)) return true;
  if (/"productStatusType"\s*:\s*"(SUSPENSION|OUTOFSTOCK|PROHIBITION|DELETE|END)"/i.test(win)) return true;
  if (/"outOfStock"\s*:\s*true/i.test(win)) return true;
  if (/"stockQuantity"\s*:\s*0\b/.test(win)) return true;
  return false;
}

/**
 * Pure parser — extract 정가/할인가 from a Naver product page's HTML. Testable
 * without any network/Playwright. Order of trust:
 *   1) `__PRELOADED_STATE__` numeric fields (salePrice / discountedSalePrice),
 *   2) Open-Graph `product:price:amount` (gives 할인가 only — regular falls back),
 * Returns found=false when neither yields a price; soldOut is surfaced so the
 * caller can keep the listing link-only instead of pricing a sold-out page.
 */
export function parseNaverPagePrices(html: string): NaverPageParseResult {
  const title = ogMeta(html, 'og:title');
  const soldOut = detectSoldOut(html);

  // 1) Embedded state. `salePrice` = 정가, `discountedSalePrice` = 할인가.
  let regular = firstStateNumber(html, 'salePrice');
  let sale = firstStateNumber(html, 'discountedSalePrice');

  // 2) DOM fallback — Open-Graph product price (할인가 only). Used only if state
  //    gave us nothing.
  if (regular === null && sale === null) {
    const og = positiveInt(ogMeta(html, 'product:price:amount') ?? undefined);
    if (og !== null) sale = og;
  }

  // Resolve regular vs sale into our two-price model.
  //   - 정가만 있으면 sale = 정가 (no discount).
  //   - 할인가만 있으면 regular = null (we only know the discounted price).
  //   - 할인가 ≥ 정가 (or equal) → no real discount: drop the regular so we never
  //     surface a fake "정가 대비" gap.
  if (regular !== null && sale === null) sale = regular;
  if (regular !== null && sale !== null && sale >= regular) regular = null;

  return {
    regularPrice: regular,
    salePrice: sale,
    soldOut,
    title,
    found: sale !== null,
  };
}

// ---------------------------------------------------------------------------
// Playwright runner (network). Skipped in mock mode by the caller.
// ---------------------------------------------------------------------------

/** Naver storefront URLs we will crawl (curated links only — never the catalog). */
export function isNaverStorefrontUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /(?:^|\/\/|\.)(?:brand\.naver\.com|(?:m\.)?smartstore\.naver\.com|naver\.me)\b/i.test(url);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Serial pacing across the whole run (run.ts processes listings sequentially, but
// guard anyway so two crawls never fire back-to-back). Default 1.5s between pages.
let lastCrawlAt = 0;
const MIN_CRAWL_INTERVAL_MS = parseInt(process.env.NAVER_CRAWL_INTERVAL_MS ?? '1500', 10);
const CRAWL_TIMEOUT_MS = parseInt(process.env.NAVER_CRAWL_TIMEOUT_MS ?? '20000', 10);

// HEADFUL by default. Naver serves its "[에러] 에러페이지 - 시스템오류" throttle page
// (HTTP 429) to headless clients — measured 2026-09 on the same machine and IP where
// a real browser gets 200: plain fetch 429, headless Chromium 429, HEADFUL Chromium
// 200 with a complete __PRELOADED_STATE__. This is the same lesson oliveyoungPageCrawl
// already encodes. Still NO UA spoofing and NO anti-detection flags — headful Chromium
// IS a real browser, so its own UA is honest. Set NAVER_CRAWL_HEADFUL=off to force
// headless (diagnostics only; it will 429).
// ⚠️ Headful needs a real display: this crawl belongs on the operator's desktop
// (Windows Task Scheduler), NOT on a GitHub Actions runner.
const HEADFUL = (process.env.NAVER_CRAWL_HEADFUL ?? 'on') !== 'off';

// The first navigation of a run was observed to fail with ERR_CONNECTION_RESET and
// then succeed on retry, so one transient retry is worth it before going link-only.
const NAV_ATTEMPTS = 2;

/**
 * Load a curated Naver product page and read 정가/할인가. Returns null on ANY
 * failure (playwright unavailable, navigation/timeout/block, non-Naver landing,
 * or no price) so the caller falls back to link-only — never a guessed price.
 */
export async function crawlNaverPagePrice(url: string): Promise<NaverPageParseResult | null> {
  // Rate limit: keep ≥ MIN_CRAWL_INTERVAL_MS between successive page loads.
  const elapsed = Date.now() - lastCrawlAt;
  if (lastCrawlAt !== 0 && elapsed < MIN_CRAWL_INTERVAL_MS) {
    await sleep(MIN_CRAWL_INTERVAL_MS - elapsed);
  }
  lastCrawlAt = Date.now();

  // Lazy/optional import: the web build and mock runs never load Playwright.
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.warn('[Naver Crawl] playwright not installed — skipping page crawl (link-only)');
    return null;
  }

  let browser: import('playwright').Browser | null = null;
  try {
    browser = await chromium.launch({ headless: !HEADFUL });
    // Honest real-browser UA — NO spoofing (operator 안전/매너 rule).
    const context = await browser.newContext();

    for (let attempt = 1; attempt <= NAV_ATTEMPTS; attempt++) {
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CRAWL_TIMEOUT_MS });

        // The redirect (naver.me) must land on a Naver storefront; bail otherwise.
        const finalUrl = page.url();
        if (!isNaverStorefrontUrl(finalUrl)) {
          console.warn(`[Naver Crawl] resolved to a non-Naver host (${finalUrl}) — link-only`);
          return null;
        }

        const html = await page.content();
        const parsed = parseNaverPagePrices(html);
        if (!parsed.found) {
          console.warn(`[Naver Crawl] no price found on ${finalUrl} — link-only`);
        }
        return parsed;
      } catch (e) {
        // Transient navigation failure (ERR_CONNECTION_RESET was observed on the
        // first page of a run) → one retry. A second failure falls through to the
        // outer fail-safe below.
        if (attempt >= NAV_ATTEMPTS) throw e;
        console.warn(
          `[Naver Crawl] navigation attempt ${attempt} failed (${e instanceof Error ? e.message.split('\n')[0] : String(e)}) — retrying`
        );
        await sleep(2000);
      } finally {
        await page.close().catch(() => {});
      }
    }
    return null;
  } catch (e) {
    // Block / captcha / timeout / navigation error → fail-safe link-only (no fake price).
    console.warn(`[Naver Crawl] crawl failed for ${url}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
