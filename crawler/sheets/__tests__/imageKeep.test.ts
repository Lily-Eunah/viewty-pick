/**
 * resolveImageUrl — keep-last-good product image when a Coupang product-page URL
 * fails to resolve (transient, e.g. rate limit). Regression guard for the incident
 * where two imports per workflow run exhausted the Coupang 50/min limit, every image
 * resolved to '', and the import blanked the whole catalog's images.
 *
 * Pure logic, no network. `resolved` mirrors resolveProductImages' output:
 *   direct URL → itself, Coupang resolved → image, Coupang unresolved → ''.
 */
import { resolveImageUrl } from '../import';

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

// Must mirror import.ts imageResolveKey exactly.
const key = (raw: string, brand: string | null, name: string) =>
  `${raw}|${(brand ?? '').trim()}|${(name ?? '').trim()}`;

const COUPANG = 'https://www.coupang.com/vp/products/123456';
const JPG = 'https://cdn.example.com/photo.jpg';
const PREV = 'https://ads-partners.coupang.com/image/last-good.jpg';
const BRAND = '브랜드';
const NAME = '제품A';

console.log('\n--- resolveImageUrl: keep last-good on Coupang resolution failure ---');

it('Coupang URL unresolved + previous image → keeps previous', () => {
  const resolved = new Map([[key(COUPANG, BRAND, NAME), '']]); // '' = unresolved
  const r = resolveImageUrl(COUPANG, BRAND, NAME, resolved, PREV);
  assert(r.image === PREV, `expected previous kept, got ${r.image}`);
  assert(r.keptPrevious === true, 'keptPrevious flag set');
});

it('Coupang URL resolved → uses the freshly resolved image', () => {
  const fresh = 'https://ads-partners.coupang.com/image/fresh.jpg';
  const resolved = new Map([[key(COUPANG, BRAND, NAME), fresh]]);
  const r = resolveImageUrl(COUPANG, BRAND, NAME, resolved, PREV);
  assert(r.image === fresh, `expected fresh image, got ${r.image}`);
  assert(r.keptPrevious === false, 'not kept-previous when resolved');
});

it('empty sheet cell → null even when a previous image exists (operator cleared)', () => {
  const r = resolveImageUrl('', BRAND, NAME, new Map(), PREV);
  assert(r.image === null, `expected null, got ${r.image}`);
  assert(r.keptPrevious === false, 'clearing is intentional, not kept-previous');
});

it('direct .jpg URL → passes through unchanged', () => {
  const resolved = new Map([[key(JPG, BRAND, NAME), JPG]]);
  const r = resolveImageUrl(JPG, BRAND, NAME, resolved, PREV);
  assert(r.image === JPG, `expected pass-through, got ${r.image}`);
  assert(r.keptPrevious === false, 'direct URL is not kept-previous');
});

it('Coupang URL unresolved + NO previous image → null (nothing to keep)', () => {
  const resolved = new Map([[key(COUPANG, BRAND, NAME), '']]);
  const r = resolveImageUrl(COUPANG, BRAND, NAME, resolved, null);
  assert(r.image === null, `expected null, got ${r.image}`);
  assert(r.keptPrevious === false, 'no previous → not kept');
});

it('Coupang URL unresolved + whitespace-only previous → null', () => {
  const resolved = new Map([[key(COUPANG, BRAND, NAME), '']]);
  const r = resolveImageUrl(COUPANG, BRAND, NAME, resolved, '   ');
  assert(r.image === null, `expected null for blank previous, got ${r.image}`);
});

it('REGRESSION: whole-catalog resolution failure preserves every image', () => {
  // Simulate the incident: rate limit → resolveProductImages returns '' for ALL
  // Coupang URLs. With last-good fallback, no product loses its image.
  const products = [
    { url: COUPANG, brand: '브랜드1', name: '제품1', prev: 'https://img/p1.jpg' },
    { url: 'https://www.coupang.com/vp/products/222', brand: '브랜드2', name: '제품2', prev: 'https://img/p2.jpg' },
    { url: 'https://www.coupang.com/vp/products/333', brand: '브랜드3', name: '제품3', prev: 'https://img/p3.jpg' },
  ];
  const resolved = new Map(products.map((p) => [key(p.url, p.brand, p.name), '']));
  let kept = 0;
  for (const p of products) {
    const r = resolveImageUrl(p.url, p.brand, p.name, resolved, p.prev);
    assert(r.image === p.prev, `${p.name}: expected ${p.prev}, got ${r.image}`);
    if (r.keptPrevious) kept++;
  }
  assert(kept === 3, `expected all 3 images kept, got ${kept}`);
});

console.log('\n=== imageKeep.test.ts Results ===');
for (const r of results) console.log(r);
if (failed) {
  console.error('\nResult: FAILED');
  process.exit(1);
} else {
  console.log('\nResult: ALL PASSED');
}
