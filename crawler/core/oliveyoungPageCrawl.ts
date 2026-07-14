/**
 * OliveYoung product-page price crawl — 정가(정상가) + 할인가(판매가) from OUR curated
 * links. Runs under OliveYoung's EXPLICIT crawl permission (business team; no API).
 *
 * WHY a page crawl (not the Naver Shopping API): the API frequently has no OliveYoung
 * offer for a curated product → the listing fell to Tier 3/4 → link_only piled up. The
 * product page always has the exact price for OUR link, so we read it directly.
 *
 * ⚠️ Anti-bot: oliveyoung.co.kr is fronted by a Cloudflare managed challenge
 * ("Just a moment…"). It flags the HEADLESS fingerprint even from a residential IP, so
 * this crawl is **HEADFUL** (headless:false) — a real browser executes the challenge JS
 * and passes. We stay honest and low-impact (mirrors crawler/core/naverPageCrawl.ts):
 *   - serial + rate-limited (≥ OLIVEYOUNG_CRAWL_INTERVAL_MS between pages),
 *   - NO user-agent spoofing (real headful Chrome UA as-is) and NO anti-detection flags,
 *   - volume ≤ the number of curated OliveYoung links/day,
 *   - FAIL-SAFE: any block / challenge-not-cleared / timeout / parse miss → null, so the
 *     caller keeps the listing link-only. We never fabricate a price.
 * Because it is headful, it runs on a machine with a real display (the operator's
 * desktop / a mini-PC), NOT GitHub Actions — a datacenter IP gets a much stricter
 * challenge (probe: 1/3 vs 3/3 residential). See docs/worklog/feature-oliveyoung-page-crawl.md.
 *
 * Parse source = stable `data-qa-name` DOM anchors (QA hooks; survive deploys, unlike
 * CSS-module-hashed classes; present in the rendered HTML even when the RSC flight is
 * not): text-product-original-price = 정가, text-product-discount-price = 할인가.
 */

export interface OyPageParseResult {
  regularPrice: number | null; // 정가 (정상가, struck) — null when there is no discount
  salePrice: number | null; //    할인가 (판매가) — the price to pay
  soldOut: boolean; //            explicit sold-out signal (buy button → 재입고 알림)
  title: string | null; //        product name (og:title) — for 개수/구성/용량 normalize
  found: boolean; //              a usable price was located
}

/** Parse a positive integer KRW amount from a "24,000" / "24000" string. */
function toKrw(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * First price after a `data-qa-name` anchor. The number may sit a few tags away
 * (e.g. `…="text-product-original-price"><span>24,000</span>`), so scan a short
 * window and take the first comma-grouped figure (≥ 3 chars ⇒ ≥ 100원).
 */
function priceAfterQa(html: string, qaName: string): number | null {
  const m = html.match(new RegExp(`data-qa-name="${qaName}"[\\s\\S]{0,240}?(\\d[\\d,]{2,})`));
  return m ? toKrw(m[1]) : null;
}

/** og: meta content (e.g. og:title). */
function ogMeta(html: string, property: string): string | null {
  const m = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i')
  );
  return m ? m[1] : null;
}

/** <title> text, DOM fallback when og:title is absent. */
function htmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : null;
}

/** Strip the " | 올리브영" mall suffix from a page title. */
function stripMallSuffix(t: string | null): string | null {
  if (!t) return null;
  const s = t.replace(/\s*\|\s*올리브영\s*$/, '').trim();
  return s || null;
}

/**
 * Explicit sold-out signal — conservative (default in-stock unless a POSITIVE signal
 * is found, so a flaky read never hides a valid offer):
 *   - the RSC flight (when present) carries `"saleableFlag":false`,
 *   - OliveYoung swaps the 바로구매/장바구니 buttons for a "재입고 알림" restock button.
 */
export function detectOySoldOut(html: string): boolean {
  if (/"saleableFlag"\s*:\s*false/i.test(html)) return true;
  if (/"soldOut(?:Flag)?"\s*:\s*true/i.test(html)) return true;
  if (/재입고\s*알림/.test(html)) return true;
  return false;
}

