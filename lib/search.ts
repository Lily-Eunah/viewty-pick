import { UIProduct } from './types';

/**
 * Client-side live search over the (small) exposable catalog. Pure helpers only —
 * shared by the /search client component and unit-tested in isolation.
 *
 * A product is matched by a case-insensitive, trimmed SUBSTRING over its
 * name + brand + category name + feature tokens. The catalog is tiny (수십 개) so
 * full in-memory filtering on every keystroke is instant and avoids a server roundtrip.
 */

/** One product paired with its resolved 카테고리명 (UIProduct only carries the slug). */
export interface SearchableProduct {
  product: UIProduct;
  categoryName: string;
}

export type MatchStrength = 'prefix' | 'infix' | 'none';

/** Lowercase + trim — the single normalization applied to every query/field. */
export function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/** Strength of a single field against the query: prefix > infix > none. */
export function fieldMatch(field: string, query: string): MatchStrength {
  const nq = normalize(query);
  if (!nq) return 'none';
  const idx = field.toLowerCase().indexOf(nq);
  if (idx === 0) return 'prefix';
  if (idx > 0) return 'infix';
  return 'none';
}

const strengthRank = (s: MatchStrength): number => (s === 'prefix' ? 2 : s === 'infix' ? 1 : 0);

/** All searchable text for a product, joined + lowercased (name·brand·category·features). */
export function productHaystack(item: SearchableProduct): string {
  const { product, categoryName } = item;
  return [product.name, product.brand, categoryName, ...(product.features ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Substring match over the full haystack. Empty query matches everything. */
export function matchesQuery(item: SearchableProduct, query: string): boolean {
  const nq = normalize(query);
  if (!nq) return true;
  return productHaystack(item).includes(nq);
}

/**
 * Result-grid sort (PR #49 list rule): price-less products always sink to the
 * bottom, then ViewtyScore desc among equals.
 */
export function byPriceThenScore(a: UIProduct, b: UIProduct): number {
  const ap = a.hasAnyPrice ? 1 : 0;
  const bp = b.hasAnyPrice ? 1 : 0;
  if (ap !== bp) return bp - ap;
  return b.viewtyScore - a.viewtyScore;
}

/** Filtered + sorted result list for the grid. */
export function searchProducts(items: SearchableProduct[], query: string): UIProduct[] {
  return items
    .filter((it) => matchesQuery(it, query))
    .map((it) => it.product)
    .sort(byPriceThenScore);
}

export interface KeywordSuggestion {
  keyword: string;
  kind: 'brand' | 'category';
  coverage: number;
}

/**
 * Autocomplete keyword chips derived from brands + category names.
 * Ranking: ① prefix match > infix, ② coverage (연관 제품 수) desc, ③ shorter first.
 * Deduplicated (case-insensitive), top `limit`.
 */
export function suggestKeywords(items: SearchableProduct[], query: string, limit = 6): KeywordSuggestion[] {
  const nq = normalize(query);
  if (!nq) return [];
  const agg = new Map<string, { keyword: string; kind: 'brand' | 'category'; coverage: number; strength: number }>();

  for (const { product, categoryName } of items) {
    const fields: Array<{ value: string; kind: 'brand' | 'category' }> = [];
    if (product.brand) fields.push({ value: product.brand, kind: 'brand' });
    if (categoryName) fields.push({ value: categoryName, kind: 'category' });

    for (const { value, kind } of fields) {
      const strength = strengthRank(fieldMatch(value, nq));
      if (strength === 0) continue;
      const key = value.toLowerCase();
      const cur = agg.get(key);
      if (cur) {
        cur.coverage += 1;
        cur.strength = Math.max(cur.strength, strength);
      } else {
        agg.set(key, { keyword: value, kind, coverage: 1, strength });
      }
    }
  }

  return [...agg.values()]
    .sort(
      (a, b) =>
        b.strength - a.strength ||
        b.coverage - a.coverage ||
        a.keyword.length - b.keyword.length ||
        a.keyword.localeCompare(b.keyword)
    )
    .slice(0, limit)
    .map(({ keyword, kind, coverage }) => ({ keyword, kind, coverage }));
}

/**
 * Quick-jump product suggestions (thumbnail rows → /p/[slug]).
 * Only name/brand matches qualify; ranking: ① match strength (prefix > infix),
 * ② priced first (hasAnyPrice), ③ ViewtyScore desc. Top `limit`.
 */
export function suggestProducts(items: SearchableProduct[], query: string, limit = 5): UIProduct[] {
  const nq = normalize(query);
  if (!nq) return [];

  return items
    .map(({ product }) => ({
      product,
      strength: Math.max(strengthRank(fieldMatch(product.name, nq)), strengthRank(fieldMatch(product.brand || '', nq))),
    }))
    .filter(({ strength }) => strength > 0)
    .sort(
      (a, b) =>
        b.strength - a.strength ||
        (b.product.hasAnyPrice ? 1 : 0) - (a.product.hasAnyPrice ? 1 : 0) ||
        b.product.viewtyScore - a.product.viewtyScore
    )
    .slice(0, limit)
    .map(({ product }) => product);
}

/**
 * Popular keyword chips for the empty (no-query) state: category names ranked by
 * how many exposable products they cover.
 */
export function popularKeywords(items: SearchableProduct[], limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const { categoryName } of items) {
    if (!categoryName) continue;
    counts.set(categoryName, (counts.get(categoryName) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}

// ---------------------------------------------------------------------------
// Recent searches (localStorage) — pure list ops, persisted by the component.
// ---------------------------------------------------------------------------

export const RECENT_SEARCHES_KEY = 'viewtypick:recent-searches';
export const RECENT_SEARCHES_MAX = 8;

/** Prepend a term (dedup, newest-first, trimmed) and cap the list. */
export function addRecentSearch(list: string[], term: string, max = RECENT_SEARCHES_MAX): string[] {
  const t = term.trim();
  if (!t) return list;
  const deduped = list.filter((x) => x.toLowerCase() !== t.toLowerCase());
  return [t, ...deduped].slice(0, max);
}

/** Remove a single term (case-insensitive). */
export function removeRecentSearch(list: string[], term: string): string[] {
  return list.filter((x) => x.toLowerCase() !== term.toLowerCase());
}

/** Parse a stored recent-searches JSON blob into a clean string[]. */
export function parseRecentSearches(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
