/**
 * Pure matcher tests for the /best/[slug] SEO pages.
 * Run: tsx lib/__tests__/seoMatch.test.ts
 */
import { matchSeoProducts, matchesKeywords } from '../seo/match';
import { UIProduct } from '../types';

let failed = false;
function it(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failed = true; console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`); }
}
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

function prod(over: Partial<UIProduct>): UIProduct {
  return {
    id: '0', slug: 's', brand: '', name: '', category: 'etc', image: '', volume: '',
    description: '', skinTypes: [], tags: [], badges: [], lowestPrice: 0, hasAnyPrice: true,
    source: 'directorpi', reasonItems: [], stores: [], viewtyScore: 80, features: [], ...over,
  } as UIProduct;
}

const OY_STORE = { name: '올리브영', sellerSlug: 'oliveyoung', price: 10000, url: '/go/1', hasPrice: true };
const CP_STORE = { name: '쿠팡', sellerSlug: 'coupang', price: 9000, url: '/go/2', hasPrice: true };

const catalog: UIProduct[] = [
  prod({ id: '1', name: '진정 시카 토너', category: 'toner', majorCategory: 'skincare', skinTypes: ['민감성', '건성'], features: ['진정'], stores: [OY_STORE, CP_STORE] }),
  prod({ id: '2', name: '약산성 토너', category: 'toner', majorCategory: 'skincare', skinTypes: ['지성'], features: ['약산성'], stores: [CP_STORE] }),
  prod({ id: '3', name: '보습 크림', category: 'cream', majorCategory: 'skincare', skinTypes: ['건성'], features: ['보습'], stores: [OY_STORE] }),
  prod({ id: '4', name: '포 맨 올인원', category: 'allinone', majorCategory: 'skincare', skinTypes: ['복합성'], brand: '이니스프리', stores: [CP_STORE] }),
  prod({ id: '5', name: '톤업 선크림', category: 'sunscreen', majorCategory: 'suncare', skinTypes: ['건성'], features: ['톤업'], stores: [OY_STORE] }),
];

it('category filter matches minor slug', () => {
  const r = matchSeoProducts(catalog, { category: 'toner' });
  assert(r.length === 2, `expected 2 toners, got ${r.length}`);
});

it('category filter also matches major slug', () => {
  const r = matchSeoProducts(catalog, { category: 'skincare' });
  assert(r.length === 4, `expected 4 skincare, got ${r.length}`);
});

it('skinType filter is AND with category', () => {
  const r = matchSeoProducts(catalog, { category: 'toner', skinType: '민감성' });
  assert(r.length === 1 && r[0].id === '1', 'expected only the sensitive toner');
});

it('keywords OR across synonyms, scoped by category', () => {
  const r = matchSeoProducts(catalog, { category: 'toner', keywords: '진정,약산성' });
  assert(r.length === 2, `expected both toners, got ${r.length}`);
});

it('keyword matches brand/name haystack (남자 → 포 맨)', () => {
  const r = matchSeoProducts(catalog, { keywords: '포 맨,남자' });
  assert(r.length === 1 && r[0].id === '4', 'expected the men allinone');
});

it('badge filter (directorpi source)', () => {
  const r = matchSeoProducts(catalog, { category: 'sunscreen', badge: 'directorpi' });
  assert(r.length === 1, `expected 1 directorpi sunscreen, got ${r.length}`);
});

it('empty/blank keywords match everything', () => {
  assert(matchesKeywords(prod({ name: 'x' }), '') === true, 'blank keyword should pass');
  assert(matchesKeywords(prod({ name: 'x' }), null) === true, 'null keyword should pass');
  assert(matchesKeywords(prod({ name: 'x' }), ' , ') === true, 'whitespace-only keyword should pass');
});

it('no filters returns the whole catalog', () => {
  assert(matchSeoProducts(catalog, {}).length === catalog.length, 'no filters → all');
});

it('seller filter returns only products listed on that seller', () => {
  const oy = matchSeoProducts(catalog, { seller: 'oliveyoung' });
  assert(oy.length === 3, `expected 3 oliveyoung products, got ${oy.length}`);
  assert(oy.every((p) => p.stores.some((s) => s.sellerSlug === 'oliveyoung')), 'all results should have oliveyoung store');
});

it('seller + category filter combines as AND', () => {
  const r = matchSeoProducts(catalog, { category: 'toner', seller: 'oliveyoung' });
  assert(r.length === 1 && r[0].id === '1', `expected only toner id=1 on oliveyoung, got ${r.length}`);
});

if (failed) { console.error('\nSEO match tests FAILED'); process.exit(1); }
else { console.log('\nAll SEO match tests passed'); }
