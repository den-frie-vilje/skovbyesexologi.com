/**
 * Floating "Publicér" button on /admin.
 *
 * Adds a sage-green pill labelled "Publicér" over Sveltia's top
 * row that takes the editor user to /publish (which merges
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
 *   - Keep the button in step with Sveltia's own top row, on every
 *     DOM change and navigation: centre it vertically on that row,
 *     so it rides along when the announcement banner pushes the
 *     toolbar down.
 *   - The top row is the first visible `[role="toolbar"]` that is
 *     NOT the bottom navigation. On a phone Sveltia's root views
 *     (Contents, Assets) have no top toolbar at all, only a heading,
 *     and the one toolbar in the DOM is the tab bar at the bottom of
 *     the screen. There the button centres on the heading instead.
 *   - We skip toolbars whose getBoundingClientRect is empty:
 *     Sveltia keeps stale editor toolbars in the DOM during route
 *     transitions, and they sit at top:0 width:0 height:0 until GC.
 *
 * Layouts (Sveltia switches to its phone layout below 768px):
 *
 *   - Wide: 120px in from the right edge, left of Sveltia's create
 *     and account buttons.
 *   - Phone: 10px in from the right edge, where the top row is
 *     empty. Hidden while an entry is being edited: that row is
 *     then full (title, options, Save), and there is nothing to
 *     publish until the entry is saved and closed.
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
    // Part of this same-origin file, so the admin CSP needs nothing
    // extra. Below 1024px Sveltia's own toolbar buttons grow to 40px
    // for touch, and so does this one.
    style.textContent = `
      .${FAB_CLASS} {
        position: fixed;
        right: 120px;
        top: 12px;
        z-index: 99999;
        display: flex;
        align-items: center;
        height: 32px;
        padding: 0 14px;
        border-radius: 6px;
        background: oklch(0.5 0.13 152);
        color: #fff;
        text-decoration: none;
        font: 600 14px/1 system-ui, -apple-system, sans-serif;
        letter-spacing: 0.01em;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        transition: box-shadow 0.15s ease, background 0.15s ease;
      }
      .${FAB_CLASS}:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        background: oklch(0.45 0.13 152);
      }
      .${FAB_CLASS}[hidden] {
        display: none;
      }
      @media (width < 1024px) {
        .${FAB_CLASS} {
          height: 40px;
        }
      }
      @media (width < 768px) {
        .${FAB_CLASS} {
          right: 10px;
        }
      }
    `;
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

  const PHONE = window.matchMedia('(width < 768px)');
  /** Height of Sveltia's top row, and the centre line used before it has rendered. */
  const TOP_ROW_CENTRE = 28;

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.width > 0;
  }

  /** Sveltia's top toolbar, or null on a view that has none. */
  function findTopToolbar() {
    for (const tb of document.querySelectorAll('[role="toolbar"]')) {
      if (tb.closest('.bottom-navigation')) continue;
      if (isVisible(tb)) return tb;
    }
    return null;
  }

  /** The view's heading, for the phone root views that have no toolbar. */
  function findTopHeading() {
    for (const h of document.querySelectorAll('h1, h2, [role="heading"]')) {
      if (isVisible(h) && h.getBoundingClientRect().top < 120) return h;
    }
    return null;
  }

  /** True while an entry is open in the editor. */
  function isEditing() {
    for (const el of document.querySelectorAll('.content-editor')) {
      if (isVisible(el)) return true;
    }
    return false;
  }

  function sync() {
    let fab = document.querySelector('.' + FAB_CLASS);
    if (!isAuthed()) {
      if (fab) fab.remove();
      return;
    }
    if (!fab) {
      fab = makeFab();
      document.body.appendChild(fab);
    }

    const hide = PHONE.matches && isEditing();
    if (fab.hidden !== hide) fab.hidden = hide;
    if (hide) return;

    // Centre on Sveltia's top row: the toolbar's first 56px, or the
    // heading where there is no toolbar.
    const toolbar = findTopToolbar();
    const heading = toolbar ? null : findTopHeading();
    let centre = TOP_ROW_CENTRE;
    if (toolbar) {
      centre = toolbar.getBoundingClientRect().top + TOP_ROW_CENTRE;
    } else if (heading) {
      const r = heading.getBoundingClientRect();
      centre = r.top + r.height / 2;
    }
    const top = Math.round(centre - fab.offsetHeight / 2) + 'px';
    if (fab.style.top !== top) fab.style.top = top;
  }

  function start() {
    injectStyles();
    sync();

    // Follow Sveltia as it renders: one sync per frame at most, on any
    // DOM change. Writes to the button are guarded above, so its own
    // updates do not feed the observer.
    let queued = false;
    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        sync();
      });
    };
    new MutationObserver(queue).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'inert']
    });
    window.addEventListener('hashchange', queue);
    window.addEventListener('resize', queue);
    PHONE.addEventListener('change', queue);

    // Sign-in and sign-out. Other tabs fire `storage`; this tab does
    // not, and signing out changes no DOM the observer is sure to
    // see, so a slow poll covers it.
    window.addEventListener('storage', sync);
    setInterval(sync, SYNC_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
