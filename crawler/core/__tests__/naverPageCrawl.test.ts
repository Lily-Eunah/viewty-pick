/**
 * Naver page-crawl PURE-PARSER tests (no network / no Playwright).
 * Covers parseNaverPagePrices + detectSoldOut + isNaverStorefrontUrl per the
 * 정가/할인가 spec:
 *  - salePrice = 정가 (regular), discountedSalePrice = 할인가 (sale)
 *  - 정가만 있으면 sale=정가 + no fake regular (regular collapsed to null)
 *  - discount (sale < regular) → both kept
 *  - benefitsView-nested discountedSalePrice still parsed; mobile* NOT mis-caught
 *  - sold-out / sale-suspended detection → no buyable price surfaced
 *  - og:title for volume; og product:price fallback; no price → found=false
 */
import {
  parseNaverPagePrices,
  detectSoldOut,
  isNaverStorefrontUrl,
} from '../naverPageCrawl';

let failed = false;
const results: string[] = [];
function it(name: string, fn: () => void) {
  try {
    fn();
    results.push(`PASS  ${name}`);
    console.log(`  ✓ ${name}`);
  } catch (e: unknown) {
    failed = true;
    const msg = e instanceof Error ? e.message : String(e);
    results.push(`FAIL  ${name}: ${msg}`);
    console.error(`  ✗ ${name}: ${msg}`);
  }
}
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// A minimal embedded-state fixture (the real __PRELOADED_STATE__ is huge; the
// parser only needs the price/status keys + og:title).
function page(opts: {
  title?: string;
  state?: string;
  ogPrice?: number;
}): string {
  const title = opts.title ?? '에뛰드 순정 약산성 클렌징폼 150ml';
  const ogPrice = opts.ogPrice !== undefined ? `<meta property="product:price:amount" content="${opts.ogPrice}">` : '';
  return `<!doctype html><html><head>
    <meta property="og:title" content="${title}">
    ${ogPrice}
    </head><body>
    <script>window.__PRELOADED_STATE__ = {${opts.state ?? ''}};</script>
    </body></html>`;
}

console.log('\n--- parseNaverPagePrices: 정가 + 할인가 ---');
it('discount: salePrice 정가 > discountedSalePrice 할인가 → both kept', () => {
  const html = page({ state: `"product":{"salePrice":30000,"discountedSalePrice":24000,"saleStatus":"SALE"}` });
  const r = parseNaverPagePrices(html);
  assert(r.regularPrice === 30000, `정가 30000 expected, got ${r.regularPrice}`);
  assert(r.salePrice === 24000, `할인가 24000 expected, got ${r.salePrice}`);
  assert(r.found === true && r.soldOut === false, 'found, in stock');
});

it('정가만 (no discount) → sale=정가, regular collapsed to null (no fake gap)', () => {
  const html = page({ state: `"product":{"salePrice":18900,"saleStatus":"SALE"}` });
  const r = parseNaverPagePrices(html);
  assert(r.salePrice === 18900, `할인가=정가 18900 expected, got ${r.salePrice}`);
  assert(r.regularPrice === null, `regular should collapse to null when no discount, got ${r.regularPrice}`);
  assert(r.found === true, 'found');
});

it('할인가 ≥ 정가 (no real discount) → drop regular', () => {
  const html = page({ state: `"product":{"salePrice":20000,"discountedSalePrice":20000}` });
  const r = parseNaverPagePrices(html);
  assert(r.regularPrice === null && r.salePrice === 20000, `equal prices → regular null, got ${r.regularPrice}/${r.salePrice}`);
});

it('benefitsView-nested discountedSalePrice is parsed', () => {
  const html = page({ state: `"product":{"salePrice":40000,"benefitsView":{"discountedSalePrice":33000}}` });
  const r = parseNaverPagePrices(html);
  assert(r.regularPrice === 40000 && r.salePrice === 33000, `nested 할인가 expected 40000/33000, got ${r.regularPrice}/${r.salePrice}`);
});

it('mobileDiscountedSalePrice is NOT mistaken for discountedSalePrice', () => {
  // mobile field appears FIRST; the desktop discountedSalePrice is the real one.
  const html = page({ state: `"product":{"salePrice":50000,"mobileDiscountedSalePrice":1,"discountedSalePrice":45000}` });
  const r = parseNaverPagePrices(html);
  assert(r.salePrice === 45000, `should pick desktop 45000 not mobile 1, got ${r.salePrice}`);
});

console.log('\n--- sold out / sale suspended ---');
it('saleStatus SUSPENSION → soldOut (no buyable price even if price present)', () => {
  const html = page({ state: `"product":{"salePrice":30000,"discountedSalePrice":24000,"saleStatus":"SUSPENSION"}` });
  const r = parseNaverPagePrices(html);
  assert(r.soldOut === true, 'suspension → soldOut');
});
it('stockQuantity 0 → soldOut', () => {
  assert(detectSoldOut(`{"stockQuantity":0}`) === true, 'stock 0 sold out');
});
it('outOfStock true → soldOut', () => {
  assert(detectSoldOut(`{"outOfStock":true}`) === true, 'outOfStock sold out');
});
it('in-stock SALE → not soldOut', () => {
  assert(detectSoldOut(`{"saleStatus":"SALE","stockQuantity":12}`) === false, 'SALE not soldOut');
});

console.log('\n--- title (og:title) + DOM fallback ---');
it('og:title is captured for volume/단품 normalize', () => {
  const r = parseNaverPagePrices(page({ title: '이니스프리 그린티 세럼 80ml', state: `"product":{"salePrice":29000}` }));
  assert(r.title === '이니스프리 그린티 세럼 80ml', `og:title expected, got ${r.title}`);
});
it('no embedded price → falls back to og product:price (할인가 only)', () => {
  const html = page({ state: '', ogPrice: 15900 });
  const r = parseNaverPagePrices(html);
  assert(r.salePrice === 15900 && r.regularPrice === null, `og price fallback 15900, got ${r.regularPrice}/${r.salePrice}`);
  assert(r.found === true, 'found via og price');
});
it('no price anywhere → found=false (caller keeps link-only)', () => {
  const r = parseNaverPagePrices(page({ state: `"product":{"name":"x"}` }));
  assert(r.found === false && r.salePrice === null, 'no price → not found');
});

console.log('\n--- isNaverStorefrontUrl ---');
it('brand/smartstore/naver.me are storefront URLs', () => {
  assert(isNaverStorefrontUrl('https://brand.naver.com/etude/products/123'), 'brand');
  assert(isNaverStorefrontUrl('https://smartstore.naver.com/innisfree/products/5'), 'smartstore');
  assert(isNaverStorefrontUrl('https://m.smartstore.naver.com/x/products/5'), 'm.smartstore');
  assert(isNaverStorefrontUrl('https://naver.me/abcd'), 'naver.me');
});
it('coupang / oliveyoung / catalog are NOT crawl targets', () => {
  assert(!isNaverStorefrontUrl('https://www.coupang.com/vp/products/1'), 'coupang');
  assert(!isNaverStorefrontUrl('https://www.oliveyoung.co.kr/x'), 'oliveyoung');
  assert(!isNaverStorefrontUrl('https://search.shopping.naver.com/catalog/123'), 'catalog');
  assert(!isNaverStorefrontUrl(null), 'null');
});

console.log('\n=== naverPageCrawl.test.ts Results ===');
for (const r of results) console.log(r);
if (failed) {
  console.error('\nResult: FAILED');
  process.exit(1);
} else {
  console.log('\nResult: ALL PASSED');
}
