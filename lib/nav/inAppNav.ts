'use client';

/**
 * Tracks whether the user has navigated *within* the app since the last full
 * page load. A module singleton in the client bundle, so it resets to false on
 * every full reload (fresh entry) and flips to true after the first client-side
 * route change (see NavigationTracker).
 *
 * The Back button reads it to decide between router.back() and a Home fallback:
 * a page entered directly from an external link (e.g. a Threads ad landing on
 * /c/suncare) has no in-app history, so router.back() would dead-end or bounce
 * the user off-site — send them Home instead.
 */
let hadInAppNav = false;

export function markInAppNav(): void {
  hadInAppNav = true;
}

export function getHadInAppNav(): boolean {
  return hadInAppNav;
}
