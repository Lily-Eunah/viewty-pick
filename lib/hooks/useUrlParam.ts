'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Reads/writes a single URL query param as component state, hydration-safe.
 *
 * Why not useSearchParams(): on a statically prerendered route
 * (generateStaticParams + ISR, required here for the Workers free-plan 10ms CPU
 * budget) useSearchParams() de-opts its subtree to client rendering, dropping
 * the prerendered product-list HTML (SEO/LCP). Reading window.location.search
 * via useSyncExternalStore keeps the page prerendered — the server snapshot is
 * the fallback (so prerender matches hydration), and the param is restored only
 * after hydration.
 *
 * Persisting the filter in the URL is what fixes the "sub-category resets on
 * Back from a product detail" bug: the browser restores the full URL (query
 * included) on Back, and this hook re-reads it on remount. Writes use
 * replaceState (Next integrates it with its router) so a filter change is view
 * state, not a history entry — the single category-page entry just carries the
 * latest filter.
 */
const CHANGE_EVENT = 'urlparamchange';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useUrlParam<T extends string | null>(
  key: string,
  fallback: T,
): [T, (next: T) => void] {
  // getSnapshot returns a primitive (string | null), so equal values compare
  // equal under Object.is — no render loop from useSyncExternalStore.
  const getSnapshot = (): T =>
    typeof window === 'undefined'
      ? fallback
      : ((new URLSearchParams(window.location.search).get(key) as T) ?? fallback);

  const value = useSyncExternalStore(subscribe, getSnapshot, () => fallback);

  const setValue = useCallback(
    (next: T) => {
      const params = new URLSearchParams(window.location.search);
      if (next === null || next === fallback) {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key, fallback],
  );

  return [value, setValue];
}
