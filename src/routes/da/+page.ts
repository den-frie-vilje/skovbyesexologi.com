import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/**
 * /da → redirect to / (the canonical DA path).
 *
 * Danish is the default locale and lives prefix-less at the root;
 * /da only exists as a consistency shim so URLs that arrive with
 * an explicit /da prefix (from old links, sitemaps, or a curious
 * typist) get a permanent redirect to the canonical URL rather
 * than a 404.
 *
 * Paired with /da/[...rest]/+page.ts which handles sub-paths.
 *
 * Prerendered so adapter-static bakes it into the build as a
 * redirect HTML file — no live SvelteKit runtime required.
 */
export const prerender = true;

export const load: PageLoad = () => {
  throw redirect(301, '/');
};
