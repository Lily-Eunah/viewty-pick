/**
 * Pure search-helper tests for the /search live filter.
 * Run: tsx lib/__tests__/search.test.ts
 */
import {
  normalize,
  fieldMatch,
  matchesQuery,
  searchProducts,
  suggestKeywords,
  suggestProducts,
  popularKeywords,
  addRecentSearch,
  removeRecentSearch,
  SearchableProduct,
} from '../search';
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
    source: 'oliveyoung', reasonItems: [], stores: [], viewtyScore: 80, features: [], ...over,
  } as UIProduct;
}
function item(over: Partial<UIProduct>, categoryName: string): SearchableProduct {
  return { product: prod(over), categoryName };
}

// A small fixture set mirroring the real catalog shape.
const items: SearchableProduct[] = [
  item({ id: '1', slug: 'torriden-toner', brand: '토리든', name: '다이브인 저분자 히알루론산 토너', features: ['수분', '진정'], hasAnyPrice: true, viewtyScore: 95 }, '토너'),
  item({ id: '2', slug: 'isntree-toner', brand: '이즈앤트리', name: '그린티 프레시 토너', features: ['진정'], hasAnyPrice: true, viewtyScore: 90 }, '토너'),
  item({ id: '3', slug: 'beauty-cream', brand: '에스트라', name: '리페어 크림', features: ['보습'], hasAnyPrice: false, viewtyScore: 99 }, '크림'),
  item({ id: '4', slug: 'roundlab-sun', brand: '라운드랩', name: '자작나무 선크림', features: ['자외선차단'], hasAnyPrice: true, viewtyScore: 88 }, '선크림'),
];

console.log('--- normalize / fieldMatch ---');
it('normalize lowercases + trims', () => {
  assert(normalize('  ToNeR ') === 'toner', `got ${normalize('  ToNeR ')}`);
});
it('fieldMatch prefix > infix > none', () => {
  assert(fieldMatch('토리든', '토리') === 'prefix', 'prefix');
  assert(fieldMatch('저분자 토너', '토너') === 'infix', 'infix');
  assert(fieldMatch('크림', '토너') === 'none', 'none');
});
it('empty query → none / matches everything', () => {
  assert(fieldMatch('토너', '') === 'none', 'empty query none');
  assert(matchesQuery(items[0], '   ') === true, 'blank matches');
});

console.log('--- matchesQuery (name·brand·category·features substring, case/space-insensitive) ---');
it('matches by category name token (토너)', () => {
  assert(matchesQuery(items[0], '토너') === true, 'toner product matches 토너');
  assert(matchesQuery(items[2], '토너') === false, 'cream product does not');
});
it('matches by brand (토리든) regardless of case/space', () => {
  assert(matchesQuery(items[0], '  토리든 ') === true, 'brand match trimmed');
});
it('matches by feature token (보습)', () => {
  assert(matchesQuery(items[2], '보습') === true, 'feature match');
});

console.log('--- searchProducts (filter + price-less sinks to bottom) ---');
it('"토너" returns only toners', () => {
  const r = searchProducts(items, '토너');
  assert(r.length === 2 && r.every((p) => p.category === 'toner' || p.name.includes('토너')), `got ${r.map((p) => p.slug)}`);
});
it('price-less product sinks below priced ones even with higher score', () => {
  // query matches all (empty); cream(99, no price) must come after priced lower-score items
  const r = searchProducts(items, '');
  assert(r[r.length - 1].slug === 'beauty-cream', `price-less last, got ${r.map((p) => p.slug)}`);
});

console.log('--- suggestKeywords (brand·category chips) ---');
it('"토" suggests 토너 (category) and 토리든 (brand), prefix-ranked, deduped', () => {
  const ks = suggestKeywords(items, '토');
  const labels = ks.map((k) => k.keyword);
  assert(labels.includes('토너') && labels.includes('토리든'), `got ${labels}`);
  // 토너 has coverage 2 (prefix) → ranks above 토리든 (coverage 1)
  assert(labels.indexOf('토너') < labels.indexOf('토리든'), `coverage rank: ${labels}`);
});
it('no query → no keyword suggestions', () => {
  assert(suggestKeywords(items, '').length === 0, 'empty');
});
it('caps at limit', () => {
  assert(suggestKeywords(items, '토', 1).length === 1, 'limit 1');
});

console.log('--- suggestProducts (name/brand quick-jump) ---');
it('ranks brand/name match, priced before price-less, score desc', () => {
  const ps = suggestProducts(items, '토');
  // 토리든 (brand prefix) qualifies; cream (no name/brand match) excluded
  assert(ps.some((p) => p.slug === 'torriden-toner'), 'includes torriden');
  assert(!ps.some((p) => p.slug === 'beauty-cream'), 'excludes non name/brand match');
});
it('top limit honored', () => {
  assert(suggestProducts(items, '토', 1).length <= 1, 'limit');
});

console.log('--- popularKeywords (category coverage) ---');
it('orders categories by product count', () => {
  const pk = popularKeywords(items);
  assert(pk[0] === '토너', `토너 most common, got ${pk}`);
});

console.log('--- recent searches (dedup, newest-first, cap) ---');
it('addRecentSearch prepends + dedups (case-insensitive)', () => {
  let r = addRecentSearch([], '토너');
  r = addRecentSearch(r, '크림');
  r = addRecentSearch(r, '토너'); // moves to front
  assert(r.join(',') === '토너,크림', `got ${r}`);
});
it('addRecentSearch ignores blank, caps at max', () => {
  assert(addRecentSearch(['a'], '   ').join(',') === 'a', 'blank ignored');
  const capped = addRecentSearch(['1', '2', '3'], '0', 3);
  assert(capped.length === 3 && capped[0] === '0', `cap: ${capped}`);
});
it('removeRecentSearch drops the term (case-insensitive)', () => {
  assert(removeRecentSearch(['토너', '크림'], '토너').join(',') === '크림', 'removed');
});

console.log(failed ? '\nResult: FAILED' : '\nResult: ALL PASSED');
if (failed) process.exit(1);
