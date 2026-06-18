/**
 * snapshotsToPublicPrices — §2.4 trust-first parity with the SQL view
 * (listing_prices_public, migrations 0008 + 0010). A listing surfaces ONLY when
 * its LATEST snapshot is displayable; a priced→no_offer transition must drop the
 * listing instead of resurrecting the stale ok price behind the no_offer.
 */
import { snapshotsToPublicPrices, resolveDisplayImage } from '../index';
import { Listing, PriceSnapshot } from '../../types';

// ---------------------------------------------------------------------------
function listing(over: Partial<Listing> = {}): Listing {
  return {
    id: 1, link_key: 'l1', product_id: 1, seller_id: 2, url: 'u', affiliate_url: null,
    store_name: 's', is_official_store: false, is_rocket: false, crawl_enabled: true,
    crawl_method: 'api', last_crawled_at: null, fail_count: 0, is_active: true, ...over,
  };
}
function snap(over: Partial<PriceSnapshot> = {}): PriceSnapshot {
  return {
    id: 1, listing_id: 1, product_id: 1, crawled_at: '2026-06-01T00:00:00Z',
    regular_price: null, sale_price: 10000, base_unit_price: 10000, promo_type: 'none',
    promo_text: null, min_quantity: 1, paid_quantity: 1, free_quantity: 0, total_quantity: 1,
    total_ml: 50, unit_price: 200, unit_price_reliable: true, effective_unit_price: 10000,
    in_stock: true, source_text: null, parse_confidence: 'high', status: 'ok',
    shipping_fee: null, shipping_note: null, matched_url: null, matched_mall_name: null, image_url: null, ...over,
  };
}

let failed = false;
function it(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { failed = true; console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : String(e)}`); }
}
function expect<T>(a: T) {
  return { toBe(b: T) { if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); } };
}

console.log('\n--- snapshotsToPublicPrices §2.4 ---');

it('latest ok → listing shown with the ok price', () => {
  const out = snapshotsToPublicPrices([snap({ id: 1, crawled_at: '2026-06-01T00:00:00Z' })], [listing()]);
  expect(out.length).toBe(1);
  expect(out[0].sale_price).toBe(10000);
});

it('priced→no_offer transition (newer no_offer) → listing DROPS (no stale price)', () => {
  const snaps = [
    snap({ id: 1, crawled_at: '2026-06-01T00:00:00Z', status: 'ok', sale_price: 10000 }),
    snap({ id: 2, crawled_at: '2026-06-02T00:00:00Z', status: 'no_offer', sale_price: null, base_unit_price: null, in_stock: false }),
  ];
  const out = snapshotsToPublicPrices(snaps, [listing()]);
  expect(out.length).toBe(0);
});

it('no_offer→priced recovery (newer ok) → listing shown again', () => {
  const snaps = [
    snap({ id: 1, crawled_at: '2026-06-01T00:00:00Z', status: 'no_offer', sale_price: null }),
    snap({ id: 2, crawled_at: '2026-06-02T00:00:00Z', status: 'ok', sale_price: 12000, base_unit_price: 12000 }),
  ];
  const out = snapshotsToPublicPrices(snaps, [listing()]);
  expect(out.length).toBe(1);
  expect(out[0].sale_price).toBe(12000);
});

it('latest failed → listing drops even with an older ok', () => {
  const snaps = [
    snap({ id: 1, crawled_at: '2026-06-01T00:00:00Z', status: 'ok' }),
    snap({ id: 2, crawled_at: '2026-06-02T00:00:00Z', status: 'failed', sale_price: null }),
  ];
  expect(snapshotsToPublicPrices(snaps, [listing()]).length).toBe(0);
});

it('inactive listing → never shown', () => {
  expect(snapshotsToPublicPrices([snap()], [listing({ is_active: false })]).length).toBe(0);
});

it('image_url passes through snapshotsToPublicPrices', () => {
  const out = snapshotsToPublicPrices([snap({ image_url: 'https://ads-partners.coupang.com/x.jpg' })], [listing()]);
  expect(out.length).toBe(1);
  expect(out[0].image_url).toBe('https://ads-partners.coupang.com/x.jpg');
});

// ---------------------------------------------------------------------------
console.log('\n--- resolveDisplayImage precedence (operator → coupang listing image → placeholder) ---');

// Image is read from the LISTING row's latest_image_url (status-independent), not
// the ok-only price view — a warning/inspection-held Coupang price still shows its image.
const sellers = [{ id: 2, slug: 'naver' }, { id: 3, slug: 'coupang' }];
function clisting(over: Partial<Listing> = {}): Listing {
  return listing({ seller_id: 3, latest_image_url: 'https://ads-partners.coupang.com/c.jpg', ...over });
}

it('operator image wins over coupang', () => {
  const img = resolveDisplayImage('https://op/img.jpg', 1, [clisting()], sellers);
  expect(img).toBe('https://op/img.jpg');
});

it('coupang listing image used when operator image is empty', () => {
  const img = resolveDisplayImage('', 1, [clisting()], sellers);
  expect(img).toBe('https://ads-partners.coupang.com/c.jpg');
});

it('coupang listing image shows even when its price is warning/inspection (decoupled from price status)', () => {
  // No price view involved: resolveDisplayImage reads latest_image_url straight off
  // the listing row, so a held (non-ok) price never hides the image.
  const img = resolveDisplayImage(null, 1, [clisting()], sellers);
  expect(img).toBe('https://ads-partners.coupang.com/c.jpg');
});

it('non-coupang listing image is NOT used as fallback', () => {
  const img = resolveDisplayImage(null, 1, [clisting({ seller_id: 2, latest_image_url: 'https://naver/x.jpg' })], sellers);
  expect(img).toBe('');
});

it('inactive coupang listing image is NOT used', () => {
  const img = resolveDisplayImage(null, 1, [clisting({ is_active: false })], sellers);
  expect(img).toBe('');
});

it('placeholder ("") when no operator and no coupang listing image', () => {
  const img = resolveDisplayImage(null, 1, [clisting({ latest_image_url: null })], sellers);
  expect(img).toBe('');
});

console.log('\n=== publicPrices.test.ts Results ===');
if (failed) { console.error('Result: FAILED'); process.exit(1); }
else { console.log('Result: ALL PASSED'); }
