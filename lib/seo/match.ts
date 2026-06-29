// Single source of truth for mapping an SEO-page row → the products it lists.
// Used by BOTH the /best/[slug] route and the sheet-generator script so the live
// page and the "≥4 products" gate that decides whether a page is worth building
// can never drift apart.

import { UIProduct } from '../types';

export interface SeoFilters {
  category?: string | null; // minor (소분류) OR major (대분류) slug
  skinType?: string | null; // Korean skin-type name, e.g. '건성'
  badge?: string | null; // 'directorpi' | 'hwahae' (curation source)
  keywords?: string | null; // CSV of synonyms; product matches if ANY token appears
}

// A page only earns a slot in the sitemap/index when it can show at least this
// many products — thin pages (<4) are 404'd so they never get indexed.
export const MIN_SEO_PRODUCTS = 4;

/** Searchable text for a product: name + brand + features + tags + badges. */
function haystack(p: UIProduct): string {
  return [p.name, p.brand, p.description, ...(p.features ?? []), ...(p.tags ?? []), ...p.badges]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** True when the product matches ANY keyword token (OR within a topic's synonyms). */
export function matchesKeywords(p: UIProduct, keywords?: string | null): boolean {
  if (!keywords) return true;
  const tokens = keywords.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) return true;
  const h = haystack(p);
  return tokens.some((t) => h.includes(t));
}

function matchesBadge(p: UIProduct, badge?: string | null): boolean {
  if (!badge) return true;
  if (badge === 'directorpi') return p.source === 'directorpi' || p.badges.some((b) => b.includes('디렉터파이'));
  if (badge === 'hwahae') return p.source === 'hwahae' || p.badges.some((b) => b.includes('화해'));
  return true;
}

/**
 * Filter a (display-gated, recommend-sorted) product list down to one SEO page's
 * products. Dimensions combine with AND; keyword synonyms combine with OR.
 * Input order is preserved, so the caller's sort (recommend / price) carries through.
 */
export function matchSeoProducts(products: UIProduct[], f: SeoFilters): UIProduct[] {
  return products.filter((p) => {
    if (f.category && p.category !== f.category && p.majorCategory !== f.category) return false;
    if (f.skinType && !p.skinTypes.includes(f.skinType)) return false;
    if (!matchesBadge(p, f.badge)) return false;
    if (!matchesKeywords(p, f.keywords)) return false;
    return true;
  });
}
