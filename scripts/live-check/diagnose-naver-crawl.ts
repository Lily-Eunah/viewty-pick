/**
 * READ-ONLY diagnostic — why does the Phase-1 Naver page crawl recover 0 prices?
 *
 * Determines, per curated URL, whether the failure is a FIXABLE BUG (we loaded the
 * wrong URL — e.g. the naver.me short link itself instead of its resolved target —
 * or the parser keys moved) or a HARD anti-bot BLOCK (page loads but exposes no
 * __PRELOADED_STATE__/price, or shows captcha / login redirect / empty body).
 *
 * NO DB WRITES. NO code/adapter changes. It only:
 *   - SELECTs the curated naver listing URLs (read-only) to fill in the naver.me
 *     targets the operator named (다이브인 / 녹두 라하 / NAD),
 *   - fetch()-resolves naver.me redirects to their final URL,
 *   - loads the RESOLVED final URL in Playwright and logs what it finds.
 *
 * Run: npx tsx -r dotenv/config scripts/live-check/diagnose-naver-crawl.ts
 * Prereqs: npx playwright install chromium; .env with Supabase (for URL lookup).
 */
import { supabaseServer, isSupabaseServerConfigured } from '../../lib/supabase/server';

interface Target { label: string; url: string; }

// Two brand.naver.com targets the operator gave explicitly.
const EXPLICIT: Target[] = [
  { label: '에뛰드 순정 (brand)', url: 'https://brand.naver.com/etude/products/10516809109' },
  { label: '이니스프리 (brand)', url: 'https://brand.naver.com/innisfree/products/13155811785' },
];

// naver.me targets resolved from the DB (read-only) by product-name keyword.
const NAVER_ME_KEYWORDS: { label: string; needles: string[] }[] = [
  { label: '토리든 다이브인', needles: ['다이브인'] },
  { label: '비플레인 녹두 라하', needles: ['라하'] },
  { label: '바이오힐보 NAD', needles: ['NAD'] },
];

async function discoverNaverMeTargets(): Promise<Target[]> {
  if (!isSupabaseServerConfigured()) {
    console.log('[discover] Supabase not configured — skipping naver.me lookup (brand targets only).');
    return [];
  }
  const { data: seller } = await supabaseServer.from('sellers').select('id').eq('slug', 'naver').single();
  if (!seller) return [];
  const { data: listings } = await supabaseServer
    .from('listings').select('product_id,url,is_active').eq('seller_id', seller.id).eq('is_active', true);
  const { data: products } = await supabaseServer.from('products').select('id,brand,name');
  const pmap = new Map((products ?? []).map((p) => [p.id, p]));
  const out: Target[] = [];
  for (const kw of NAVER_ME_KEYWORDS) {
    const hit = (listings ?? []).find((l) => {
      const p = pmap.get(l.product_id);
      const hay = `${p?.brand ?? ''} ${p?.name ?? ''}`;
      return kw.needles.some((n) => hay.includes(n));
    });
    if (hit?.url) out.push({ label: `${kw.label} (DB)`, url: hit.url });
    else console.log(`[discover] no active naver listing found for ${kw.label}`);
  }
  return out;
}

/** Follow a naver.me (or any) redirect via fetch → final URL. */
async function resolveFinalUrl(url: string): Promise<{ finalUrl: string; status: number | null; err: string | null }> {
  if (!/naver\.me\//.test(url)) return { finalUrl: url, status: null, err: null };
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
    return { finalUrl: res.url || url, status: res.status, err: null };
  } catch (e) {
    return { finalUrl: url, status: null, err: e instanceof Error ? e.message : String(e) };
  }
}

const BLOCK_SIGNALS = [
  { re: /captcha/i, name: 'captcha' },
  { re: /비정상적인|비정상 접근|자동 ?입력 방지/, name: '비정상적인 접근' },
  { re: /접근이 제한|이용이 제한|일시적으로 제한/, name: '접근 제한' },
  { re: /로봇이 아닙니다|robot/i, name: 'robot-check' },
];

