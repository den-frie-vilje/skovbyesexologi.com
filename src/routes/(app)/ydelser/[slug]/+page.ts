/**
 * Danish service detail routes — one prerendered page per service,
 * addressed at `/ydelser/{slug}` where `slug` is the per-locale URL
 * segment declared inside each `src/content/services/da/*.json`.
 *
 * The English twin lives under `/en/services/{peerSlug}` (see that
 * route's `+page.ts`). A service's DA + EN pages pair by the stable
 * `id` field (= content filename, e.g. `terapi.json` → id `terapi`),
 * NOT by slug, since slugs translate.
 *
 * This file is deliberately thin — the service-by-slug lookup, peer
 * resolution, and altHref/altLocale computation all live in
 * `$lib/content`'s `loadService()` so the EN mirror loader stays in
 * lockstep. `entries()` stays route-local because the slug universe
 * differs per locale.
 */

import { contentFor, loadService } from '$lib/content';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const prerender = true;

export const entries = () => {
  // Enumerate every DA service's URL slug so adapter-static writes
  // a /ydelser/<slug>/index.html for each at build time. Drifts
  // automatically as services are added or renamed in
  // src/content/services/da/.
  return contentFor('da').services.map((s) => ({ slug: s.slug }));
};

export const load: PageLoad = ({ params }) => {
  const result = loadService('da', params.slug);
  if (!result) throw error(404, 'Service not found');
  return result;
};
