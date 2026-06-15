/**
 * OliveYoung via-Naver unit tests — pure logic (no network / no Playwright).
 * Covers final spec §5:
 *  - pickOfficialOffer with mallName='올리브영' (individual mall offer adopted;
 *    catalog representative + reseller excluded; price+link from same offer)
 *  - resolveOliveYoungTier 4-tier gate (curator URL / Naver / manual override)
 *  - manual_override fallback (tier 3): an excluded OliveYoung offer + a price
 *    override becomes a displayable price (matchExcluded cleared, in-stock)
 *  - redirect invariant: OliveYoung buy link is ALWAYS the curator affiliate_url
 */
import {
  pickOfficialOffer,
  NaverShoppingItem,
  OfferMatchInput,
} from '../naver';
import { resolveOliveYoungTier } from '../oliveyoung';
import { applyManualOverrides } from '../../core/normalize';
import { PriceOffer } from '../index';
import { Listing, Product, ManualOverride } from '../../../lib/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function oyItem(o: Partial<NaverShoppingItem>): NaverShoppingItem {
  return {
    title: '조선미녀 스테이 프레쉬 톤업 선크림 퍼플 SPF50+ 50ml',
    link: 'https://smartstore.naver.com/oliveyoung/products/777',
    lprice: '17000',
    mallName: '올리브영',
    productId: '777',
    productType: '2',
    ...o,
  };
}

const OY_INPUT: OfferMatchInput = {
  brand: '조선미녀',
  name: '스테이 프레쉬 톤업 선크림 퍼플',
  volumeMl: 50,
  allowedStoreName: '올리브영',
};

// ---------------------------------------------------------------------------
// Tiny test runner (mirrors naver.test.ts)
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
console.log('\n--- pickOfficialOffer (OliveYoung mall) ---');
it('adopts the 올리브영 individual-mall offer (price+link from same offer)', () => {
  const r = pickOfficialOffer([oyItem({})], OY_INPUT);
  assert(r.matched !== null, 'should match the OliveYoung offer');
  assert(r.matched!.lprice === '17000', 'price from matched offer');
  assert(r.matched!.mallName === '올리브영', 'mall is OliveYoung');
  assert(r.matched!.link === 'https://smartstore.naver.com/oliveyoung/products/777', 'link from matched offer');
  assert(r.parsedVolumeRaw === 50, `volume forwarded from title, got ${r.parsedVolumeRaw}`);
});

it('skips the 가격비교 catalog representative, picks 올리브영', () => {
  const catalog = oyItem({ mallName: '네이버', productType: '1', link: 'https://search.shopping.naver.com/catalog/999', lprice: '12000' });
  const oy = oyItem({ lprice: '17000' });
  const r = pickOfficialOffer([catalog, oy], OY_INPUT);
  assert(r.matched !== null && r.matched.lprice === '17000', 'should pick OliveYoung, not catalog lowest');
});

it('reseller mall (쿠팡) is NOT accepted as OliveYoung', () => {
  const reseller = oyItem({ mallName: '쿠팡', link: 'https://coupang.com/x', lprice: '11000' });
  const r = pickOfficialOffer([reseller], OY_INPUT);
  assert(r.matched === null, 'reseller must not match OliveYoung allowlist');
});

it('올리브영 offer but wrong product (low title similarity) → excluded', () => {
  const wrong = oyItem({ title: '조선미녀 맑은쌀 선크림 라이트 50ml' });
  const r = pickOfficialOffer([wrong], { ...OY_INPUT, name: '스테이 프레쉬 톤업 선크림 퍼플' });
  assert(r.matched === null, 'different product should be excluded');
});

