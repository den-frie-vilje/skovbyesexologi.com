import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { EntryGenerator } from './$types';
import { contentFor, serviceById, serviceBySlug } from '$lib/content';

/**
 * /da/<rest> → redirect to /<rest> (strip the 'da/' prefix).
 *
 * Catchall for any sub-path under /da/. Add entries here as the
 * site grows — each new DA page (e.g. per-service detail pages in
 * Phase 2) wants its /da/<slug> mirror here so both URL shapes
 * resolve to the same canonical place.
 *
 * Currently only lists the empty rest (covers /da/ itself, which
 * SvelteKit normalises to /da and is handled by the sibling
 * /da/+page.ts).
 */
export const prerender = true;


export const entries: EntryGenerator = () => {
  // Enumerate every DA service's URL slug so adapter-static writes
  // a /da/ydelser/<slug>/index.html for each at build time. Drifts
  // automatically as content/services/ files are added or renamed.
  return contentFor('da').services.map((s) => ({ rest: `ydelser/${s.slug}` }));
};

export const load: PageLoad = ({ params }) => {
  const stripped = params.rest ? `/${params.rest}` : '/';
  throw redirect(301, stripped);
};
