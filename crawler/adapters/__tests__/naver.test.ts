/**
 * Naver adapter unit tests — pure matching logic (no network / no Playwright).
 * Covers pickOfficialOffer + helpers per final spec §2/§7:
 *  - individual mall offer vs 가격비교 catalog representative filtering
 *  - official mall match via mallName (allowlist normalize / brand contains)
 *  - no official-mall candidate → excluded (matched=null)
 *  - price + link come from the SAME matched offer
 *  - title-similarity gate; volume parsed and forwarded (not a hard reject)
 */
import {
  pickOfficialOffer,
  matchesOfficialMall,
  isIndividualMallOffer,
  normalizeMallName,
  productIdentityScore,
  NaverShoppingItem,
  OfferMatchInput,
} from '../naver';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function item(o: Partial<NaverShoppingItem>): NaverShoppingItem {
  return {
    title: '몽디에스 엑설런트 선크림 SPF50+ 60ml',
    link: 'https://smartstore.naver.com/mongdies/products/123',
    lprice: '21500',
    mallName: '몽디에스',
    productId: '123',
    productType: '2',
    ...o,
  };
}

const INPUT: OfferMatchInput = {
  brand: '몽디에스',
  name: '몽디에스 엑설런트 선크림',
  volumeMl: 50,
  allowedStoreName: '몽디에스 공식스토어',
};

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
console.log('\n--- normalizeMallName / matchesOfficialMall ---');
it('normalizeMallName strips spaces/case/공식스토어 suffix', () => {
  assert(normalizeMallName('몽디에스 공식스토어') === '몽디에스', 'expected 몽디에스');
});
it('mallName matches allowlist tolerant of suffix variation', () => {
  assert(matchesOfficialMall('몽디에스', '몽디에스 공식스토어', '몽디에스'), 'should match');
});
it('catalog representative mallName "네이버" is NOT official', () => {
  assert(!matchesOfficialMall('네이버', '몽디에스 공식스토어', '몽디에스'), 'should reject 네이버');
});
it('falls back to brand containment when no allowlist entry', () => {
  assert(matchesOfficialMall('몽디에스스토어', null, '몽디에스'), 'brand-contained mall should match');
  assert(!matchesOfficialMall('쿠팡', null, '몽디에스'), 'reseller mall should not match brand');
});

console.log('\n--- isIndividualMallOffer ---');
it('catalog link is excluded', () => {
  assert(!isIndividualMallOffer(item({ link: 'https://search.shopping.naver.com/catalog/123' })), 'catalog link excluded');
});
it('productType 1 (catalog representative) is excluded', () => {
  assert(!isIndividualMallOffer(item({ productType: '1' })), 'productType 1 excluded');
});
it('productType 2/3 individual mall is included', () => {
  assert(isIndividualMallOffer(item({ productType: '2' })), 'pt2 included');
  assert(isIndividualMallOffer(item({ productType: '3' })), 'pt3 included');
});

console.log('\n--- productIdentityScore ---');
it('full name tokens present → score 1.0', () => {
  assert(productIdentityScore('몽디에스 엑설런트 선크림 60ml', '몽디에스 엑설런트 선크림') === 1, 'score should be 1');
});
it('unrelated title → low score', () => {
  assert(productIdentityScore('조선미녀 스테이프레쉬 선크림', '몽디에스 엑설런트 선크림') < 0.5, 'should be < 0.5');
});

console.log('\n--- pickOfficialOffer ---');
it('matches official mall and returns price+link from the SAME offer', () => {
  const r = pickOfficialOffer([item({})], INPUT);
  assert(r.matched !== null, 'should match');
  assert(r.matched!.lprice === '21500', 'price from matched offer');
  assert(r.matched!.link === 'https://smartstore.naver.com/mongdies/products/123', 'link from matched offer');
  assert(r.parsedVolumeRaw === 60, `volume forwarded from title, got ${r.parsedVolumeRaw}`);
});

it('skips catalog representative, picks individual official-mall offer', () => {
  const catalog = item({ mallName: '네이버', productType: '1', link: 'https://search.shopping.naver.com/catalog/999', lprice: '15000' });
  const official = item({ lprice: '21500' });
  const r = pickOfficialOffer([catalog, official], INPUT);
  assert(r.matched !== null && r.matched.lprice === '21500', 'should pick the official mall, not catalog lowest');
});

it('no official-mall offer → excluded (matched=null, reseller NOT used)', () => {
  const reseller = item({ mallName: '쿠팡', link: 'https://coupang.com/x', lprice: '15000' });
  const r = pickOfficialOffer([reseller], { ...INPUT, allowedStoreName: '몽디에스 공식스토어' });
  assert(r.matched === null, 'should not match a reseller');
  assert(/official mall/.test(r.reason), `reason should explain: ${r.reason}`);
});

it('official mall but wrong product (low title similarity) → excluded', () => {
  const wrong = item({ title: '몽디에스 베이비 로션 200ml' });
  const r = pickOfficialOffer([wrong], INPUT);
  assert(r.matched === null, 'different product should be excluded');
});

it('empty results → excluded with reason', () => {
  const r = pickOfficialOffer([], INPUT);
  assert(r.matched === null && r.reason.length > 0, 'empty → excluded');
});

// ---------------------------------------------------------------------------
console.log('\n=== naver.test.ts Results ===');
for (const r of results) console.log(r);
if (failed) {
  console.error('\nResult: FAILED');
  process.exit(1);
} else {
  console.log('\nResult: ALL PASSED');
}
