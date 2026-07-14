/**
 * READ-ONLY feasibility probe — can a headless Playwright browser get an OliveYoung
 * product page THROUGH THE WAF and read its title + price, FROM THE CRAWL RUNNER?
 *
 * WHY this exists (and why it must run in CI, not just locally):
 *   OliveYoung granted ViewtyPick explicit permission to crawl our own curated
 *   product links, but did NO technical whitelisting — the WAF still blocks
 *   automated clients (a plain fetch of even /robots.txt returns 403; a real
 *   browser gets 200). Permission ≠ access. Before building the OliveYoung
 *   page-crawl adapter we must confirm the crawl ENVIRONMENT itself gets past the
 *   WAF: the daily crawl runs on `crawl.yml` → ubuntu-latest (a datacenter IP), and
 *   Naver's equivalent Playwright page crawl was hard-blocked (HTTP 429) from that
 *   very runner. There is no whitelist safety net here, so we probe before we build.
 *
 * Honest & low-impact (mirrors crawler/core/naverPageCrawl.ts's stance):
 *   - serial, one page at a time, with a polite delay between pages,
 *   - NO user-agent spoofing (Playwright's default headless UA is used as-is; the
 *     probe prints it so we can see the baseline the WAF actually saw),
 *   - only a handful of our OWN curated oy.run links,
 *   - NO DB writes, NO code/adapter changes — pure diagnostic.
 *
 * Parse target = the Next.js flight stream (`window.__next_f`), which carries the
 * price as stable app-level keys — `salePrice` (정가/정상가), `finalPrice` (할인가),
 * `goodsName` — unlike the CSS-module-hashed price DOM classes that change per deploy.
 *
 * Run locally: npx playwright install chromium && npx tsx scripts/live-check/diagnose-oliveyoung-crawl.ts
 * In CI:       .github/workflows/oliveyoung-probe.yml (workflow_dispatch).
 */
export {}; // module scope (avoid global name collisions with other script files)

interface Target {
  label: string;
  url: string; // our curated oy.run affiliate short link
}

// A handful of our OWN curated oy.run links (from crawler/sheets/reseed_sheets.ts).
// Hardcoded so the probe is self-contained (no Supabase dependency) — it only needs
// to answer "does this runner's IP get past the WAF", which any real link answers.
// Override with a comma-separated OY_PROBE_URLS to probe specific links.
const DEFAULT_TARGETS: Target[] = [
  { label: '스타라이크 PDRN 선크림', url: 'https://oy.run/g1ip6hEbG0GQsu' },
  { label: '멜라 TXA 선세럼', url: 'https://oy.run/nq6hNFFJuXtQ7h' },
  { label: '이니스프리 톤업 선크림', url: 'https://oy.run/rRbPHHbTfWaDJC' },
];

function targets(): Target[] {
  const override = process.env.OY_PROBE_URLS?.trim();
  if (override) {
    return override
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)
      .map((u, i) => ({ label: `override[${i}]`, url: u }));
  }
  return DEFAULT_TARGETS;
}

// WAF / anti-bot block signatures OliveYoung (or a fronting CDN) may serve instead
// of the product page. Conservative — presence is only used to explain a no-price.
const BLOCK_SIGNALS = [
  { re: /access denied|forbidden/i, name: 'access-denied' },
  { re: /request (blocked|unauthorized)|not authorized/i, name: 'request-blocked' },
  { re: /captcha|recaptcha/i, name: 'captcha' },
  { re: /비정상적인|자동 ?입력 방지|접근이 (차단|제한)|이용이 제한/, name: '접근 차단/제한' },
  { re: /잠시 후 다시|일시적으로/, name: '일시 차단' },
];

/**
 * Read the price from a stable `data-qa-name` DOM anchor via a Playwright locator.
 * These QA hooks survive deploys (unlike CSS-module-hashed classes) AND are present
 * in Playwright's render even when the RSC flight is absent:
 *   text-product-original-price = 정가 (struck; only when discounted)
 *   text-product-discount-price = 할인가 (or the sole price when there is no discount)
 * We use a LOCATOR (not page.evaluate of a named function): tsx/esbuild injects a
 * `__name` helper into named functions that does not exist in the page, so serializing
 * a complex extractor throws in-page. Locators sidestep serialization entirely.
 */
async function qaPrice(page: import('playwright').Page, qaName: string): Promise<number | null> {
  const txt = await page
    .locator(`[data-qa-name="${qaName}"]`)
    .first()
    .textContent({ timeout: 2000 })
    .catch(() => null);
  const digits = (txt || '').replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : null;
}

