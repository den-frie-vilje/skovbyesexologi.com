import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

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

export const entries = () => [
  // Add { rest: 'terapi' }, { rest: 'intimacy-coordination' }, etc.
  // when those detail pages land.
  { rest: '' }
];

export const load: PageLoad = ({ params }) => {
  const stripped = params.rest ? `/${params.rest}` : '/';
  throw redirect(301, stripped);
};
