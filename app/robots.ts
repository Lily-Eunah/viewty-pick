import type { MetadataRoute } from 'next';
import { isSiteIndexable, SITE_URL } from '../lib/seo/indexable';

// Evaluated per request so flipping SITE_INDEXABLE in the Cloudflare env flips
// crawling immediately, without rebuilding the static pages.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (!isSiteIndexable()) {
    // Team-verification phase: block all crawlers site-wide.
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  // Public-launch phase: allow crawling of content, keep internal/redirect
  // routes out of the index.
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/go/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
