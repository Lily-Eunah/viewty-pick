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
  classifyOfferComposition,
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

console.log('\n--- classifyOfferComposition (single vs set/multipack) ---');
it('single unit (with SPF50+) → single', () => {
  assert(classifyOfferComposition('몽디에스 엑설런트 선크림 SPF50+ 60ml').kind === 'single', 'SPF50+ single should be single');
});
it('single 1개 → single', () => {
  assert(classifyOfferComposition('비플레인 녹두 라하 토너 265ml, 1개').kind === 'single', '"1개" is single');
});
it('single + pure freebie (쇼핑백) → single', () => {
  assert(classifyOfferComposition('랑콤 제니피끄 세럼 50ml (+쇼핑백 증정)').kind === 'single', 'pure non-unit gift must not make it a set');
});
it('기획 with extra sample unit (+7ml*2) → set (excluded, trust-first)', () => {
  assert(classifyOfferComposition('유세린 에피셀린 세럼 30ml 기획 (+에피셀린 세럼 7ml*2)').kind === 'set', 'an added sellable unit ⇒ exclude');
});
it('serum + device set (heterogeneous, no volume on 2nd item) → set', () => {
  assert(classifyOfferComposition('바이오힐보 NAD 세럼 30ml + 슈링크 홈 부스터 샷 기획').kind === 'set', '세럼+디바이스 is a set');
});
it('선물 세트 → set', () => {
  assert(classifyOfferComposition('[6월] 제니피끄 세럼 50ml 선물 세트 (+쇼핑백)').kind === 'set', '선물 세트 is a set');
});
it('더블 기획 → set', () => {
  assert(classifyOfferComposition('[단독기획] 토리든 다이브인 포맨 올인원 200g 더블 기획').kind === 'set', '더블 is a set');
});
it('2종 세트 (heterogeneous) → set', () => {
  assert(classifyOfferComposition('유세린 에피셀린 세럼 30ml+일루미네이팅 세럼 30ml 2종 세트').kind === 'set', '2종 세트 is a set');
});
it('1+1 / 리필 → set', () => {
  assert(classifyOfferComposition('비플레인 라하 토너 265ml 기획 (+265ml 리필팩)').kind === 'set', '1+1 refill is a set');
  assert(classifyOfferComposition('세럼 30ml 1+1').kind === 'set', '1+1 is a set');
});
it('N개 multipack (N≥2) → set', () => {
  assert(classifyOfferComposition('라하 토너 265ml, 6개').kind === 'set', '6개 is a multipack');
});

console.log('\n--- pickOfficialOffer: single preference + set exclusion ---');
it('excludes set-only official offers (no comparable single → matched=null)', () => {
  const set = item({ title: '제니피끄 세럼 50ml 선물 세트', mallName: '랑콤', lprice: '170000' });
  const r = pickOfficialOffer([set], { brand: '랑콤', name: '제니피끄 얼티미트 세럼', volumeMl: 50, allowedStoreName: '랑콤' });
  assert(r.matched === null, 'set-only must be excluded');
  assert(/set\/bundle\/multipack/.test(r.reason), `reason should explain set exclusion: ${r.reason}`);
});
it('picks the single over a higher-ranked set from the same official mall', () => {
  const set = item({ title: '유세린 에피셀린 세럼 30ml 더블팩', mallName: '유세린공식스토어', lprice: '73900', productId: 'A' });
  const single = item({ title: '유세린 에피셀린 세럼 30ml', mallName: '유세린공식스토어', lprice: '60900', productId: 'B' });
  const r = pickOfficialOffer([set, single], { brand: '유세린', name: '유세린 에피셀린 세럼', volumeMl: 30, allowedStoreName: '유세린공식스토어' });
  assert(r.matched !== null && r.matched.lprice === '60900', `should pick single 60900, got ${r.matched?.lprice}`);
});
it('prefers the volume-matching single among multiple singles', () => {
  const wrongVol = item({ title: '랑콤 제니피끄 세럼 115ml', mallName: '랑콤', lprice: '228880', productId: 'A' });
  const rightVol = item({ title: '랑콤 제니피끄 세럼 50ml', mallName: '랑콤', lprice: '149590', productId: 'B' });
  const r = pickOfficialOffer([wrongVol, rightVol], { brand: '랑콤', name: '랑콤 제니피끄 세럼', volumeMl: 50, allowedStoreName: '랑콤' });
  assert(r.matched !== null && r.matched.lprice === '149590', `should pick the 50ml single, got ${r.matched?.lprice}`);
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
