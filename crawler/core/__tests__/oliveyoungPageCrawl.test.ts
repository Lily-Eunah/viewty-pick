/**
 * OliveYoung page-crawl PURE-PARSER tests (no network / no Playwright).
 * Covers parseOliveYoungPage + detectOySoldOut against the real product-page shape:
 *  - text-product-original-price = 정가 (struck; number split across spans),
 *    text-product-discount-price = 할인가
 *  - 정가만 → sale=정가 + regular collapsed to null (no fake "정가 대비" gap)
 *  - 할인가 ≥ 정가 → drop regular
 *  - og:title (with promo badges + 용량) for 개수/구성/용량 normalize; " | 올리브영" stripped
 *  - sold-out: 재입고 알림 button / saleableFlag:false → flagged; default in-stock
 *  - no price → found=false
 */
import { parseOliveYoungPage, detectOySoldOut, goodsDetailUrl } from '../oliveyoungPageCrawl';

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

// Build a product-page fixture mirroring the real `data-qa-name` DOM. `original` is a
// struck price whose number is split across spans (as OliveYoung renders it).
function page(opts: {
  title?: string;
  original?: number | string;
  discount?: number | string;
  soldOut?: boolean;
  saleableFlag?: boolean;
}): string {
  const title = opts.title ?? '[화잘먹] 스타라이크 PDRN 스킨 핏 수분 선크림 50ml | 올리브영';
  const original =
    opts.original !== undefined
      ? `<s data-qa-name="text-product-original-price"><span>${opts.original}</span><span class="unit__x">원</span></s>`
      : '';
  const discount =
    opts.discount !== undefined
      ? `<span data-qa-name="text-product-discount-price">${opts.discount}원</span>`
      : '';
  const buyArea = opts.soldOut
    ? '<button data-qa-name="button-product-restock">재입고 알림</button>'
    : '<button data-qa-name="button-product-cart">장바구니</button><button data-qa-name="button-product-buy">바로구매</button>';
  const flight =
    opts.saleableFlag !== undefined
      ? `<script>self.__next_f.push([1,"{\\"saleableFlag\\":${opts.saleableFlag}}"])</script>`
      : '';
  return `<!doctype html><html><head>
    <meta property="og:title" content="${title}">
    <title>${title}</title>
    </head><body>
    <div class="price-area">${original}<em class="rate"><span>40</span><span>%</span></em>${discount}</div>
    ${buyArea}${flight}
    </body></html>`;
}

console.log('\n--- parseOliveYoungPage: 정가 + 할인가 ---');
it('discount: 정가(struck, split spans) > 할인가 → both kept', () => {
  const r = parseOliveYoungPage(page({ original: '24,000', discount: '14,400' }));
  assert(r.regularPrice === 24000, `정가 24000 expected, got ${r.regularPrice}`);
  assert(r.salePrice === 14400, `할인가 14400 expected, got ${r.salePrice}`);
  assert(r.found === true && r.soldOut === false, 'found, in stock');
});

it('정가만 없이 할인가만(=단독가) → regular null', () => {
  const r = parseOliveYoungPage(page({ discount: '18,900' }));
  assert(r.salePrice === 18900, `sole price 18900 expected, got ${r.salePrice}`);
  assert(r.regularPrice === null, `regular null when no struck 정가, got ${r.regularPrice}`);
  assert(r.found === true, 'found');
});

it('할인가 ≥ 정가 (no real discount) → drop regular', () => {
  const r = parseOliveYoungPage(page({ original: '20,000', discount: '20,000' }));
  assert(r.regularPrice === null && r.salePrice === 20000, `equal → regular null, got ${r.regularPrice}/${r.salePrice}`);
});

it('정가만 존재(할인 요소 없음) → sale=정가, regular null', () => {
  // Only the original-price anchor present, no discount anchor.
  const r = parseOliveYoungPage(page({ original: '15,000' }));
  assert(r.salePrice === 15000 && r.regularPrice === null, `sale=정가 15000/regular null, got ${r.salePrice}/${r.regularPrice}`);
});

it('unformatted number (no commas) still parses', () => {
  const r = parseOliveYoungPage(page({ discount: '9900' }));
  assert(r.salePrice === 9900, `9900 expected, got ${r.salePrice}`);
});

console.log('\n--- title (개수/구성/용량 source) ---');
it('og:title keeps badges + 용량, strips " | 올리브영"', () => {
  const r = parseOliveYoungPage(page({ discount: '14,400' }));
  assert(r.title === '[화잘먹] 스타라이크 PDRN 스킨 핏 수분 선크림 50ml', `title strip failed: ${r.title}`);
});

console.log('\n--- sold out ---');
it('재입고 알림 button → soldOut (even with a price)', () => {
  const r = parseOliveYoungPage(page({ original: '24,000', discount: '14,400', soldOut: true }));
  assert(r.soldOut === true, '재입고 알림 → soldOut');
});
it('saleableFlag:false → soldOut', () => {
  assert(detectOySoldOut('{"saleableFlag":false}') === true, 'saleableFlag false → soldOut');
});
it('in-stock page (buy button, saleableFlag true) → not soldOut', () => {
  const r = parseOliveYoungPage(page({ discount: '14,400', saleableFlag: true }));
  assert(r.soldOut === false, 'should be in stock');
});

console.log('\n--- no price / url ---');
it('no price anchors → found=false', () => {
  const r = parseOliveYoungPage('<html><head><meta property="og:title" content="X | 올리브영"></head><body>no price</body></html>');
  assert(r.found === false && r.salePrice === null, 'no price → found false');
});
it('goodsDetailUrl builds the canonical product URL', () => {
  assert(
    goodsDetailUrl('A000000235913') === 'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000235913',
    'goodsDetailUrl shape',
  );
});

console.log('');
for (const r of results) console.log(r);
if (failed) {
  console.error('\nSOME TESTS FAILED');
  process.exit(1);
}
console.log('\nAll OliveYoung page-crawl parser tests passed.');
