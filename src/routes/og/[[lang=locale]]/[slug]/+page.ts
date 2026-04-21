/**
 * OG-image route — one prerendered page per (slug × locale) combo,
 * sized 1200×630 in the template. The `scripts/gen-og-images.ts`
 * Playwright script navigates to each URL and screenshots to PNG.
 *
 * Currently only the homepage OG variant exists (`slug = 'home'`).
 * Per-service OG variants slot in as additional entries when those
 * detail pages arrive (Phase 2 #5).
 */

import { DEFAULT_LOCALE, type Locale } from '$lib/content';
import type { PageLoad } from './$types';

export const prerender = true;

/** The set of OG slugs we render. Extend when adding new variants. */
const OG_SLUGS = ['home'] as const;
type OgSlug = (typeof OG_SLUGS)[number];

export const entries = () => {
  // `undefined` optional lang = DA (prefix-less); explicit `en` = EN.
  const locales: (Locale | undefined)[] = [undefined, 'en'];
  return locales.flatMap((lang) =>
    OG_SLUGS.map((slug) => (lang ? { lang, slug } : { slug }))
  );
};

export const load: PageLoad = ({ params }) => {
  const locale: Locale = params.lang === 'en' ? 'en' : DEFAULT_LOCALE;
  const slug = params.slug as OgSlug;
  return { locale, slug };
};
