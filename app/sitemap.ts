import type { MetadataRoute } from 'next';
import { isSiteIndexable, SITE_URL } from '../lib/seo/indexable';
import { getActiveSeoPages, getCategories, getProducts } from '../lib/queries';
import { matchSeoProducts, MIN_SEO_PRODUCTS } from '../lib/seo/match';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // While noindex, expose nothing. robots.txt already Disallows everything;
  // an empty sitemap keeps the two consistent.
  if (!isSiteIndexable()) return [];

  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/best`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
  ];

  try {
    const [pages, products, categories] = await Promise.all([
      getActiveSeoPages(),
      getProducts({ sortBy: 'recommend' }),
      getCategories(),
    ]);

    // SEO landing pages — only those backing >= MIN_SEO_PRODUCTS products (mirror the
    // route's thin-content 404 so the sitemap never advertises a 404).
    for (const p of pages) {
      const n = matchSeoProducts(products, {
        category: p.category, skinType: p.skin_type, badge: p.badge_type, keywords: p.keywords,
      }).length;
      if (n >= MIN_SEO_PRODUCTS) {
        entries.push({ url: `${SITE_URL}/best/${p.slug}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 });
      }
    }

    // Category listing pages.
    for (const c of categories) {
      entries.push({ url: `${SITE_URL}/c/${c.slug}`, lastModified: now, changeFrequency: 'daily', priority: 0.6 });
    }

    // Product detail pages.
    for (const prod of products) {
      entries.push({ url: `${SITE_URL}/p/${prod.slug}`, lastModified: now, changeFrequency: 'daily', priority: 0.6 });
    }
  } catch {
    // On a data-fetch failure, still return the static baseline rather than 500.
  }

  return entries;
}
