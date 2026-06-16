import type { MetadataRoute } from 'next';
import { isSiteIndexable, SITE_URL } from '../lib/seo/indexable';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  // While noindex, expose nothing. robots.txt already Disallows everything;
  // an empty sitemap keeps the two consistent.
  if (!isSiteIndexable()) {
    return [];
  }

  // Public-launch baseline. Full category/product URL enumeration (querying
  // Supabase) is a launch follow-up alongside Search Console submission.
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];
}