/**
 * Pure parser — extract 정가/할인가/제목/품절 from OliveYoung product-page HTML.
 * Testable without any network/Playwright. Resolution of the two-price model:
 *   - 할인가 없음(정가만) → sale = 정가, regular = null (no fake "정가 대비" gap),
 *   - 할인가만 → regular = null,
 *   - 둘 다 & 할인가 ≥ 정가 → 실할인 아님 → regular = null.
 */
export function parseOliveYoungPage(html: string): OyPageParseResult {
  const title = stripMallSuffix(ogMeta(html, 'og:title')) ?? stripMallSuffix(htmlTitle(html));
  const soldOut = detectOySoldOut(html);

  let regular = priceAfterQa(html, 'text-product-original-price'); // struck 정가 (discounted only)
  let sale = priceAfterQa(html, 'text-product-discount-price'); //    할인가 / sole price

  if (regular !== null && sale === null) sale = regular;
  if (regular !== null && sale !== null && sale >= regular) regular = null;

  return { regularPrice: regular, salePrice: sale, soldOut, title, found: sale !== null };
}

// ---------------------------------------------------------------------------
// Playwright runner (network, HEADFUL). Skipped in mock mode by the caller.
// ---------------------------------------------------------------------------

/** Canonical OliveYoung product URL for a goodsNo (avoids the oy.run interstitial). */
export function goodsDetailUrl(goodsNo: string): string {
  return `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${goodsNo}`;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Serial pacing across the whole run (guard so two crawls never fire back-to-back).
let lastCrawlAt = 0;
const MIN_CRAWL_INTERVAL_MS = parseInt(process.env.OLIVEYOUNG_CRAWL_INTERVAL_MS ?? '1800', 10);
const CRAWL_TIMEOUT_MS = parseInt(process.env.OLIVEYOUNG_CRAWL_TIMEOUT_MS ?? '45000', 10);
const CHALLENGE_ATTEMPTS = 2;

const PRICE_ANCHOR =
  '[data-qa-name="text-product-original-price"],[data-qa-name="text-product-discount-price"]';

/**
 * Load a curated OliveYoung product page (by goodsNo) HEADFUL and read 정가/할인가.
 * Returns null on ANY failure (playwright unavailable, challenge not cleared, timeout,
 * block, non-OliveYoung landing, or no price) so the caller falls back to link-only —
 * never a guessed price.
 */
export async function crawlOliveYoungPage(goodsNo: string): Promise<OyPageParseResult | null> {
  if (!goodsNo) return null;

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
    console.warn('[OliveYoung Crawl] playwright not installed — skipping page crawl (link-only)');
    return null;
  }

  const url = goodsDetailUrl(goodsNo);
  let browser: import('playwright').Browser | null = null;
  try {
    // HEADFUL — required to clear the Cloudflare managed challenge. Honest: no UA
    // spoofing, no anti-detection flags.
    browser = await chromium.launch({ headless: false });
    const page = await (await browser.newContext()).newPage();

    // The challenge auto-clears for a real browser but occasionally re-challenges;
    // reload up to CHALLENGE_ATTEMPTS times, waiting for the price anchor each time.
    let cleared = false;
    for (let attempt = 1; attempt <= CHALLENGE_ATTEMPTS; attempt++) {
      if (attempt === 1) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CRAWL_TIMEOUT_MS });
      else await page.reload({ waitUntil: 'domcontentloaded', timeout: CRAWL_TIMEOUT_MS });
      cleared = await page
        .waitForSelector(PRICE_ANCHOR, { timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      if (cleared) break;
      await sleep(2000);
    }
    if (!cleared) {
      console.warn(`[OliveYoung Crawl] challenge not cleared for goodsNo ${goodsNo} — link-only`);
      return null;
    }

    // Guard: make sure we actually landed on an OliveYoung product page.
    if (!/getGoodsDetail\.do/i.test(page.url())) {
      console.warn(`[OliveYoung Crawl] did not reach a product page (${page.url()}) — link-only`);
      return null;
    }

    const html = await page.content();
    const parsed = parseOliveYoungPage(html);
    if (!parsed.found) {
      console.warn(`[OliveYoung Crawl] no price found for goodsNo ${goodsNo} — link-only`);
    }
    return parsed;
  } catch (e) {
    // Block / challenge / timeout / navigation error → fail-safe link-only (no fake price).
    console.warn(`[OliveYoung Crawl] crawl failed for goodsNo ${goodsNo}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
