/**
 * Floating "Publicér" button on /admin.
 *
 * Adds a sage-green pill labelled "Publicér" to Sveltia's top
 * toolbar that takes the editor user to /publish (which merges
 * staging→main and triggers a production deploy).
 *
 * Why this is JS-injected from a separate file rather than just a
 * static <a> element baked into the prerendered admin/index.html:
 *
 *   1. Sveltia mounts its app-shell in <body> at runtime, and
 *      SvelteKit's preload-data runtime (loaded on this route
 *      even with csr=false because the body has
 *      data-sveltekit-preload-data="hover") processes the
 *      prerendered fragment markers and clears the children of
 *      the SvelteKit root div. Any static <a> we put in the page
 *      template gets removed before Sveltia even mounts.
 *
 *   2. We need the link to be auth-aware — visible only after
 *      Sveltia has signed in, hidden during the pre-auth screen
 *      so the unauthenticated landing isn't cluttered.
 *
 *   3. We need the position to track Sveltia's toolbar — Sveltia
 *      shows an announcement banner at the top occasionally, and
 *      it can be dismissed; the toolbar shifts up when it does.
 *      A static `top: 50px` would be wrong half the time.
 *
 * Approach:
 *
 *   - Inject a <style> tag into <head> on first load (Sveltia
 *     doesn't manipulate <head>, so the styles persist).
 *   - Poll every second: if authed, ensure a <a class="..."> is in
 *     the body; otherwise remove it. Anchor the button's `top` CSS
 *     property to Sveltia's primary toolbar `getBoundingClientRect().top`
 *     so the button rides along with whatever Sveltia is doing.
 *   - We anchor to `[role="toolbar"]` rather than the search input
 *     because the search input is only present on the collection-
 *     listing view; on the entry-editor view it's removed (or kept
 *     in DOM with zero dimensions, which would silently anchor the
 *     FAB to top:0). The primary toolbar exists on every Sveltia
 *     view (listing, editor, asset library, account menu, etc.).
 *   - We skip toolbars whose getBoundingClientRect is empty —
 *     Sveltia keeps stale editor toolbars in the DOM during route
 *     transitions, and they sit at top:0 width:0 height:0 until GC.
 *   - Mobile fallback: when no visible toolbar is found (rare —
 *     mostly during the auth screen, where the FAB is hidden anyway
 *     by the isAuthed() guard), we use top: 14px.
 *
 * Auth detection: Sveltia stores its OAuth token at
 * `localStorage["sveltia-cms.user"].token`. The same key is used
 * by the /publish page to authenticate its merge call to GitHub,
 * so we know it's the canonical source.
 */

(function () {
  'use strict';

  const FAB_CLASS = 'skovbye-publish-fab';
  const STORAGE_KEY = 'sveltia-cms.user';
  const PUBLISH_URL = '/publish';
  const SYNC_INTERVAL_MS = 1000;

  function isAuthed() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!(parsed && parsed.token);
    } catch (e) {
      return false;
    }
  }

  function injectStyles() {
    if (document.getElementById('skovbye-fab-style')) return;
    const style = document.createElement('style');
    style.id = 'skovbye-fab-style';
    // Inline literal — keeps the file standalone and avoids dynamic
    // class names (CSP-friendly: the style sheet is part of the
    // same-origin asset, no inline `style=` attributes needed).
    style.textContent =
      '.' +
      FAB_CLASS +
      ' {' +
      'position: fixed;' +
      'right: 120px;' +
      'top: 14px;' +
      'z-index: 99999;' +
      'background: oklch(0.5 0.13 152);' +
      'color: #fff;' +
      'padding: 8px 14px;' +
      'border-radius: 6px;' +
      'text-decoration: none;' +
      'font: 600 14px/1.2 system-ui, -apple-system, sans-serif;' +
      'box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);' +
      'letter-spacing: 0.01em;' +
      'white-space: nowrap;' +
      'transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;' +
      '}' +
      '.' +
      FAB_CLASS +
      ':hover {' +
      'transform: translateY(-1px);' +
      'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);' +
      'background: oklch(0.45 0.13 152);' +
      '}';
    document.head.appendChild(style);
  }

  function makeFab() {
    const a = document.createElement('a');
    a.className = FAB_CLASS;
    a.href = PUBLISH_URL;
    a.title = 'Publicér ændringer til produktion';
    a.textContent = 'Publicér';
    return a;
  }

  function findVisibleToolbar() {
    // Sveltia renders one or more `[role="toolbar"]` per view. On the
    // collection-listing view there's a single primary toolbar. On the
    // entry-editor view a second toolbar overlays it. During route
    // transitions, stale toolbars are kept in the DOM at width=0/height=0
    // before garbage collection — pick the first visible one so the
    // FAB doesn't snap to top:0 while a stale element is at the top
    // of the DOM.
    const toolbars = document.querySelectorAll('[role="toolbar"]');
    for (const tb of toolbars) {
      const r = tb.getBoundingClientRect();
      if (r.height > 0 && r.width > 0) return tb;
    }
    return null;
  }

  function sync() {
    let fab = document.querySelector('.' + FAB_CLASS);
    if (isAuthed()) {
      // Anchor vertically to Sveltia's primary toolbar. The toolbar
      // is at top:0 normally and shifts down by ~36px when the
      // announcement banner is shown — the FAB rides along.
      //
      // +12px is measured directly off Sveltia's own toolbar
      // children (its buttons + search input all sit at top:12,
      // height:32 inside the 56px-tall toolbar — geometric centre
      // 28). The FAB's box is 32.8px tall (8+8 padding + 14×1.2
      // line-height), so top:12 gives centerY:28.4 — 0.4px below
      // Sveltia's own button centres, sub-pixel and visually
      // identical. The FAB's top edge sits flush with Sveltia's
      // button top edges.
      const anchor = findVisibleToolbar();
      const top = anchor ? anchor.getBoundingClientRect().top + 12 : 12;
      if (!fab) {
        fab = makeFab();
        document.body.appendChild(fab);
      }
      fab.style.top = top + 'px';
    } else if (fab) {
      fab.remove();
    }
  }

  function start() {
    injectStyles();
    sync();
    // Cross-tab auth changes fire `storage` events. Same-tab changes
    // (sign-in/sign-out within the current window) don't, so we also
    // poll on an interval. 1s is fast enough that the FAB appears
    // within ~a second of sign-in completing.
    window.addEventListener('storage', sync);
    setInterval(sync, SYNC_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
