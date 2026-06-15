/**
 * Sheet import dedup + idempotency tests — covers:
 *  - duplicate product_key detection (same key from two distinct names)
 *  - duplicate link_key detection (same seller+product in two rows)
 *  - duplicate url detection (one url reused across listings)
 *  - clean sheet → no duplicates
 *  - idempotency: expanding the same sheet twice yields identical listings
 *  - orphan reconcile: DB keys absent from sheet are flagged for deactivation
 */
import {
  detectSheetDuplicates,
  hasDuplicates,
  buildNameToKey,
  expandListings,
  computeOrphanKeys,
  makeProductKey,
  normalizeListingUrl,
} from '../validate';

// ---------------------------------------------------------------------------
// Test runner (no external framework — matches crawler/core/__tests__ style)
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

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
type Row = Record<string, string>;
const cleanProducts: Row[] = [
  { name: 'Sun Serum', brand: 'BrandA', category: 'sunscreen', volume_ml: '50' },
  { name: 'Night Cream', brand: 'BrandB', category: 'moisturizer', volume_ml: '50' },
];
const cleanLinks: Row[] = [
  { product_name: 'Sun Serum',  naver: 'https://brand.naver.com/a/1', oliveyoung: 'https://oliveyoung.co.kr/a' },
  { product_name: 'Night Cream', naver: 'https://brand.naver.com/b/2' },
];

// ---------------------------------------------------------------------------
console.log('\n--- duplicate detection ---');

it('clean sheet → no duplicates', () => {
  const r = detectSheetDuplicates(cleanProducts, cleanLinks);
  assert(!hasDuplicates(r), `expected no duplicates, got ${JSON.stringify(r)}`);
});

it('duplicate product_key (same brand|name twice) is detected', () => {
  const products = [...cleanProducts, { name: 'Sun Serum', brand: 'BrandA', category: 'sunscreen', volume_ml: '50' }];
  const r = detectSheetDuplicates(products, cleanLinks);
  assert(hasDuplicates(r), 'expected duplicates');
  assert(r.duplicateProductKeys.length === 1, `expected 1 dup product_key, got ${r.duplicateProductKeys.length}`);
});

it('explicit product_key shared by two distinct names is detected', () => {
  const products = [
    { product_key: 'shared-1', name: 'Sun Serum',  brand: 'BrandA', category: 'sunscreen', volume_ml: '50' },
    { product_key: 'shared-1', name: 'Other Serum', brand: 'BrandA', category: 'sunscreen', volume_ml: '50' },
  ];
  const r = detectSheetDuplicates(products, []);
  assert(r.duplicateProductKeys.length === 1, 'expected 1 dup product_key');
  assert(r.duplicateProductKeys[0].names.length === 2, 'expected 2 names on the shared key');
});

it('duplicate url across two products is detected', () => {
  const links: Row[] = [
    { product_name: 'Sun Serum',  naver: 'https://brand.naver.com/SAME' },
    { product_name: 'Night Cream', naver: 'https://brand.naver.com/SAME' },
  ];
  const r = detectSheetDuplicates(cleanProducts, links);
  assert(r.duplicateUrls.length === 1, `expected 1 dup url, got ${r.duplicateUrls.length}`);
  assert(r.duplicateUrls[0].link_keys.length === 2, 'expected url shared by 2 link_keys');
});

it('duplicate link_key (same product listed twice for same seller) is detected', () => {
  // two product_links rows for the same product, both with naver → same link_key
  const links: Row[] = [
    { product_name: 'Sun Serum', naver: 'https://brand.naver.com/a/1' },
    { product_name: 'Sun Serum', naver: 'https://brand.naver.com/a/2' },
  ];
  const r = detectSheetDuplicates(cleanProducts, links);
  assert(r.duplicateLinkKeys.length === 1, `expected 1 dup link_key, got ${r.duplicateLinkKeys.length}`);
});

// ---------------------------------------------------------------------------
console.log('\n--- url normalization / placeholder skip ---');