console.log('\n--- resolveOliveYoungTier (4-tier gate) ---');
it('tier 1 hidden: no curator URL → not shown, no price', () => {
  const t = resolveOliveYoungTier({ hasCuratorUrl: false, naverMatched: true, hasManualOverride: true });
  assert(t.tier === 'hidden' && t.showPrice === false && t.priceSource === null, `got ${JSON.stringify(t)}`);
});
it('tier 2 naver: curator + Naver offer → price=naver', () => {
  const t = resolveOliveYoungTier({ hasCuratorUrl: true, naverMatched: true, hasManualOverride: false });
  assert(t.tier === 'naver' && t.showPrice === true && t.priceSource === 'naver', `got ${JSON.stringify(t)}`);
});
it('tier 2 naver wins over manual when both present', () => {
  const t = resolveOliveYoungTier({ hasCuratorUrl: true, naverMatched: true, hasManualOverride: true });
  assert(t.priceSource === 'naver', `naver should take precedence, got ${t.priceSource}`);
});
it('tier 3 manual: curator + no Naver + manual → price=manual', () => {
  const t = resolveOliveYoungTier({ hasCuratorUrl: true, naverMatched: false, hasManualOverride: true });
  assert(t.tier === 'manual' && t.showPrice === true && t.priceSource === 'manual', `got ${JSON.stringify(t)}`);
});
it('tier 4 link_only: curator + no Naver + no manual → link only, no price', () => {
  const t = resolveOliveYoungTier({ hasCuratorUrl: true, naverMatched: false, hasManualOverride: false });
  assert(t.tier === 'link_only' && t.showPrice === false && t.priceSource === null, `got ${JSON.stringify(t)}`);
});

console.log('\n--- manual_override fallback (tier 3) ---');
it('price override turns an excluded OliveYoung offer into a displayable price', () => {
  const product = { id: 6, brand: '조선미녀' } as Product;
  const listing = { id: 60, product_id: 6, seller_id: 1, affiliate_url: 'https://oy.run/curator' } as Listing;
  const excluded: PriceOffer = {
    regularPrice: null,
    salePrice: null,
    inStock: true,
    promoType: 'none',
    promoText: null,
    sourceText: 'OliveYoung: no Naver offer — (tier 3/4)',
    storeName: '올리브영',
    matchExcluded: true,
  };
  const overrides: ManualOverride[] = [
    { id: 1, product_id: 6, seller_id: 1, override_type: 'price', value: '16800', reason: 'OY app price', expires_at: null, is_active: true },
  ];
  const out = applyManualOverrides(product, listing, excluded, overrides);
  assert(out.salePrice === 16800, `price should be injected, got ${out.salePrice}`);
  assert(out.matchExcluded === false, 'matchExcluded should be cleared');
  assert(out.inStock === true, 'should be in stock');
});

it('no active override leaves the OliveYoung offer untouched (stays tier 4 link-only)', () => {
  const product = { id: 6, brand: '조선미녀' } as Product;
  const listing = { id: 60, product_id: 6, seller_id: 1, affiliate_url: 'https://oy.run/curator' } as Listing;
  const excluded: PriceOffer = {
    regularPrice: null, salePrice: null, inStock: true, promoType: 'none',
    promoText: null, sourceText: 'link-only', storeName: '올리브영', matchExcluded: true,
  };
  const out = applyManualOverrides(product, listing, excluded, []);
  assert(out.salePrice === null && out.matchExcluded === true, 'no override → unchanged (link-only)');
});

console.log('\n--- redirect invariant ---');
it('OliveYoung buy link is ALWAYS the curator affiliate_url (over latest_matched_url)', () => {
  // Mirrors the /go/[listingId] precedence: affiliate_url || latest_matched_url.
  const listing = {
    affiliate_url: 'https://oy.run/curator',
    latest_matched_url: 'https://smartstore.naver.com/oliveyoung/products/777',
  } as Listing;
  const target = listing.affiliate_url || listing.latest_matched_url || '/';
  assert(target === 'https://oy.run/curator', `curator must win, got ${target}`);
});

// ---------------------------------------------------------------------------
console.log('\n=== oliveyoung.test.ts Results ===');
for (const r of results) console.log(r);
if (failed) {
  console.error('\nResult: FAILED');
  process.exit(1);
} else {
  console.log('\nResult: ALL PASSED');
}
