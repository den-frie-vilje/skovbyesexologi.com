/**
 * Server hook for SvelteKit — currently only sets the HTML `lang`
 * attribute based on the URL.
 *
 * `app.html` has `<html lang="%sveltekit.lang%">` (we edit it in that
 * template to use the placeholder). The `transformPageChunk` below
 * replaces the placeholder at render time with the inferred locale:
 *   /          → da
 *   /en/…      → en
 *
 * This runs during prerender (adapter-static), so each prerendered
 * page ends up with the correct static lang attribute in its HTML —
 * no runtime cost, search engines see the right value immediately.
 */
import type { Handle } from '@sveltejs/kit';

const LOCALE_PREFIXES: Record<string, string> = {
  '/en': 'en',
  '/en/': 'en'
};

function inferLocale(pathname: string): 'da' | 'en' {
  if (pathname === '/en' || pathname.startsWith('/en/')) return 'en';
  return 'da';
}

export const handle: Handle = async ({ event, resolve }) => {
  const lang = inferLocale(event.url.pathname);
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%sveltekit.lang%', lang)
  });
};