async function probe(t: Target, chromium: typeof import('playwright').chromium): Promise<string> {
  const lines: string[] = [];
  lines.push(`\n=== ${t.label} ===`);
  lines.push(`curated: ${t.url}`);

  let browser: import('playwright').Browser | null = null;
  let verdict = 'UNKNOWN';
  try {
    // HEADFUL (headless:false). OliveYoung fronts the storefront with a Cloudflare
    // managed challenge ("Just a moment…") that flags the headless fingerprint even
    // from a residential IP — a real browser executes the challenge JS and passes.
    // We stay HONEST: no anti-detection flags, no UA spoofing — just a real browser
    // running the challenge as any visitor's would (we are authorized to crawl).
    browser = await chromium.launch({ headless: false });
    const page = await (await browser.newContext()).newPage();

    // The Cloudflare managed challenge auto-clears for a real browser, but occasionally
    // re-challenges — reload up to `MAX_ATTEMPTS` times, each time waiting for the price
    // DOM anchor to appear (the reliable "product page rendered" signal; the RSC flight
    // is not). oy.run is an affiliate interstitial, so the first goto also covers the
    // follow-through to getGoodsDetail.
    const MAX_ATTEMPTS = 2;
    let httpStatus: number | null = null;
    let cleared = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const resp =
          attempt === 1
            ? await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 45000 })
            : await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
        httpStatus = resp ? resp.status() : httpStatus;
      } catch (e) {
        lines.push(`playwright goto: TIMEOUT/ERROR (${e instanceof Error ? e.message : String(e)})`);
        lines.push('VERDICT: LOAD TIMEOUT — could not reach a product page (possible hard block or hang).');
        return lines.join('\n');
      }
      cleared = await page
        .waitForFunction(
          () => {
            const t2 = document.title || '';
            const hasPrice = !!document.querySelector(
              '[data-qa-name="text-product-original-price"],[data-qa-name="text-product-discount-price"]'
            );
            return !/just a moment|잠시만 기다리/i.test(t2) && hasPrice;
          },
          { timeout: 30000 }
        )
        .then(() => true)
        .catch(() => false);
      if (cleared) break;
      await page.waitForTimeout(2000); // let the challenge settle before a reload retry
    }

    const landedUrl = page.url();
    const title = await page.title().catch(() => '');
    const html = await page.content();
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
    const ua = await page.evaluate(() => navigator.userAgent).catch(() => null);

    // 정가 (struck original, only when discounted) + 할인가 / sole price — stable qa anchors.
    const regularPrice = await qaPrice(page, 'text-product-original-price');
    const discountPrice = await qaPrice(page, 'text-product-discount-price');
    const salePrice = discountPrice ?? regularPrice; // no discount ⇒ the sole price is the price
    const goodsName = (title || '').replace(/\s*\|\s*올리브영\s*$/, '').trim() || null;
    const priceLikeText = bodyText.match(/[1-9]\d?,\d{3}원/)?.[0] ?? null;

    const reachedProduct = /getGoodsDetail\.do/i.test(landedUrl);
    const challengeStill = /just a moment|잠시만 기다리/i.test(title);
    const emptyBody = bodyText.trim().length < 40;
    const blocks = BLOCK_SIGNALS.filter((b) => b.re.test(bodyText) || b.re.test(html)).map((b) => b.name);
    const gotPrice = !!(salePrice || priceLikeText);

    lines.push(`http status : ${httpStatus}${cleared ? '' : '  (challenge NOT cleared)'}`);
    lines.push(`landed url  : ${landedUrl}${reachedProduct ? '' : '  (did NOT reach a product page)'}`);
    lines.push(`title       : ${title}`);
    lines.push(`browser UA  : ${ua ?? '(unknown)'}`);
    lines.push(`parsed      : name=${goodsName ?? '(none)'} | 정가=${regularPrice ?? '(none)'} | 할인가=${salePrice ?? '(none)'} | price-text=${priceLikeText ?? '(none)'}`);
    lines.push(`block signals: status-403:${httpStatus === 403} empty-body:${emptyBody} challenge:${challengeStill} ${blocks.length ? '[' + blocks.join(', ') + ']' : ''}`);
    lines.push(`body[0..300]: ${bodyText.replace(/\s+/g, ' ').slice(0, 300)}`);

    if (gotPrice && reachedProduct) {
      verdict = `PASS — challenge passed from this runner; product page rendered and price parsed (정가 ${regularPrice ?? '—'}, 할인가 ${salePrice}). The headful page-crawl adapter is viable here.`;
    } else if (httpStatus === 403 || blocks.length > 0) {
      verdict = `HARD BLOCK — WAF served a block/403 from this runner (status ${httpStatus}${blocks.length ? ', signals: ' + blocks.join('/') : ''}). Escalate: OliveYoung whitelist, or a non-datacenter egress.`;
    } else if (challengeStill || emptyBody || !reachedProduct) {
      verdict = `HARD BLOCK — Cloudflare challenge did NOT clear headful from this runner (${challengeStill ? 'still on challenge page' : !reachedProduct ? 'never reached getGoodsDetail' : 'empty body'}). This is the datacenter-IP risk: escalate (OliveYoung whitelist / non-datacenter egress).`;
    } else {
      verdict = 'INCONCLUSIVE — reached the product page but no price parsed (qa-name drift or slow render?). Inspect the body snippet + raise the wait.';
    }
    lines.push(`VERDICT: ${verdict}`);
  } catch (e) {
    lines.push(`VERDICT: ERROR (${e instanceof Error ? e.message : String(e)})`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  return lines.join('\n');
}

async function main() {
  console.log('OliveYoung page-crawl feasibility probe (READ-ONLY — no DB writes, no code changes)\n');
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('playwright not installed. Run: npx playwright install chromium');
    process.exit(1);
  }

  const ts = targets();
  console.log(`Probing ${ts.length} curated OliveYoung link(s), serial, HEADFUL, default UA...`);

  const reports: string[] = [];
  for (const t of ts) {
    const r = await probe(t, chromium);
    console.log(r);
    reports.push(r);
    await new Promise((res) => setTimeout(res, 2500)); // be polite between pages
  }

  console.log('\n\n========== SUMMARY ==========');
  let anyPass = false;
  for (const r of reports) {
    const label = r.match(/=== (.+) ===/)?.[1] ?? '?';
    const verdict = r.match(/VERDICT: (.+)/)?.[1] ?? '(no verdict)';
    if (/^PASS/.test(verdict)) anyPass = true;
    console.log(`- ${label}: ${verdict}`);
  }
  console.log(
    `\nOVERALL: ${anyPass ? 'AT LEAST ONE PASS — headful crawl from this runner is viable; proceed to the adapter.' : 'NO PASS — the crawl runner could not clear OliveYoung headful; escalate (OliveYoung whitelist / non-datacenter egress) before building the adapter.'}`
  );
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
