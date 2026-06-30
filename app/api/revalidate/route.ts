import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

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

    // Revalidate all key pages
    console.log('[Revalidation API] Revalidating all core web routes...');
    revalidatePath('/');
    revalidatePath('/c/sunscreen');
    revalidatePath('/best');
    revalidatePath('/best/directorpi-sunscreen');
    revalidatePath('/skin/sensitive/sunscreen');

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
