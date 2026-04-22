/**
 * Danish service detail routes — one prerendered page per service,
 * addressed at `/ydelser/{slug}` where `slug` is the per-locale URL
 * segment declared inside each `src/content/da/services/*.json`.
 *
 * The English twin for each service lives under
 * `/en/services/{peerSlug}`; see `+page.ts` in that route for the
 * mirror. A service's DA page and EN page are paired by the stable
 * `id` field (= content filename, e.g. `terapi.json` → id `terapi`)
 * — not by slug, since slugs translate.
 */

import { contentFor, serviceById, serviceBySlug } from '$lib/content';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const prerender = true;

export const entries = () => {
  // Enumerate every DA service's URL slug so adapter-static writes
  // a /ydelser/<slug>/index.html for each at build time. Drifts
  // automatically as content/services/ files are added or renamed.
  return contentFor('da').services.map((s) => ({ slug: s.slug }));
};

export const load: PageLoad = ({ params }) => {
  const service = serviceBySlug('da', params.slug);
  if (!service) throw error(404, 'Service not found');

  // Resolve the EN peer by stable id so we can emit an hreflang="en"
  // alternate. If a service exists in DA but not EN (should not
  // happen in practice — content/en mirrors content/da), we still
  // render without an alternate rather than 500ing the page.
  const peerEn = serviceById('en', service.id);

  return {
    locale: 'da' as const,
    service,
    peer: peerEn
      ? ({ locale: 'en' as const, slug: peerEn.slug } as const)
      : null
  };
};
