/**
 * English service detail routes — mirror of `ydelser/[slug]` under
 * the `/en/services/{slug}` path. See the DA route for the full
 * rationale; this file just swaps the locales in the lookup.
 */

import { contentFor, serviceById, serviceBySlug } from '$lib/content';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const prerender = true;

export const entries = () => {
  return contentFor('en').services.map((s) => ({ slug: s.slug }));
};

export const load: PageLoad = ({ params }) => {
  const service = serviceBySlug('en', params.slug);
  if (!service) throw error(404, 'Service not found');

  const peerDa = serviceById('da', service.id);

  // Mirror of the DA load — see that file for commentary on altHref.
  return {
    locale: 'en' as const,
    altLocale: 'da' as const,
    altHref: peerDa ? `/ydelser/${peerDa.slug}` : '/',
    service,
    peer: peerDa
      ? ({ locale: 'da' as const, slug: peerDa.slug } as const)
      : null
  };
};
