'use client';

import { useMemo, useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'viewtypick:favorites';
const CHANGE_EVENT = 'viewtypick:favoritesChanged';

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

// Return raw string to ensure referential stability in useSyncExternalStore
function getSnapshot(): string {
  if (typeof window === 'undefined') return '[]';
  return window.localStorage.getItem(STORAGE_KEY) || '[]';
}

function getServerSnapshot(): string {
  return '[]';
}

export function useFavorites() {
  const rawFavorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const favorites = useMemo(() => {
    try {
      return JSON.parse(rawFavorites) as string[];
    } catch (e) {
      console.error('Failed to parse favorites:', e);
      return [];
    }
  }, [rawFavorites]);

  const isFavorite = useCallback(
    (slug: string) => {
      return favorites.includes(slug);
    },
    [favorites]
  );

  const toggle = useCallback((slug: string) => {
    if (typeof window === 'undefined') return;
    
    const stored = window.localStorage.getItem(STORAGE_KEY);
    let current: string[] = [];
    if (stored) {
      try {
        current = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse favorites on toggle:', e);
      }
    }

    let next: string[];
    if (current.includes(slug)) {
      next = current.filter((s) => s !== slug);
    } else {
      next = [slug, ...current];
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return {
    favorites,
    isFavorite,
    toggle,
    isMounted: typeof window !== 'undefined',
  };
}
