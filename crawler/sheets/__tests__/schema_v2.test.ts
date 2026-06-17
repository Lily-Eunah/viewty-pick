/**
 * Sheet schema v2 import tests:
 *  - _categories single source → deduped majors + minors (parent linkage)
 *  - wide per-source badges: source auto-discovery, multi-source, empty-skip
 *  - optional slug → product_key fallback
 *  - product_key freeze plan (blank → generated, existing untouched)
 *  - name-join survives a rename when the key is frozen
 *  - duplicate product_name / slug detection (name-join ambiguity, routing clash)
 * Run: tsx crawler/sheets/__tests__/schema_v2.test.ts
 */
import {
  parseCategoriesRef,
  discoverBadgeSources,
  expandBadges,
  resolveDisplaySlug,
  planKeyFreeze,
  buildNameToKey,
  makeProductKey,
  detectSheetDuplicates,
  hasDuplicates,
} from '../validate';

let failed = false;
function it(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failed = true; console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`); }
}
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

type Row = Record<string, string>;

// ---------------------------------------------------------------------------
console.log('\n--- _categories single source ---');

const catRows: Row[] = [
  { 대분류: '선케어',   대분류_slug: 'suncare',  소분류: '선크림', 소분류_slug: 'sunscreen', sort_order: '1' },
  { 대분류: '선케어',   대분류_slug: 'suncare',  소분류: '선스틱', 소분류_slug: 'sunstick',  sort_order: '2' },
  { 대분류: '스킨케어', 대분류_slug: 'skincare', 소분류: '크림',  소분류_slug: 'cream',     sort_order: '5' },
];

it('majors deduped, minors carry parent major slug + sort_order', () => {
  const { majors, minors, errors } = parseCategoriesRef(catRows);
  assert(errors.length === 0, `unexpected errors: ${errors.join(';')}`);
  assert(majors.length === 2, `expected 2 majors, got ${majors.length}`);
  assert(majors.find((m) => m.slug === 'suncare')?.name === '선케어', 'suncare name');
  assert(minors.length === 3, `expected 3 minors, got ${minors.length}`);
  const cream = minors.find((m) => m.slug === 'cream');
  assert(cream?.major_slug === 'skincare' && cream?.sort_order === 5, `cream parent/sort wrong: ${JSON.stringify(cream)}`);
});

it('invalid row (missing 소분류_slug) is reported, not thrown', () => {
  const { minors, errors } = parseCategoriesRef([{ 대분류: 'X', 대분류_slug: 'x', 소분류: 'Y', 소분류_slug: '', sort_order: '1' }]);
  assert(minors.length === 0 && errors.length === 1, `expected 1 error, 0 minors: ${JSON.stringify({ minors, errors })}`);
});

// ---------------------------------------------------------------------------
console.log('\n--- wide per-source badges ---');

const n2k = buildNameToKey([
  { name: 'Sun A', brand: 'B1', category: 'sunscreen', volume_ml: '50' },
  { name: 'Sun B', brand: 'B2', category: 'sunscreen', volume_ml: '50' },
]);

it('discovers sources from the _detail header suffix', () => {
  const sources = discoverBadgeSources([
    { product_name: 'Sun A', directorpi_detail: 'x', directorpi_source: 's', hwahae_detail: '', hwahae_source: '' },
  ]);
  assert(sources.includes('directorpi') && sources.includes('hwahae'), `got ${sources.join(',')}`);
});

it('a NEW source column is picked up with no code change (hwahae)', () => {
  const { flat } = expandBadges([
    { product_name: 'Sun A', directorpi_detail: 'dp', hwahae_detail: 'hh', hwahae_source: '화해' },
  ], n2k);
  const types = flat.map((b) => b.badge_type).sort();
  assert(types.length === 2 && types[0] === 'directorpi' && types[1] === 'hwahae', `multi-source failed: ${JSON.stringify(types)}`);
});

it('empty source group emits nothing; filled one emits a badge', () => {
  const { flat } = expandBadges([
    { product_name: 'Sun A', directorpi_detail: 'dp', hwahae_detail: '', hwahae_source: '', hwahae_ref_url: '' },
  ], n2k);
  assert(flat.length === 1 && flat[0].badge_type === 'directorpi', `expected only directorpi, got ${JSON.stringify(flat)}`);
});

it('invalid ref_url / date are dropped to null (one bad cell never blocks)', () => {
  const { flat } = expandBadges([
    { product_name: 'Sun A', directorpi_detail: 'dp', directorpi_ref_url: 'not-a-url', directorpi_date: '2026/06/12' },
  ], n2k);
  assert(flat[0].ref_url === null && flat[0].source_date === null, `expected nulls, got ${JSON.stringify(flat[0])}`);
});

it('valid ref_url + date pass through', () => {
  const { flat } = expandBadges([
    { product_name: 'Sun A', directorpi_detail: 'dp', directorpi_ref_url: 'https://x.io/a', directorpi_date: '2026-06-12' },
  ], n2k);
  assert(flat[0].ref_url === 'https://x.io/a' && flat[0].source_date === '2026-06-12', `passthrough failed: ${JSON.stringify(flat[0])}`);
});

it('badge row with data but unresolved product → reported as skipped', () => {
  const { flat, skipped } = expandBadges([
    { product_name: 'GHOST', directorpi_detail: 'dp' },
  ], n2k);
  assert(flat.length === 0 && skipped.length === 1 && skipped[0] === 'GHOST', `expected skip GHOST: ${JSON.stringify({ flat, skipped })}`);
});

it('badge resolves by product_key despite a stale product_name (rename-proof)', () => {
  const products = [{ product_key: 'pfroze', name: 'New Name', brand: 'B', category: 'sunscreen', volume_ml: '50' }] as unknown as Row[];
  const map = buildNameToKey(products);
  const { flat } = expandBadges([{ product_key: 'pfroze', product_name: 'OLD STALE NAME', directorpi_detail: 'dp' }], map);
  assert(flat.length === 1 && flat[0].product_key === 'pfroze', `key-join failed: ${JSON.stringify(flat)}`);
});

// ---------------------------------------------------------------------------
console.log('\n--- slug fallback ---');

it('explicit slug wins; blank falls back to product_key', () => {
  assert(resolveDisplaySlug('mild-sun', 'pabc') === 'mild-sun', 'explicit slug');
  assert(resolveDisplaySlug('  ', 'pabc') === 'pabc', 'blank → key');
  assert(resolveDisplaySlug(undefined, 'pabc') === 'pabc', 'undefined → key');
});

// ---------------------------------------------------------------------------
console.log('\n--- product_key freeze plan ---');

it('blank product_key → generated + correct sheet row; existing untouched', () => {
  const rows: Row[] = [
    { product_key: '',       name: 'Sun A', brand: 'B1', category: 'sunscreen', volume_ml: '50' }, // row 2
    { product_key: 'pfixed', name: 'Sun B', brand: 'B2', category: 'sunscreen', volume_ml: '50' }, // row 3 (skip)
    { product_key: '',       name: 'Sun C', brand: 'B3', category: 'sunscreen', volume_ml: '50' }, // row 4
  ];
  const plan = planKeyFreeze(rows);
  assert(plan.length === 2, `expected 2 freezes, got ${plan.length}`);
  assert(plan[0].rowNumber === 2 && plan[0].key === makeProductKey('B1', 'Sun A'), `row1 wrong: ${JSON.stringify(plan[0])}`);
  assert(plan[1].rowNumber === 4 && plan[1].key === makeProductKey('B3', 'Sun C'), `row2 wrong: ${JSON.stringify(plan[1])}`);
});

it('freeze is idempotent: once keys are filled, plan is empty', () => {
  const rows: Row[] = [
    { product_key: 'pa', name: 'Sun A', brand: 'B1', category: 'sunscreen', volume_ml: '50' },
    { product_key: 'pc', name: 'Sun C', brand: 'B3', category: 'sunscreen', volume_ml: '50' },
  ];
  assert(planKeyFreeze(rows).length === 0, 'expected no freezes when all keys present');
});

// ---------------------------------------------------------------------------
console.log('\n--- duplicate product_name / slug detection ---');

it('same product_name under two distinct keys → ambiguous name-join flagged', () => {
  const products: Row[] = [
    { name: 'Twin', brand: 'BrandA', category: 'sunscreen', volume_ml: '50' },
    { name: 'Twin', brand: 'BrandB', category: 'sunscreen', volume_ml: '50' },
  ];
  const r = detectSheetDuplicates(products, []);
  assert(r.duplicateProductNames.length === 1 && r.duplicateProductNames[0].product_keys.length === 2, `name dup not detected: ${JSON.stringify(r.duplicateProductNames)}`);
  assert(hasDuplicates(r), 'hasDuplicates should be true');
});

it('same explicit slug on two products → routing clash flagged', () => {
  const products: Row[] = [
    { name: 'A', brand: 'B1', category: 'sunscreen', volume_ml: '50', slug: 'dup-slug' },
    { name: 'B', brand: 'B2', category: 'sunscreen', volume_ml: '50', slug: 'dup-slug' },
  ];
  const r = detectSheetDuplicates(products, []);
  assert(r.duplicateSlugs.length === 1 && r.duplicateSlugs[0].slug === 'dup-slug', `slug dup not detected: ${JSON.stringify(r.duplicateSlugs)}`);
});

it('blank slugs never collide (fall back to unique keys)', () => {
  const products: Row[] = [
    { name: 'A', brand: 'B1', category: 'sunscreen', volume_ml: '50', slug: '' },
    { name: 'B', brand: 'B2', category: 'sunscreen', volume_ml: '50', slug: '' },
  ];
  const r = detectSheetDuplicates(products, []);
  assert(r.duplicateSlugs.length === 0, `blank slugs flagged wrongly: ${JSON.stringify(r.duplicateSlugs)}`);
});

console.log(failed ? '\nResult: FAILED' : '\nResult: ALL PASSED');
if (failed) process.exit(1);
