'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Shared 피부타입 selection, backed by localStorage so it persists across the
 * home and category lists and stays in sync between them.
 *
 * Implemented with useSyncExternalStore (not useState + useEffect): the first
 * client render matches the server snapshot (null) and only syncs after
 * hydration, so there is no hydration mismatch AND no synchronous setState
 * inside an effect (react-hooks/set-state-in-effect).
 */
const STORAGE_KEY = 'selectedSkinType';
const CHANGE_EVENT = 'selectedSkinTypeChanged';

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

// getItem returns a primitive (string | null) so the reference is stable between
// reads of the same value — safe for useSyncExternalStore's Object.is comparison.
function getSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

export function useSelectedSkinType(): [string | null, (next: string | null) => void] {
  const selected = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setSelected = useCallback((next: string | null) => {
    if (next) {
      window.localStorage.setItem(STORAGE_KEY, next);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [selected, setSelected];
}
