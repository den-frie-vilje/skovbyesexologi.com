/**
 * OG-image route — one prerendered page per (slug × locale) combo,
 * sized 1200×630 in the template. The `scripts/gen-og-images.ts`
 * Playwright script navigates to each URL and screenshots to PNG.
 *
 * Two flavours of OG image:
 *   • `home` — the site's top-level unfurl. Title is the proprietor's
 *     name with the family name highlighted (the "Skovbye" chartreuse
 *     underline, echoing the live hero's em).
 *   • one per service id (terapi, intimacy-coordination, aeldrepleje,
 *     undervisning) — the title is the service's title, no em. Each
 *     service detail page references its matching PNG as `og:image`.
 *
 * Service slugs used in OG URLs are the *stable service id*
 * (filename), not the localised URL slug — so the OG URL stays the
 * same across locales even when the service slug differs in DA vs EN.
 */

import {
  contentFor,
  DEFAULT_LOCALE,
  type Locale,
  type ServiceChapter
} from '$lib/content';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const prerender = true;

/** The stable ids of services we render an OG image for. Matches the
 *  filenames under `src/content/{locale}/services/`. */
const SERVICE_IDS = ['terapi', 'intimacy-coordination', 'aeldrepleje', 'undervisning'] as const;
type ServiceId = (typeof SERVICE_IDS)[number];

/** `home` + each service id — this is the list adapter-static
 *  prerenders via the `entries()` hook below. */
const OG_SLUGS = ['home', ...SERVICE_IDS] as const;
type OgSlug = (typeof OG_SLUGS)[number];

export const entries = () => {
  // `undefined` optional lang = DA (prefix-less); explicit `en` = EN.
  const locales: (Locale | undefined)[] = [undefined, 'en'];
  return locales.flatMap((lang) =>
    OG_SLUGS.map((slug) => (lang ? { lang, slug } : { slug }))
  );
};

type OgData =
  | {
      kind: 'home';
      /** Proprietor's first name — plain serif. */
      title: string;
      /** Family name — italic + chartreuse highlight, echoing the
       *  live hero's em. */
      em: string;
      /** Palette chapter — home leans terapi (cool bone + iridescent). */
      chapter: ServiceChapter;
    }
  | {
      kind: 'service';
      /** Service title, rendered as the main h1. */
      title: string;
      /** Short audience tagline (`service.kicker`) shown below the
       *  title. Reads as the service's "who's this for" line —
       *  e.g. "solo · par · poly" for terapi, "film · tv · teater"
       *  for intimacy-coordination. */
      kicker: string;
      /** Service chapter — drives the OG's palette to match the
       *  site's terapi (cool + iridescent) vs konsulent (warm +
       *  chrome) scheme. */
      chapter: ServiceChapter;
    };

function dataForSlug(slug: OgSlug, locale: Locale): OgData {
  const bundle = contentFor(locale);
  const name = bundle.home.nameSection;
  if (slug === 'home') {
    return {
      kind: 'home',
      title: name.firstName,
      em: name.lastName,
      chapter: 'terapi'
    };
  }
  const service = bundle.services.find((s) => s.id === slug);
  if (!service) throw error(404, `Unknown service id: ${slug}`);
  return {
    kind: 'service',
    title: service.title,
    kicker: service.kicker,
    chapter: service.chapter
  };
}

export const load: PageLoad = ({ params }) => {
  const locale: Locale = params.lang === 'en' ? 'en' : DEFAULT_LOCALE;
  const slug = params.slug as OgSlug;
  if (!OG_SLUGS.includes(slug)) throw error(404, `Unknown OG slug: ${slug}`);
  return { locale, slug, ...dataForSlug(slug, locale) };
};
