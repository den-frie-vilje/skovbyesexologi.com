/**
 * Tiny tracker for SPA back-to-home navigation. Lets a click on
 * the "Forsiden" / "Home" back link become a real browser-back
 * when the previous history entry is the homepage — which makes
 * SvelteKit's (and the browser's) native popstate scroll
 * restoration handle the scroll-position work.
 *
 * Why not snapshot / afterNavigate / a scroll store?
 *
 *   SvelteKit's `snapshot.restore` only fires on popstate.
 *   Clicking an `<a href="/">` is a forward push nav, which
 *   never triggers snapshot.restore. Custom afterNavigate hooks
 *   that re-scroll after a push nav have to fight layout
 *   timing (scrollTo gets clamped to the still-growing
 *   scrollHeight of a freshly mounted page). Using
 *   `history.back()` avoids all of that: the browser's own
 *   history machinery restores the scroll position exactly as
 *   if the user had clicked the browser's back button.
 *
 * Fallback: if the previous entry ISN'T the homepage (e.g.
 * direct deep-link to a service page, multi-hop nav), the back
 * link falls through to its normal `<a href="/">` behaviour,
 * which scrolls to the top of home. That's the intuitive
 * result for "first time landing at home."
 *
 * `beforeNavigate` in the `(app)/+layout.svelte` updates
 * `previousPath` on every nav so `lastWasHome()` reflects what's
 * CURRENTLY at the top of history (minus one).
 */

export const navState = $state({
  /** Pathname of the page we just navigated away from, or '' on
   *  the very first nav of the session. */
  previousPath: ''
});

/** Pathnames that count as the homepage, across both locales
 *  and with/without trailing slash (SvelteKit's trailingSlash:
 *  'always' adds one on production builds). */
const HOME_PATHS = new Set(['/', '/en', '/en/']);

/** True when the previous SPA-session navigation left a homepage
 *  URL at the top of history — which means `history.back()` from
 *  the current page will land on the homepage (with native scroll
 *  restore). */
export function lastWasHome(): boolean {
  return HOME_PATHS.has(navState.previousPath);
}

/**
 * `onclick` handler for the service-page "← Forsiden / Home"
 * back link — and ONLY that link. The site-header brand mark is
 * a plain `<a href="/">` (scrolls to top on click, which matches
 * the standard site-logo convention: users expect the logo to
 * mean "go to top of the front page," not "restore a scroll
 * position from one nav ago").
 *
 * Logic: if the previous history entry is the homepage,
 * preventDefault + history.back() → native popstate scroll
 * restoration. Otherwise let the `<a>` proceed as a normal
 * forward nav (→ scroll to top).
 */
export function handleBackToHome(e: MouseEvent): void {
  // Bail on modified clicks so cmd/ctrl-click still opens in a
  // new tab.
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (e.button !== 0) return;
  if (!lastWasHome()) return;
  e.preventDefault();
  history.back();
}
