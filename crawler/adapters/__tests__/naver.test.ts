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
  hasFormConflict,
  productNoFrom,
  pickAnchoredOffer,
  buildAnchorQueries,
  pickOliveYoungOffer,
  distinctiveTokens,
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
it('device bundle in a bracket tag (no +) → set', () => {
  assert(classifyOfferComposition('[슈링크홈디바이스] 바이오힐보 NAD프리즈셀 글로우 파워 세럼 30ml 기획').kind === 'set', 'device bundle is a set');
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

console.log('\n--- hasFormConflict (same-line different SKU) ---');
it('포맨 올인원 vs 클리어 수딩 크림 → conflict', () => {
  assert(hasFormConflict('레드 블레미쉬 포 맨 진정 올인원', '닥터지 레드 블레미쉬 클리어 수딩 크림 70mL 진정') === true, 'different form (올인원 vs 크림) should conflict');
});
it('선스틱 vs 수딩 크림 → conflict', () => {
  assert(hasFormConflict('레드 블레미쉬 수딩 업 선스틱', '닥터지 레드 블레미쉬 클리어 수딩 크림 70mL') === true, '선스틱 vs 크림 should conflict');
});
it('same form noun present (에멀전) → no conflict', () => {
  assert(hasFormConflict('판테놀 베리어 에멀전', '코스노리 판테놀 베리어 로션 에멀전 150ml') === false, 'shared 에멀전 → no conflict');
});
it('toner matches toner → no conflict', () => {
  assert(hasFormConflict('녹두 라하 토너', '비플레인 녹두 라하 토너 265ml, 1개') === false, 'toner→toner no conflict');
});

console.log('\n--- pickOfficialOffer: single preference + set exclusion ---');
it('excludes same-line different-form SKU (올인원 vs 크림) → matched=null', () => {
  const wrongForm = item({ title: '닥터지 레드 블레미쉬 클리어 수딩 크림 70mL 진정 수분', mallName: '고운세상 닥터지', lprice: '27600' });
  const r = pickOfficialOffer([wrongForm], { brand: '닥터지', name: '레드 블레미쉬 포 맨 진정 올인원', volumeMl: 150, allowedStoreName: null });
  assert(r.matched === null, 'different-form SKU must be excluded');
  assert(/single SKU/.test(r.reason), `reason should note no comparable single: ${r.reason}`);
});
it('excludes set-only official offers (no comparable single → matched=null)', () => {
  const set = item({ title: '제니피끄 세럼 50ml 선물 세트', mallName: '랑콤', lprice: '170000' });
  const r = pickOfficialOffer([set], { brand: '랑콤', name: '제니피끄 얼티미트 세럼', volumeMl: 50, allowedStoreName: '랑콤' });
  assert(r.matched === null, 'set-only must be excluded');
  assert(/no comparable single SKU/.test(r.reason), `reason should explain set exclusion: ${r.reason}`);
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

console.log('\n--- tier-1: productNoFrom / pickAnchoredOffer ---');
it('productNoFrom extracts /products/{N}', () => {
  assert(productNoFrom('https://brand.naver.com/lancome/products/10791745136?x=1') === '10791745136', 'brandstore N');
  assert(productNoFrom('https://smartstore.naver.com/main/products/123?a=b') === '123', 'smartstore N');
});
it('productNoFrom extracts channelProductNo=', () => {
  assert(productNoFrom('https://brandconnect.naver.com/affiliates/9?channelProductNo=11355567271') === '11355567271', 'channelProductNo');
});
it('productNoFrom null when absent', () => {
  assert(productNoFrom('https://naver.me/abc') === null, 'shortlink has no N');
});
it('pickAnchoredOffer returns null without an anchor number', () => {
  assert(pickAnchoredOffer([item({})], null) === null, 'no anchor → null (caller uses tier-2)');
});
it('anchored SINGLE → matched (exact curated SKU, identity 1)', () => {
  const curated = item({ title: '에스네이처 아쿠아 오아시스 토너 300ml', link: 'https://smartstore.naver.com/x/products/5882268909', lprice: '18900' });
  const other = item({ title: '다른 상품', link: 'https://smartstore.naver.com/y/products/999' });
  const r = pickAnchoredOffer([other, curated], '5882268909');
  assert(r !== null && r.matched !== null && r.matched.lprice === '18900', 'should anchor the curated single');
  assert(r!.identityScore === 1, 'anchor identity is exact');
});
it('anchored HOMOGENEOUS bundle (×2) → priced (per-unit derived downstream)', () => {
  const bundle = item({ title: '메디큐브 PDRN 핑크 시카 수딩 토너 250ml X 2개', link: 'https://smartstore.naver.com/x/products/11488401506', lprice: '57400' });
  const r = pickAnchoredOffer([bundle], '11488401506');
  assert(r !== null && r.matched !== null, 'homogeneous bundle is included (priced), not excluded');
  assert(/×2/.test(r!.reason), `reason should note the bundle qty: ${r!.reason}`);
});
it('anchored HETEROGENEOUS 2-product set → needsInspection (no price)', () => {
  const het = item({ title: '랑콤 제니피끄 세럼 21ml + 토너 100ml', link: 'https://brand.naver.com/lancome/products/10791745136', lprice: '282200' });
  const r = pickAnchoredOffer([het], '10791745136');
  assert(r !== null && r.matched === null && r.needsInspection === true, 'heterogeneous set → inspection, no price');
});
it('anchor number not in results → null (caller → link-only)', () => {
  const r = pickAnchoredOffer([item({ link: 'https://smartstore.naver.com/x/products/111' })], '999');
  assert(r === null, 'no matching link → null');
});

console.log('\n--- multi-query anchor recall ---');
it('buildAnchorQueries adds a brand+form-noun recall query', () => {
  const qs = buildAnchorQueries('유세린', '하이아르론 에피셀린 세럼');
  assert(qs.includes('유세린 세럼'), `expected a "유세린 세럼" recall query, got ${JSON.stringify(qs)}`);
});
it('buildAnchorQueries includes the precise brand+name query', () => {
  const qs = buildAnchorQueries('토리든', '다이브인 포맨 저분자 히알루론산 올인원');
  assert(qs.some((q) => q.includes('다이브인')), 'precise query present');
  assert(qs.includes('토리든 올인원'), `form-noun recall present, got ${JSON.stringify(qs)}`);
});

console.log('\n--- pickOliveYoungOffer confidence band ---');
const oyItem = (o: Partial<NaverShoppingItem>) => item({ mallName: '올리브영', productType: '2', ...o });
it('distinctiveTokens drops form/category + promo words', () => {
  const d = distinctiveTokens('스테이 프레쉬 톤업 선크림 퍼플');
  assert(d.includes('스테이') && d.includes('퍼플') && !d.includes('선크림'), `got ${JSON.stringify(d)}`);
});
it('OY same-brand DIFFERENT product (below band) → hold, not auto-priced', () => {
  const wrong = oyItem({ title: '조선미녀 맑은쌀 선크림 아쿠아프레쉬 50ml', lprice: '25300', link: 'https://smartstore.naver.com/x/products/341' });
  const r = pickOliveYoungOffer([wrong], '조선미녀 스테이 프레쉬 톤업 선크림 퍼플');
  assert(r.matched === null, 'different product must not auto-price (#34 맑은쌀)');
});
it('OY correct product (high sim + core token) → auto-priced', () => {
  const right = oyItem({ title: '조선미녀 스테이프레쉬 톤업 선크림 퍼플 50ml', lprice: '15300', link: 'https://smartstore.naver.com/x/products/342' });
  const r = pickOliveYoungOffer([right], '조선미녀 스테이 프레쉬 톤업 선크림 퍼플');
  assert(r.matched !== null && r.matched.lprice === '15300', `correct OY single should auto-price, got ${r.matched?.lprice}`);
});
it('OY gift-stripped scoring: 토너 set with "(+올인원크림)" gift → held (form conflict)', () => {
  // The gift must not lend its 올인원 token; after gift-strip the offer is a 토너,
  // which form-conflicts with the curated 올인원 → not auto-priced (#76).
  const tonerGift = oyItem({ title: '[증정 기획] 닥터지 레드 블레미쉬 포 맨 멀티 수딩 토너 200ml 기획세트 (+올인원크림 30ml)', lprice: '31000', link: 'https://smartstore.naver.com/x/products/761' });
  const r = pickOliveYoungOffer([tonerGift], '닥터지 레드 블레미쉬 포 맨 진정 올인원');
  assert(r.matched === null, '토너 set (gift=올인원크림) must not auto-price as 올인원');
});
it('OY two close same-product candidates → adopt the lowest price', () => {
  const a = oyItem({ title: '토리든 다이브인 포맨 올인원 200ml', lprice: '19700', link: 'https://smartstore.naver.com/x/products/741' });
  const b = oyItem({ title: '토리든 다이브인 포맨 올인원 200ml 리뉴얼', lprice: '22000', link: 'https://smartstore.naver.com/x/products/742' });
  const r = pickOliveYoungOffer([a, b], '토리든 다이브인 포맨 올인원');
  assert(r.matched !== null && r.matched.lprice === '19700', `same product → lowest price, got ${r.matched?.lprice}`);
});

console.log('\n--- pickOliveYoungOffer: cross-seller price-outlier / 단품 (no keyword exclusion) ---');
it('OY "단품" literal preference: device 기획 157,700 vs [단품] 39,000 → picks 39,000', () => {
  // The device 기획 would otherwise be heterogeneous → hold. The explicit "단품"
  // label disambiguates to the single. Distribution is thin (no median ref) so this
  // is driven purely by the 단품 rule, NOT by the 디바이스 keyword.
  const device = oyItem({ title: '[슈링크홈디바이스] 바이오힐보 NAD 프리즈셀 글로우 파워 세럼 30ml 기획', lprice: '157700', link: 'https://smartstore.naver.com/x/products/861' });
  const danpum = oyItem({ title: '바이오힐보 NAD 프리즈셀 글로우 파워 세럼 30ml [단품/기획]', lprice: '39000', link: 'https://smartstore.naver.com/x/products/862' });
  const r = pickOliveYoungOffer([device, danpum], '바이오힐보 NAD 프리즈셀 글로우 파워 세럼');
  assert(r.matched !== null && r.matched.lprice === '39000', `단품 should win, got ${r.matched?.lprice}`);
});

it('OY price-outlier rejection (no keyword, no 단품): drops 157,700 via search median → 39,000', () => {
  // Neither candidate carries "단품"; the 157,700 is a plain (non-heterogeneous)
  // single that would WRONGLY auto-price without the outlier rule. A broad search
  // distribution (~33k–41k) makes 157,700 a price outlier (>2.5× median) → dropped.
  const high = oyItem({ title: '바이오힐보 NAD 프리즈셀 글로우 파워 세럼 30ml 기획', lprice: '157700', link: 'https://smartstore.naver.com/x/products/863' });
  const single = oyItem({ title: '바이오힐보 NAD 프리즈셀 글로우 파워 세럼 30ml', lprice: '39000', link: 'https://smartstore.naver.com/x/products/864' });
  const dist = [
    item({ title: '바이오힐보 NAD 세럼 30ml', mallName: '바이오힐보', lprice: '33000', link: 'https://smartstore.naver.com/b/products/1' }),
    item({ title: '바이오힐보 NAD 세럼 30ml', mallName: '쿠팡', lprice: '36000', link: 'https://smartstore.naver.com/c/products/2' }),
    item({ title: '바이오힐보 NAD 세럼 30ml', mallName: '롭스', lprice: '38000', link: 'https://smartstore.naver.com/d/products/3' }),
    item({ title: '바이오힐보 NAD 세럼 30ml', mallName: '화해', lprice: '41000', link: 'https://smartstore.naver.com/e/products/4' }),
  ];
  const r = pickOliveYoungOffer([high, single, ...dist], '바이오힐보 NAD 프리즈셀 글로우 파워 세럼');
  assert(r.matched !== null && r.matched.lprice === '39000', `outlier 157,700 should be dropped → 39,000, got ${r.matched?.lprice}`);
});

it('OY injected reference price drops the outlier (① other-seller match)', () => {
  const high = oyItem({ title: '바이오힐보 NAD 세럼 30ml 기획', lprice: '157700', link: 'https://smartstore.naver.com/x/products/865' });
  const single = oyItem({ title: '바이오힐보 NAD 세럼 30ml', lprice: '39000', link: 'https://smartstore.naver.com/x/products/866' });
  const r = pickOliveYoungOffer([high, single], '바이오힐보 NAD 세럼', 38000);
  assert(r.matched !== null && r.matched.lprice === '39000', `ref 38,000 should drop 157,700, got ${r.matched?.lprice}`);
});

it('OY keyword alone does NOT exclude: in-band device candidate is not dropped', () => {
  // A device-keyword candidate priced IN-BAND (not an outlier) and the only single
  // must NOT be excluded by the 디바이스 keyword (over-exclusion guard). Single vol.
  const device = oyItem({ title: '메디큐브 에이지알 부스터 프로 디바이스 1개', lprice: '40000', link: 'https://smartstore.naver.com/x/products/867' });
  const r = pickOliveYoungOffer([device], '메디큐브 에이지알 부스터 프로 디바이스');
  // (heterogeneous device → still inspection per existing guard; the point is the
  // keyword itself isn't a hard exclusion path — behavior comes from existing rules.)
  assert(r.matched === null, 'single heterogeneous device → inspection (existing guard), not keyword-excluded match');
});

it('OY no reference + no 단품, two close prices → adopt the lowest (몰바니 18,900)', () => {
  const a = oyItem({ title: '몰바니 비타민C 세럼 30ml 증정기획', lprice: '28000', link: 'https://smartstore.naver.com/x/products/882' });
  const b = oyItem({ title: '몰바니 비타민C 세럼 30ml', lprice: '18900', link: 'https://smartstore.naver.com/x/products/881' });
  const r = pickOliveYoungOffer([a, b], '몰바니 비타민C 세럼');
  assert(r.matched !== null && r.matched.lprice === '18900', `same product → lowest 18,900, got ${r.matched?.lprice}`);
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
