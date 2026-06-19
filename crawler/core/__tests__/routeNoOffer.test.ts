/**
 * routeNoOffer unit tests — a successful-but-priceless fetch (no_offer/data_error)
 * is routed to EXACTLY ONE of { inspection O/X, link_only }:
 *   - needsInspection (suspected heterogeneous set / low-confidence band) → inspection
 *   - everything else (anchor-miss, no Coupang match, data_error)        → link_only
 * The two are mutually exclusive (never written to both).
 */
import { routeNoOffer, NoOfferContext } from '../routeNoOffer';
import { PriceOffer } from '../../adapters/index';

// ---------------------------------------------------------------------------
// Tiny test runner (mirrors the other crawler tests)
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
// Fixtures
// ---------------------------------------------------------------------------
function noOffer(o: Partial<PriceOffer>): PriceOffer {
  return {
    regularPrice: null,
    salePrice: null,
    inStock: false,
    promoType: 'none',
    promoText: null,
    sourceText: null,
    matchExcluded: true,
    outcome: 'no_offer',
    ...o,
  };
}

const naverCtx: NoOfferContext = {
  sellerSlug: 'naver',
  sellerName: '네이버',
  productKey: 'lancome-genifique-serum',
  productName: '랑콤 제니피끄 얼티미트 세럼',
  brand: '랑콤',
  url: 'https://naver.me/genifique',
  affiliateUrl: null,
};

const oyCtx: NoOfferContext = {
  sellerSlug: 'oliveyoung',
  sellerName: '올리브영',
  productKey: 'vdl-coverstain-cushion',
  productName: 'VDL 커버스테인 하이커버 쿠션',
  brand: 'VDL',
  url: null,
  affiliateUrl: 'https://oy.run/vdl-cushion',
};

// ---------------------------------------------------------------------------
console.log('\n--- routeNoOffer: needsInspection → inspection ---');

it('naver id-anchored heterogeneous set → inspection (blank price), NOT link_only', () => {
  const offer = noOffer({
    needsInspection: true,
    inspectionEstimatedPrice: null,
    sourceText: 'Naver API: excluded — id-anchored to curated SKU but it is a heterogeneous 2-product set — needs inspection (no price)',
  });
  const r = routeNoOffer('no_offer', offer, naverCtx);
  assert(r.kind === 'inspection', `should route to inspection, got ${r.kind}`);
  if (r.kind === 'inspection') {
    assert(r.item.estimated_price === null, 'set price not derivable → estimated blank for operator');
    assert(r.item.product_key === 'lancome-genifique-serum', 'product_key carried');
    assert(r.item.seller === 'naver', 'seller carried');
    assert(r.item.link === 'https://naver.me/genifique', 'falls back to listing url when no matchedUrl/affiliate');
    assert(/단품이면 가격 확인 후 O/.test(r.item.reason), `reason guides operator, got "${r.item.reason}"`);
    assert(/heterogeneous/.test(r.item.reason), 'reason carries the matcher detail');
  }
});

it('OY heterogeneous set → inspection (blank price), link uses curator affiliate', () => {
  const offer = noOffer({
    needsInspection: true,
    inspectionEstimatedPrice: null,
    storeName: '올리브영',
    sourceText: 'OliveYoung: no Naver offer — 올리브영 offer is a heterogeneous set — hold/inspection (tier 3/4)',
  });
  const r = routeNoOffer('no_offer', offer, oyCtx);
  assert(r.kind === 'inspection', `should route to inspection, got ${r.kind}`);
  if (r.kind === 'inspection') {
    assert(r.item.estimated_price === null, 'set price blank');
    assert(r.item.source === '올리브영', `source from storeName, got ${r.item.source}`);
    assert(r.item.link === 'https://oy.run/vdl-cushion', 'curator affiliate url used as link');
  }
});

it('OY low-confidence band (price hint) → inspection with estimated = lprice', () => {
  const offer = noOffer({
    needsInspection: true,
    inspectionEstimatedPrice: 24200,
    storeName: '올리브영',
    sourceText: 'OliveYoung: no Naver offer — 올리브영 below auto-price band — hold/inspection (tier 3/4)',
  });
  const r = routeNoOffer('no_offer', offer, oyCtx);
  assert(r.kind === 'inspection', `should route to inspection, got ${r.kind}`);
  if (r.kind === 'inspection') {
    assert(r.item.estimated_price === 24200, `estimated should be the lprice hint, got ${r.item.estimated_price}`);
  }
});

console.log('\n--- routeNoOffer: plain no-offer / data_error → link_only (regression) ---');

it('anchor-miss + no fallback (no needsInspection) → link_only', () => {
  const offer = noOffer({
    needsInspection: false,
    sourceText: 'Naver API: excluded — anchor miss + no official-store/catalog fallback',
  });
  const r = routeNoOffer('no_offer', offer, naverCtx);
  assert(r.kind === 'link_only', `should route to link_only, got ${r.kind}`);
  if (r.kind === 'link_only') {
    assert(r.item.product_key === 'lancome-genifique-serum', 'product_key carried');
    assert(/anchor miss/.test(r.item.cause), `link_only cause from classifyLinkOnly, got "${r.item.cause}"`);
  }
});

it('needsInspection undefined → link_only (default)', () => {
  const r = routeNoOffer('no_offer', noOffer({ sourceText: 'no offer' }), naverCtx);
  assert(r.kind === 'link_only', `default should be link_only, got ${r.kind}`);
});

it('data_error is NEVER inspection even if needsInspection set → link_only', () => {
  // A bad source URL is a link_only fix, not an inspection price review.
  const offer = noOffer({ outcome: 'data_error', needsInspection: true, inspectionEstimatedPrice: 9900 });
  const r = routeNoOffer('data_error', offer, { ...naverCtx, sellerSlug: 'coupang', sellerName: '쿠팡' });
  assert(r.kind === 'link_only', `data_error must route to link_only, got ${r.kind}`);
});

// ---------------------------------------------------------------------------
console.log('\n=== routeNoOffer.test.ts Results ===');
for (const r of results) console.log(r);
if (failed) {
  console.error('\nResult: FAILED');
  process.exit(1);
} else {
  console.log('\nResult: ALL PASSED');
}
