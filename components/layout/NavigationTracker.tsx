'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

import { markInAppNav } from '../../lib/nav/inAppNav';

/**
 * Mounted once in the root layout (which persists across route changes). It
 * records the entry pathname on first run and marks an in-app navigation the
 * moment the pathname changes — powering the Back button's Home fallback.
 * Comparing against the entry pathname (rather than a "first run" flag) is
 * robust to React Strict Mode's double-invoked effects in dev.
 */
export default function NavigationTracker() {
  const pathname = usePathname();
  const entryPath = useRef<string | null>(null);

  useEffect(() => {
    if (entryPath.current === null) {
      entryPath.current = pathname;
      return;
    }
    if (pathname !== entryPath.current) {
      markInAppNav();
    }
  }, [pathname]);

  return null;
}
