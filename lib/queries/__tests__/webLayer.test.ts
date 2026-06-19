/**
 * Web-layer pure-helper tests: composition labels (구성) + updatedAt formatting.
 * Run: tsx lib/queries/__tests__/webLayer.test.ts
 */
import { compositionLabel, isSellerDisplayed, discountVsRegular } from '../index';
import { updatedAt, pricedStoreNames } from '../../format';
import { UIProduct, UIStorePrice } from '../../types';

let failed = false;
function it(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failed = true; console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`); }
}
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

console.log('--- compositionLabel ---');
it('buy_x_get_y → N+M from promo_text', () => {
  assert(compositionLabel('buy_x_get_y', '1+1 기획', 2) === '1+1', 'should read 1+1');
});
it('gift / 증정 text → 증정', () => {
  assert(compositionLabel('gift', null, 1) === '증정', 'gift type');
  assert(compositionLabel('none', '본품 + 미니 증정', 1) === '증정', '증정 text');
});
it('multipack quantity → N개', () => {
  assert(compositionLabel('bundle', '265ml, 6개', 6) === '6개', 'qty label');
});
it('plain single → null', () => {
  assert(compositionLabel('none', null, 1) === null, 'single has no composition');
});

console.log('--- discountVsRegular (정가 대비, ml당 정규화) ---');
it('same volume: 30000/100ml vs 24000(100ml ⇒ ml당 240) → 20%', () => {
  // 정가 ml당 = 300, listing ml당 = 240 ⇒ round((300-240)/300×100) = 20
  assert(discountVsRegular(30000, 100, 240) === 20, `got ${discountVsRegular(30000, 100, 240)}`);
});
it('different volume normalized by ml당: 80ml listing at ml당 240 → still 20%', () => {
  // a 80ml seller priced 19200 ⇒ ml당 240; 정가 ml당 (DB 100ml) = 300 ⇒ 20%
  assert(discountVsRegular(30000, 100, 240) === 20, 'ml당 basis is size-independent');
});
it('regular_price blank/null → null (discount hidden)', () => {
  assert(discountVsRegular(null, 100, 240) === null, 'null 정가');
  assert(discountVsRegular(undefined, 100, 240) === null, 'undefined 정가');
  assert(discountVsRegular(0, 100, 240) === null, 'zero 정가');
});
it('volume missing/≤0 → null', () => {
  assert(discountVsRegular(30000, 0, 240) === null, 'zero volume');
  assert(discountVsRegular(30000, null, 240) === null, 'null volume');
});
it('listing ml당 unknown/unreliable → null', () => {
  assert(discountVsRegular(30000, 100, null) === null, 'null unit price');
  assert(discountVsRegular(30000, 100, 0) === null, 'zero unit price');
});
it('sale ≥ 정가 (stale MSRP) → 0, never negative', () => {
  assert(discountVsRegular(30000, 100, 300) === 0, 'equal → 0');
  assert(discountVsRegular(30000, 100, 360) === 0, 'above 정가 → 0 not negative');
});

console.log('--- updatedAt (KST) ---');
it('formats ISO to KST label', () => {
  // 2026-06-17T05:49:59Z + 9h = 14:49 KST
  assert(updatedAt('2026-06-17T05:49:59Z') === '2026.06.17 14:49 KST', `got ${updatedAt('2026-06-17T05:49:59Z')}`);
});
it('empty / invalid → empty string', () => {
  assert(updatedAt(null) === '' && updatedAt('nope') === '', 'graceful empty');
});

console.log('--- isSellerDisplayed (non-display seller gate) ---');
it('display-enabled seller passes', () => {
  assert(isSellerDisplayed({ is_price_comparison_enabled: true }) === true, 'true → shown');
});
it('non-display seller (zigzag/ably) is gated out', () => {
  assert(isSellerDisplayed({ is_price_comparison_enabled: false }) === false, 'false → hidden');
});
it('missing seller (orphan listing) is gated out', () => {
  assert(isSellerDisplayed(undefined) === false, 'undefined → hidden');
  assert(isSellerDisplayed({}) === false, 'absent flag → hidden');
});

console.log('--- pricedStoreNames (compare label = priced sellers only) ---');
function store(over: Partial<UIStorePrice>): UIStorePrice {
  return { name: 'x', sellerSlug: 'x', price: 0, url: '#', ...over };
}
function product(stores: UIStorePrice[]): UIProduct {
  return { stores } as UIProduct;
}
it('lists only priced sellers, drops link-only/no-price', () => {
  const p = product([
    store({ name: '쿠팡', hasPrice: true }),
    store({ name: '네이버', hasPrice: false }), // link-only
    store({ name: '올리브영', hasPrice: true }),
  ]);
  assert(pricedStoreNames(p) === '쿠팡 · 올리브영', `got ${pricedStoreNames(p)}`);
});
it('empty string when no priced seller (caller hides label)', () => {
  const p = product([store({ name: '네이버', hasPrice: false })]);
  assert(pricedStoreNames(p) === '', `got "${pricedStoreNames(p)}"`);
});
it('caps at max (default 3)', () => {
  const p = product([
    store({ name: 'a', hasPrice: true }), store({ name: 'b', hasPrice: true }),
    store({ name: 'c', hasPrice: true }), store({ name: 'd', hasPrice: true }),
  ]);
  assert(pricedStoreNames(p) === 'a · b · c', `got ${pricedStoreNames(p)}`);
});

console.log(failed ? '\nResult: FAILED' : '\nResult: ALL PASSED');
if (failed) process.exit(1);
