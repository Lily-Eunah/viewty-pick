// Read-only generator: turns candidate SEO topics (aligned with the seo_pages
// sheet's title brainstorm) into fully-structured page rows, keeping only those
// that back >= MIN_SEO_PRODUCTS displayable products. Prints a TSV ready for the
// seo_pages sheet plus a count report. NEVER writes anywhere.
//
//   npx tsx -r dotenv/config scripts/ops/analyze-seo-topics.ts

import { getProducts } from '../../lib/queries';
import { matchSeoProducts, MIN_SEO_PRODUCTS, SeoFilters } from '../../lib/seo/match';
import { SEO_PAGE_SPECS, SeoPageSpec } from '../../lib/seo/specs';
import { UIProduct } from '../../lib/types';

function row(spec: SeoPageSpec): Record<string, string> {
  return {
    slug: spec.slug,
    page_type: spec.page_type,
    title: spec.title,
    h1: spec.h1,
    description: spec.description,
    category: spec.category ?? '',
    skin_type: spec.skin_type ?? '',
    badge_type: spec.badge_type ?? '',
    keywords: spec.keywords ?? '',
    is_active: 'true',
  };
}

async function main() {
  const products = await getProducts({ sortBy: 'recommend' });
  console.log(`TOTAL displayable products: ${products.length}\n`);

  const qualifying: { spec: SeoPageSpec; n: number; sample: string[] }[] = [];
  const rejected: { spec: SeoPageSpec; n: number }[] = [];
  const seen = new Set<string>();

  for (const spec of SEO_PAGE_SPECS) {
    if (seen.has(spec.slug)) throw new Error(`duplicate slug: ${spec.slug}`);
    seen.add(spec.slug);
    const f: SeoFilters = {
      category: spec.category,
      skinType: spec.skin_type,
      badge: spec.badge_type,
      keywords: spec.keywords,
    };
    const matched: UIProduct[] = matchSeoProducts(products, f);
    if (matched.length >= MIN_SEO_PRODUCTS) {
      qualifying.push({ spec, n: matched.length, sample: matched.slice(0, 4).map((p) => `${p.brand} ${p.name}`) });
    } else {
      rejected.push({ spec, n: matched.length });
    }
  }

  console.log(`=== QUALIFYING (${qualifying.length}) — >= ${MIN_SEO_PRODUCTS} products ===`);
  for (const q of qualifying) {
    console.log(`${q.n.toString().padStart(2)}  ${q.spec.slug.padEnd(28)} ${q.spec.title}`);
    console.log(`     ↳ ${q.sample.join(' | ')}`);
  }

  console.log(`\n=== REJECTED (${rejected.length}) — < ${MIN_SEO_PRODUCTS} ===`);
  for (const r of rejected.sort((a, b) => b.n - a.n)) {
    console.log(`${r.n.toString().padStart(2)}  ${r.spec.slug.padEnd(28)} ${r.spec.title}`);
  }

  // TSV for the sheet (header + qualifying rows)
  const cols = ['slug', 'page_type', 'title', 'h1', 'description', 'category', 'skin_type', 'badge_type', 'keywords', 'is_active'];
  console.log('\n=== TSV (qualifying rows) ===');
  console.log(cols.join('\t'));
  for (const q of qualifying) {
    const r = row(q.spec);
    console.log(cols.map((c) => r[c]).join('\t'));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
