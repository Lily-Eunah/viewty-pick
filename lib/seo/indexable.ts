// Single source of truth for whether the site may be indexed by search engines.
//
// Launch phasing (DESIGN / launch runbook §4): during team verification the
// site is publicly reachable but must NOT be indexed. Indexing stays OFF until
// the public-launch step explicitly opts in by setting SITE_INDEXABLE=true in
// the Cloudflare environment. Default (unset/anything-but-"true") => noindex.

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://viewtypick.com';

/** True only when the env flag is exactly "true". Fail-closed otherwise. */
export function isSiteIndexable(): boolean {
  return process.env.SITE_INDEXABLE === 'true';
}