it('placeholder "?" cell is skipped (no listing) and never duplicates', () => {
  const links: Row[] = [
    { product_name: 'Sun Serum',  coupang: '?' },
    { product_name: 'Night Cream', coupang: '?' },
  ];
  const nameToKey = buildNameToKey(cleanProducts);
  const flat = expandListings(links, nameToKey);
  assert(flat.length === 0, `expected "?" cells skipped, got ${flat.length} listings`);
  const r = detectSheetDuplicates(cleanProducts, links);
  assert(!hasDuplicates(r), `placeholder must not count as duplicate url: ${JSON.stringify(r)}`);
});

it('scheme-less host url is upgraded to https', () => {
  const links: Row[] = [
    { product_name: 'Sun Serum', coupang: 'coupang.com/vp/products/7941544246?q=x' },
  ];
  const nameToKey = buildNameToKey(cleanProducts);
  const flat = expandListings(links, nameToKey);
  assert(flat.length === 1, `expected 1 listing, got ${flat.length}`);
  assert(flat[0].url === 'https://coupang.com/vp/products/7941544246?q=x', `unexpected url: ${flat[0].url}`);
});

it('normalizeListingUrl: https passthrough, placeholder→null, blank→null', () => {
  assert(normalizeListingUrl('https://www.coupang.com/vp/products/1') === 'https://www.coupang.com/vp/products/1', 'https should pass through');
  assert(normalizeListingUrl('?') === null, '"?" should be null');
  assert(normalizeListingUrl('  ') === null, 'blank should be null');
  assert(normalizeListingUrl('TODO') === null, 'non-url text should be null');
});

// ---------------------------------------------------------------------------
console.log('\n--- idempotency ---');

it('expandListings is deterministic across two runs (re-import stable)', () => {
  const nameToKey = buildNameToKey(cleanProducts);
  const a = expandListings(cleanLinks, nameToKey);
  const b = expandListings(cleanLinks, nameToKey);
  assert(JSON.stringify(a) === JSON.stringify(b), 'expected identical expansion');
  // Sun Serum has naver+oliveyoung (2), Night Cream has naver (1) = 3 listings
  assert(a.length === 3, `expected 3 listings, got ${a.length}`);
});

it('link_key is stable for a given seller+product (idempotent upsert target)', () => {
  const nameToKey = buildNameToKey(cleanProducts);
  const flat = expandListings(cleanLinks, nameToKey);
  const sunKey = makeProductKey('BrandA', 'Sun Serum');
  const naverListing = flat.find((l) => l.seller === 'naver' && l.product_key === sunKey);
  assert(naverListing?.link_key === `naver_${sunKey}`, `unexpected link_key: ${naverListing?.link_key}`);
});

// ---------------------------------------------------------------------------
console.log('\n--- orphan reconcile ---');

it('DB keys absent from sheet are flagged as orphans', () => {
  const sheetKeys = new Set(['naver_p1', 'oliveyoung_p1']);
  const dbKeys = ['naver_p1', 'oliveyoung_p1', 'coupang_p_stale', 'naver_p_old'];
  const orphans = computeOrphanKeys(dbKeys, sheetKeys);
  assert(orphans.length === 2, `expected 2 orphans, got ${orphans.length}`);
  assert(orphans.includes('coupang_p_stale') && orphans.includes('naver_p_old'), 'wrong orphans');
});

it('no orphans when DB matches sheet exactly', () => {
  const sheetKeys = new Set(['naver_p1', 'oliveyoung_p1']);
  const orphans = computeOrphanKeys([...sheetKeys], sheetKeys);
  assert(orphans.length === 0, `expected 0 orphans, got ${orphans.length}`);
});

// ---------------------------------------------------------------------------
console.log('\n=== dedup.test.ts Results ===');
for (const r of results) console.log(r);
if (failed) {
  console.error('\nResult: FAILED');
  process.exit(1);
} else {
  console.log('\nResult: ALL PASSED');
}
