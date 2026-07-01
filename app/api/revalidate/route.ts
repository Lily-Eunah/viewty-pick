import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { PRODUCTS_TAG } from '../../../lib/queries';

export async function POST(request: NextRequest) {
  try {
    const { secret, path } = await request.json();

    const revalSecret = process.env.REVALIDATE_SECRET;
    const isMockDevMode =
      process.env.NODE_ENV === 'development' ||
      process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
      process.env.CRAWLER_MODE === 'mock';

    // Fail-closed if environment variable is missing, empty, or placeholder
    const isSecretConfigured =
      revalSecret &&
      revalSecret.trim() !== '' &&
      revalSecret !== 'placeholder-revalidate-secret' &&
      revalSecret !== 'placeholder' &&
      revalSecret !== 'example';

    if (!isSecretConfigured) {
      if (isMockDevMode) {
        console.warn('[Revalidation API] Secret is unconfigured. Allowing revalidation because explicit dev/mock mode is active.');
      } else {
        console.error('[Revalidation API] Revalidation secret is unconfigured in production. Gating closed.');
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }
    } else {
      if (!secret || secret !== revalSecret) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }
    }

    if (path) {
      console.log(`[Revalidation API] Revalidating path: ${path}`);
      revalidatePath(path);
      return NextResponse.json({ revalidated: true, path, now: Date.now() });
    }

    // Purge the global product cache (getAllUIProducts, tagged PRODUCTS_TAG) and
    // every page derived from it (home / category / skin / best), so cards re-render
    // with the fresh prices instead of the previous daily snapshot. This is what keeps
    // the card price in sync with the always-live detail page after each daily crawl.
    //
    // Next 16: revalidateTag requires a 2nd "profile" arg — 'max' is the documented
    // replacement for the old single-arg purge. revalidatePath('/', 'layout') then
    // forces the cached page HTML to regenerate from the now-fresh data.
    console.log(`[Revalidation API] Revalidating tag "${PRODUCTS_TAG}" + root layout...`);
    revalidateTag(PRODUCTS_TAG, 'max');
    revalidatePath('/', 'layout');

    return NextResponse.json({ revalidated: true, tag: PRODUCTS_TAG, now: Date.now() });
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
