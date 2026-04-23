/**
 * English service detail routes — mirror of `ydelser/[slug]` under
 * `/en/services/{slug}`. See the DA route for the full rationale;
 * this file just swaps the locales in the lookup.
 *
 * Shared lookup + peer/altHref logic lives in `$lib/content`'s
 * `loadService()`.
 */

import { contentFor, loadService } from '$lib/content';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const prerender = true;

export const entries = () => {
  return contentFor('en').services.map((s) => ({ slug: s.slug }));
};

export const load: PageLoad = ({ params }) => {
  const result = loadService('en', params.slug);
  if (!result) throw error(404, 'Service not found');
  return result;
};
