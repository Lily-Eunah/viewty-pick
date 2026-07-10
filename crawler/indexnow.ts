// IndexNow submission — pushes changed URLs to Bing·Naver·Yandex·Seznam for
// near-real-time re-indexing right after the daily price sync, instead of waiting
// for the next organic crawl. Google does NOT support IndexNow (rely on the
// sitemap + Search Console there).
//
// Fired from crawler/run.ts Step 8.1, after the on-demand revalidate. No-op unless
// BOTH INDEXNOW_KEY is set AND SITE_INDEXABLE === 'true' — we never ask engines to
// index a site that is still serving noindex.

import { supabaseServer } from '../lib/supabase/server';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://viewtypick.com').replace(/\/$/, '');
const ENDPOINT = 'https://api.indexnow.org/indexnow'; // fans out to all participating engines

/** Collect the public, indexable URLs worth re-submitting: core + active SEO pages + categories. */
async function collectUrls(): Promise<string[]> {
  const urls = new Set<string>([SITE, `${SITE}/best`]);
  try {
    const { data: pages } = await supabaseServer.from('seo_pages').select('slug').eq('is_active', true);
    for (const p of pages ?? []) if (p.slug) urls.add(`${SITE}/best/${p.slug}`);
  } catch (e) {
    console.error('[IndexNow] seo_pages query failed', e);
  }
  try {
    const { data: cats } = await supabaseServer.from('categories').select('slug');
    for (const c of cats ?? []) if (c.slug) urls.add(`${SITE}/c/${c.slug}`);
  } catch (e) {
    console.error('[IndexNow] categories query failed', e);
  }
  return [...urls];
}

export async function submitIndexNow(): Promise<void> {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) {
    console.log('[IndexNow] skip — INDEXNOW_KEY not set');
    return;
  }
  if (process.env.SITE_INDEXABLE !== 'true') {
    console.log('[IndexNow] skip — SITE_INDEXABLE not "true" (site is noindex)');
    return;
  }

  const urlList = await collectUrls();
  const body = {
    host: new URL(SITE).host,
    key,
    keyLocation: `${SITE}/indexnow.txt`,
    urlList,
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    // 200 = accepted, 202 = accepted (pending verification). Anything else = log for triage.
    if (res.ok) {
      console.log(`[IndexNow] submitted ${urlList.length} URLs → HTTP ${res.status}`);
    } else {
      console.error(`[IndexNow] submission rejected → HTTP ${res.status} ${await res.text().catch(() => '')}`);
    }
  } catch (e) {
    console.error('[IndexNow] submit failed', e);
  }
}
