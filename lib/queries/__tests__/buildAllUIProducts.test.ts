/**
 * Fixture test for buildAllUIProducts — the pure raw-rows → UIProduct[] mapping that
 * getAllUIProducts() caches. Locks the display-seller gate, lowest-price selection,
 * 정가-대비 할인율, and link-only behaviour so the cache/Map-index refactors stay safe.
 * Run: tsx lib/queries/__tests__/buildAllUIProducts.test.ts
 */
import { buildAllUIProducts, RawData, DbSeller } from '../index';
import { Product, Listing, PublicListingPrice, Category } from '../../types';

let failed = false;
function it(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failed = true; console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`); }
}
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

// ---- fixture -------------------------------------------------------------
const sellers: DbSeller[] = [
  { id: 1, slug: 'oliveyoung', name: '올리브영', is_price_comparison_enabled: true },
  { id: 2, slug: 'coupang', name: '쿠팡', is_price_comparison_enabled: true },
  { id: 3, slug: 'naver', name: '네이버스토어', is_price_comparison_enabled: true },
  { id: 4, slug: 'zigzag', name: '지그재그', is_price_comparison_enabled: false }, // gated out
];

const categories: Category[] = [
  { id: 10, slug: 'sunscreen', name: '선크림', sort_order: 1, parent_id: null, level: 'minor' },
];

function product(over: Partial<Product> & Pick<Product, 'id' | 'slug'>): Product {
  return {
    product_key: `PROD_${over.id}`, name: 'P', brand: 'B', category_id: 10, volume_ml: 100,
    image_url: null, features: null, skin_types: ['민감성'], hwahae_url: null,
    official_info_url: null, viewty_score: 80, source: 'sheet', is_active: true,
    ...over,
  } as Product;
}
function listing(over: Partial<Listing> & Pick<Listing, 'id' | 'product_id' | 'seller_id'>): Listing {
  return {
    link_key: `L_${over.id}`, url: `/go/${over.id}`, affiliate_url: null, store_name: null,
    is_official_store: false, is_rocket: false, crawl_enabled: true, crawl_method: 'api',
    last_crawled_at: null, fail_count: 0, is_active: true, ...over,
  } as Listing;
}
function price(over: Partial<PublicListingPrice> & Pick<PublicListingPrice, 'listing_id' | 'product_id' | 'seller_id'>): PublicListingPrice {
  return {
    sale_price: null, base_unit_price: null, effective_unit_price: null, unit_price: null,
    total_ml: 100, promo_type: 'none', promo_text: null, in_stock: true, shipping_note: null,
    matched_mall_name: null, image_url: null, crawled_at: '2026-06-30T00:00:00Z', ...over,
  } as PublicListingPrice;
}

// P1: coupang(₩27,000 / ml당 270) + naver(₩28,000 / ml당 280); 정가 30,000 @ 100ml → ml당 300.
// P2: zigzag-only (non-display seller) → must be dropped.
// P3: oliveyoung listing but NO price row → link-only, still shown.
const raw: RawData = {
  dbProducts: [
    product({ id: 1, slug: 'p1', regular_price: 30000 }),
    product({ id: 2, slug: 'p2' }),
    product({ id: 3, slug: 'p3' }),
  ],
  dbListings: [
    listing({ id: 1, product_id: 1, seller_id: 2 }), // coupang
    listing({ id: 2, product_id: 1, seller_id: 3 }), // naver
    listing({ id: 3, product_id: 2, seller_id: 4 }), // zigzag (gated)
    listing({ id: 4, product_id: 3, seller_id: 1 }), // oliveyoung, no price
  ],
  dbCategories: categories,
  dbProductBadges: [],
  dbBadges: [],
  dbListingPrices: [
    price({ listing_id: 1, product_id: 1, seller_id: 2, base_unit_price: 27000, effective_unit_price: 27000, unit_price: 270, sale_price: 27000 }),
    price({ listing_id: 2, product_id: 1, seller_id: 3, base_unit_price: 28000, effective_unit_price: 28000, unit_price: 280, sale_price: 28000 }),
    // listing 3 (zigzag) intentionally has a price but the seller is gated out
    price({ listing_id: 3, product_id: 2, seller_id: 4, base_unit_price: 9900, effective_unit_price: 9900, unit_price: 99, sale_price: 9900 }),
    // listing 4 (oliveyoung) intentionally has NO price row → link-only
  ],
  dbSellers: sellers,
};

const all = buildAllUIProducts(raw);
const bySlug = (s: string) => all.find((p) => p.slug === s);

console.log('--- buildAllUIProducts ---');

it('drops a product whose only listing is a non-display seller (zigzag)', () => {
  assert(!bySlug('p2'), 'p2 (zigzag-only) must be excluded');
});

it('keeps products with a displayed-seller link (priced or link-only)', () => {
  assert(!!bySlug('p1'), 'p1 should be present');
  assert(!!bySlug('p3'), 'p3 (link-only) should be present');
  assert(all.length === 2, `expected 2 products, got ${all.length}`);
});

it('p1: lowest per-unit price = cheapest store (coupang ₩27,000), best flagged', () => {
  const p1 = bySlug('p1')!;
  assert(p1.hasAnyPrice === true, 'p1 should have a price');
  assert(p1.lowestPrice === 27000, `lowestPrice ${p1.lowestPrice} !== 27000`);
  assert(p1.stores.length === 2, `expected 2 stores, got ${p1.stores.length}`);
  const best = p1.stores.find((s) => s.isBest);
  assert(best?.sellerSlug === 'coupang', `best store ${best?.sellerSlug} !== coupang`);
});

it('p1: 정가 대비 할인율 = round((300-270)/300*100) = 10% (ml당 normalized)', () => {
  const p1 = bySlug('p1')!;
  assert(p1.discountVsRegular === 10, `discountVsRegular ${p1.discountVsRegular} !== 10`);
});

it('p3: link-only (no price row) → hasAnyPrice false but a seller row is shown', () => {
  const p3 = bySlug('p3')!;
  assert(p3.hasAnyPrice === false, 'p3 should have no price');
  assert(p3.stores.length === 1, `expected 1 link-only store, got ${p3.stores.length}`);
  assert(p3.stores[0].hasPrice === false, 'the store row should be link-only');
});

// ---- §PR-1 canonical-unit display (매/개) -------------------------------
// Builds a single coupang-priced store for one product so we can assert the
// per-store display fields (§3.3 defensive) in isolation.
function oneStore(
  prodOver: Partial<Product>,
  priceOver: Partial<PublicListingPrice>
) {
  const built = buildAllUIProducts({
    dbProducts: [product({ id: 1, slug: 'x', ...prodOver })],
    dbListings: [listing({ id: 1, product_id: 1, seller_id: 2 })], // coupang (display)
    dbCategories: categories,
    dbProductBadges: [],
    dbBadges: [],
    dbListingPrices: [price({
      listing_id: 1, product_id: 1, seller_id: 2,
      base_unit_price: 21000, effective_unit_price: 21000, sale_price: 21000,
      ...priceOver,
    })],
    dbSellers: sellers,
  });
  return built[0].stores[0];
}

console.log('--- §PR-1 canonical-unit display ---');

it('매 product: DB sheet count shown with 매 label + 매당 unit price', () => {
  const s = oneStore({ volume_unit: '매', volume_ml: 70 }, { total_ml: 70, unit_price: 300 });
  assert(s.volumeMl === 70, `volumeMl ${s.volumeMl} !== 70`);
  assert(s.volumeUnit === '매', `volumeUnit ${s.volumeUnit} !== 매`);
  assert(s.unitPrice === 300, `unitPrice ${s.unitPrice} !== 300`);
});

it('매 product: absurd leaked size (>1000) is hidden, not mislabeled', () => {
  const s = oneStore({ volume_unit: '매', volume_ml: 70 }, { total_ml: 1500, unit_price: 14 });
  assert(s.volumeMl == null, `volumeMl should be hidden, got ${s.volumeMl}`);
  assert(s.unitPrice == null, `unitPrice should be hidden, got ${s.unitPrice}`);
});

it('개 device: per-unit line hidden BUT 정가 할인율 recovered from 개당 price', () => {
  // PR-2: normalize emits unit_price=null for devices; the view must still show the
  // discount, derived from the 개당(effective) price (review #3).
  const s = oneStore(
    { volume_unit: '개', volume_ml: 1, regular_price: 500000 },
    { total_ml: 1, unit_price: null, base_unit_price: 400000, effective_unit_price: 400000, sale_price: 400000 }
  );
  assert(s.unitPrice == null, `device unitPrice should be hidden, got ${s.unitPrice}`);
  assert(s.discountVsRegular === 20, `discountVsRegular ${s.discountVsRegular} !== 20`);
});

console.log(failed ? '\nResult: FAILED' : '\nResult: ALL PASSED');
if (failed) process.exit(1);