async function probe(t: Target, chromium: typeof import('playwright').chromium): Promise<string> {
  const lines: string[] = [];
  lines.push(`\n=== ${t.label} ===`);
  lines.push(`curated: ${t.url}`);

  // 1) redirect resolve (fetch).
  const { finalUrl, status: fetchStatus, err: fetchErr } = await resolveFinalUrl(t.url);
  if (/naver\.me\//.test(t.url)) {
    lines.push(`fetch-resolve: ${fetchErr ? `FAILED (${fetchErr})` : `${fetchStatus} → ${finalUrl}`}`);
  }

  // 2) load the RESOLVED final URL in Playwright.
  let browser: import('playwright').Browser | null = null;
  let verdict = 'UNKNOWN';
  try {
    browser = await chromium.launch({ headless: true });
    const page = await (await browser.newContext()).newPage();
    let httpStatus: number | null = null;
    const affiliate = /brandconnect\.naver\.com\/affiliates/i.test(finalUrl);
    try {
      const resp = await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
      httpStatus = resp ? resp.status() : null;
    } catch (e) {
      lines.push(`playwright goto: TIMEOUT/ERROR (${e instanceof Error ? e.message : String(e)})`);
      lines.push(
        `VERDICT: ${
          affiliate
            ? 'AFFILIATE-INTERMEDIARY — naver.me resolves to brandconnect/affiliates (NOT a product page); navigation hangs (downstream brand throttle). A "use the resolved URL" fix is INSUFFICIENT — no product state to parse.'
            : 'LOAD TIMEOUT'
        }`
      );
      return lines.join('\n');
    }
    await page.waitForTimeout(2500); // let __PRELOADED_STATE__ populate

    const landedUrl = page.url();
    const title = await page.title().catch(() => '');
    const html = await page.content();
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');

    const hasState = /__PRELOADED_STATE__/.test(html);
    const hasSalePrice = /"salePrice"\s*:\s*\d+/.test(html);
    const hasDiscounted = /"discountedSalePrice"\s*:\s*\d+/.test(html);
    const hasBenefits = /"benefitsView"/.test(html);
    const priceText = (bodyText.match(/[\d,]{3,}\s*원/) ?? html.match(/[\d,]{3,}\s*원/))?.[0] ?? null;
    const loginRedirect = /nid\.naver\.com\/nidlogin|\/login/i.test(landedUrl);
    const emptyBody = bodyText.trim().length < 40;
    const blocks = BLOCK_SIGNALS.filter((b) => b.re.test(bodyText) || b.re.test(html)).map((b) => b.name);

    lines.push(`http status: ${httpStatus}`);
    lines.push(`landed url : ${landedUrl}${landedUrl !== finalUrl ? '  (re-redirected!)' : ''}`);
    lines.push(`title      : ${title}`);
    lines.push(`__PRELOADED_STATE__: ${hasState ? 'PRESENT' : 'ABSENT'}  | salePrice:${hasSalePrice} discountedSalePrice:${hasDiscounted} benefitsView:${hasBenefits}`);
    lines.push(`price-like text: ${priceText ?? '(none)'}`);
    lines.push(`block signals  : login-redirect:${loginRedirect} empty-body:${emptyBody} ${blocks.length ? '['+blocks.join(', ')+']' : ''}`);
    lines.push(`body[0..500]: ${bodyText.replace(/\s+/g, ' ').slice(0, 500)}`);

    // Anti-bot throttle: Naver serves an HTTP 429 / "시스템오류 · 접속이 불가" error page
    // to datacenter/headless clients instead of the product page.
    const throttled = httpStatus === 429 || /시스템\s*오류|접속이 불가|에러페이지/.test(`${title} ${bodyText}`);

    // Per-URL verdict.
    if ((hasState && (hasSalePrice || hasDiscounted)) || priceText) {
      verdict = /naver\.me\//.test(t.url)
        ? 'BUG — resolved URL exposes price/state; crawl likely opened the naver.me short link directly. FIX: pass the fetch-resolved final URL to the crawler.'
        : 'BUG (or parser-key drift) — page exposes price/state; check that the crawler loads THIS url and that parser keys match.';
    } else if (throttled) {
      verdict = `HARD BLOCK — anti-bot throttle (HTTP ${httpStatus}, "시스템오류/접속이 불가" page); no __PRELOADED_STATE__/price served to headless. NOT a URL/parser bug. → catalog-lprice alternative.`;
    } else if (loginRedirect || emptyBody || blocks.length > 0) {
      verdict = 'HARD BLOCK — page loads but no state/price + ' + [loginRedirect && 'login-redirect', emptyBody && 'empty-body', ...blocks].filter(Boolean).join('/') + '. → catalog-lprice alternative.';
    } else {
      verdict = 'INCONCLUSIVE — no price/state and no clear block signal (selector/state-shape change?). Inspect body snippet.';
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
  console.log('Naver page-crawl diagnostic (READ-ONLY — no DB writes, no code changes)\n');
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('playwright not installed. Run: npx playwright install chromium');
    process.exit(1);
  }

  const targets = [...EXPLICIT, ...(await discoverNaverMeTargets())];
  console.log(`Probing ${targets.length} curated URLs (serial)...`);

  const reports: string[] = [];
  for (const t of targets) {
    const r = await probe(t, chromium);
    console.log(r);
    reports.push(r);
    await new Promise((res) => setTimeout(res, 1500)); // be polite
  }

  console.log('\n\n========== SUMMARY ==========');
  for (const r of reports) {
    const label = r.match(/=== (.+) ===/)?.[1] ?? '?';
    const verdict = r.match(/VERDICT: (.+)/)?.[1] ?? '(no verdict)';
    console.log(`- ${label}: ${verdict}`);
  }
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
