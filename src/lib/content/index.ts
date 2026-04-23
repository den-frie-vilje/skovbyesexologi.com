/**
 * Typed content loader with multi-locale support.
 *
 * Content layout — Sveltia CMS convention:
 *
 *   src/content/
 *     site.{da,en}.json          ← single-file sections use a
 *     contact.{da,en}.json          per-locale filename suffix
 *     bio.{da,en}.json              (Sveltia's i18n `file:` pattern
 *     home.{da,en}.json              with `{{locale}}` placeholder).
 *     services/
 *       {da,en}/*.json           ← folder collection uses
 *                                    multiple_folders with locale
 *                                    as a subdirectory of the
 *                                    collection folder.
 *
 * Files are imported at build time via Vite — zero runtime parsing.
 *
 * Consumers: prefer `contentFor(locale)` to get a per-locale bundle.
 * The DA bundle is also re-exported as top-level `site`, `contact`,
 * `bio`, `home`, `services` for convenience and backwards-compat
 * with any call site that doesn't care about locale (e.g. the
 * sitemap route).
 *
 * Grouping principle: each section's strings live in the same JSON
 * object as its data. UI labels belong to the section that renders
 * them — nothing floats in a catch-all `ui` bucket.
 */

import type { SectionStage, StageConfig } from '$lib/stage/poses';

// ---- DA (default) ----
import siteDa from '../../content/site.da.json';
import contactDa from '../../content/contact.da.json';
import bioDa from '../../content/bio.da.json';
import homeDa from '../../content/home.da.json';

// ---- EN ----
import siteEn from '../../content/site.en.json';
import contactEn from '../../content/contact.en.json';
import bioEn from '../../content/bio.en.json';
import homeEn from '../../content/home.en.json';

// ---- types ----

export const LOCALES = ['da', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'da';

/** Site-wide metadata. `footerCopyright` is a template with tokens:
 *  `{year}`, `{name}`, `{cvr}` — the template render lives near its use. */
export type Site = {
  name: string;
  lang: string;
  tagline: string;
  leadIn: string;
  footerCopyright: string;
};

/** Everything in the contact section: the structural data (email, phone…)
 *  plus the labels, heading, and lede that wrap it. */
export type Contact = {
  label: string;
  heading: string;
  lede: string;
  email: string;
  phone: string;
  address: string;
  cvr: string;
  hours: string;
  responseTime: string;
  fieldLabels: {
    email: string;
    phone: string;
    address: string;
    hours: string;
  };
};

/** Everything in the bio section. `body` stays a string[] until a
 *  markdown migration lands. */
export type Bio = {
  label: string;
  heading: string;
  pronouns: string;
  portraitAlt: string;
  body: string[];
};

/** Action button on a service card. */
export type ServiceCTA = {
  label: string;
  href: string;
  kind?: 'primary' | 'secondary';
};

/** Studio credit / client logo. */
export type StudioCredit = {
  name: string;
  logo: string;
  url?: string;
};

export type Testimonial = { quote: string; source: string };

/** Which narrative chapter a service belongs to. Maps 1:1 to the
 *  homepage's chapterMode (therapy = 0, konsulent = 1) and drives
 *  the service detail page's palette: cool bone + iridescent in
 *  terapi, warm bone + chrome in konsulent. */
export type ServiceChapter = 'terapi' | 'konsulent';

export type Service = {
  /** Stable cross-locale identifier — derived from the content
   *  filename (`terapi.json` → `id: "terapi"`). Used to pair a
   *  service's DA and EN versions for hreflang / language switching.
   *  Never appears in a URL; `slug` is the per-locale URL segment. */
  id: string;
  /** Per-locale URL segment, e.g. `terapi` in DA, `therapy` in EN.
   *  Editable in Sveltia; must be unique within its locale. */
  slug: string;
  number: string;
  title: string;
  kicker: string;
  blurb: string;
  bullets: string[];
  /** Labels for optional sub-blocks live alongside their data so they
   *  translate with the service. */
  supportsLabel?: string;
  supports?: string[];
  /** One or more client testimonials for this service. Rendered via
   *  the shared `<Testimonials>` component, which switches layout
   *  based on count (single → featured pull-quote; 2–3 → grid;
   *  4+ → horizontal scroll). Previously `testimonial` (singular);
   *  the array form lets a service accumulate quotes over time
   *  without a schema change. */
  testimonials?: Testimonial[];
  cta?: ServiceCTA;
  studiosLabel?: string;
  studios?: StudioCredit[];
  /** Which palette the service detail page inherits from the
   *  homepage (therapy chapter I vs konsulent chapter II). */
  chapter: ServiceChapter;
  /** FlodStage configuration for the service detail page. Typically
   *  one of the three elements uses the `fullBleed` pose as a
   *  background wash, with the others `offstage`. */
  stage: StageConfig;
};

export type NavLink = {
  label: string;
  href: string;
  /** Optional ordinal shown as a mono prefix (`01`, `02`, …) —
   *  used by the burger-menu list to echo the numbered service
   *  sections on the homepage. Omit for non-numbered items
   *  (e.g. the trailing Contact link). */
  num?: string;
};

export type HomeHero = {
  name: string;
  city: string;
  /** Three-piece hero statement: `<start> <end><em>em</em>.` */
  statementStart: string;
  statementEnd: string;
  statementEm: string;
  attribution: string;
  scrollLabel: string;
};

export type HomeNameSection = {
  eyebrow: string;
  firstName: string;
  lastName: string;
  pronouns: string;
  roleLine: string;
  roleSub: string;
};

export type ChapterHeader = {
  mark: string;
  title: string;
  lede: string;
};

export type ManifestEntry = { word: string; text: string };
export type HomeManifest = { label: string; items: ManifestEntry[] };

export type RitualStep = { n: string; title: string; body: string };
export type HomeRitual = { label: string; subtitle: string; steps: RitualStep[] };

export type HomeList = { label: string; items: string[] };

export type HomeTestimonials = { label: string; items: Testimonial[] };

export type HomeStage = { sections: SectionStage[] };

/** Homepage content, grouped by section in the order it renders. */
export type HomePage = {
  nav: NavLink[];
  hero: HomeHero;
  nameSection: HomeNameSection;
  chapter1: ChapterHeader;
  manifest: HomeManifest;
  ritual: HomeRitual;
  forPersonal: HomeList;
  chapter2: ChapterHeader;
  pillQuote: string;
  forWork: HomeList;
  /** Curated featured testimonials — a mix across services rather
   *  than per-service, shown between the bio and contact sections.
   *  Optional: an empty array or missing field hides the section. */
  testimonials?: HomeTestimonials;
  stage: HomeStage;
};

/** Complete per-locale content bundle. */
export type LocaleBundle = {
  site: Site;
  contact: Contact;
  bio: Bio;
  home: HomePage;
  services: Service[];
};

// ---- services (globbed per locale) ----

/*
  Content files don't carry their own `id` field — the JSON is
  kept as lean as possible for the Sveltia editor. Instead the
  filename is the stable cross-locale identifier: both
  `da/services/terapi.json` and `en/services/terapi.json` load as
  `id: "terapi"`, even though their `slug` fields differ
  (`terapi` in DA, `therapy` in EN).
*/
type RawServiceModule = { default: Omit<Service, 'id'> };

const daServiceModules = import.meta.glob<RawServiceModule>(
  '../../content/services/da/*.json',
  { eager: true }
);
const enServiceModules = import.meta.glob<RawServiceModule>(
  '../../content/services/en/*.json',
  { eager: true }
);

function idFromPath(path: string): string {
  const match = path.match(/\/([^/]+)\.json$/);
  return match ? match[1] : 'unknown';
}

function resolveServices(modules: Record<string, RawServiceModule>): Service[] {
  return Object.entries(modules)
    .map(([path, mod]) => ({ id: idFromPath(path), ...mod.default }))
    .sort((a, b) => a.number.localeCompare(b.number));
}

// ---- bundles ----

const bundles: Record<Locale, LocaleBundle> = {
  da: {
    site: siteDa as Site,
    contact: contactDa as Contact,
    bio: bioDa as Bio,
    home: homeDa as HomePage,
    services: resolveServices(daServiceModules)
  },
  en: {
    site: siteEn as Site,
    contact: contactEn as Contact,
    bio: bioEn as Bio,
    home: homeEn as HomePage,
    services: resolveServices(enServiceModules)
  }
};

/** Return the full content bundle for a locale. Unknown locales fall
 *  back to the default (Danish). */
export function contentFor(locale: Locale | string | undefined): LocaleBundle {
  const key = (locale && (LOCALES as readonly string[]).includes(locale) ? locale : DEFAULT_LOCALE) as Locale;
  return bundles[key];
}

/** Service lookup within a given locale. */
export function serviceBySlug(locale: Locale | string | undefined, slug: string): Service | undefined {
  return contentFor(locale).services.find((s) => s.slug === slug);
}

/** Service lookup by stable cross-locale id (= filename). Used to
 *  resolve a service's peer in a different locale for hreflang and
 *  language-switch links. */
export function serviceById(locale: Locale | string | undefined, id: string): Service | undefined {
  return contentFor(locale).services.find((s) => s.id === id);
}

/** Locale-specific detail-page path for a service slug. Matches the
 *  route tree: DA at `/ydelser/{slug}`, EN at `/en/services/{slug}`. */
function servicePath(locale: Locale, slug: string): string {
  return locale === 'en' ? `/en/services/${slug}` : `/ydelser/${slug}`;
}

/**
 * Shape returned from `loadService`. The route wrapper spreads
 * this straight into its `load()` return so `$page.data` carries
 * `locale`, `altLocale`, `altHref` (consumed by the shared
 * `(app)/+layout.svelte` for the DA|EN switcher), plus `service`
 * + `peer` for `<ServicePage>` / `<SeoHead>`.
 */
export type LoadServiceResult = {
  locale: Locale;
  altLocale: Locale;
  altHref: string;
  service: Service;
  peer: { locale: Locale; slug: string } | null;
};

/**
 * Shared loader body for the two service-detail routes
 * (`/ydelser/[slug]` and `/en/services/[slug]`). Returns `null`
 * when the slug doesn't resolve in the requested locale — the
 * caller is responsible for mapping that to a 404 via SvelteKit's
 * `error()` helper. `entries()` stays route-local because the
 * slug universe differs by locale.
 */
export function loadService(locale: Locale, slug: string): LoadServiceResult | null {
  const service = contentFor(locale).services.find((s) => s.slug === slug);
  if (!service) return null;

  // Peer lives at the same filename in the other locale — look it
  // up by stable cross-locale id so hreflang + language-switcher
  // pairing keeps working even when slugs are translated.
  const otherLocale: Locale = locale === 'en' ? 'da' : 'en';
  const peerService = contentFor(otherLocale).services.find((s) => s.id === service.id);
  const peer: LoadServiceResult['peer'] = peerService
    ? { locale: otherLocale, slug: peerService.slug }
    : null;

  // altHref powers the header DA|EN switcher: land on the peer
  // page when one exists, otherwise fall back to the other-locale
  // homepage so the switcher is never broken.
  const altHref = peer ? servicePath(peer.locale, peer.slug) : homePath(otherLocale);

  return {
    locale,
    altLocale: otherLocale,
    altHref,
    service,
    peer
  };
}

/** Locale-specific homepage path. `/` for DA (default locale,
 *  no prefix), `/en` for EN. */
function homePath(locale: Locale): string {
  return locale === 'en' ? '/en' : '/';
}

/**
 * Primary navigation links for the burger menu. One entry per
 * service (pointing at the locale-appropriate detail page) plus a
 * final Contact anchor (fragment — resolves to `#kontakt` on
 * whichever page the user is on). Labels come from each service's
 * `title`; slugs come from `slug`; the URL prefix switches by
 * locale.
 */
export function primaryNav(
  locale: Locale | string | undefined
): NavLink[] {
  const key = (locale && (LOCALES as readonly string[]).includes(locale)
    ? locale
    : DEFAULT_LOCALE) as Locale;
  const bundle = bundles[key];
  const servicePrefix = key === 'en' ? '/en/services' : '/ydelser';
  return [
    ...bundle.services.map((s) => ({
      label: s.title,
      href: `${servicePrefix}/${s.slug}`,
      // Echo each service's homepage section number so the burger
      // list numbering matches the scroll-page numbering.
      num: s.number
    })),
    // Contact is not a numbered section — omit `num` so the burger
    // renders the entry without a mono prefix.
    { label: bundle.contact.label, href: '#kontakt' }
  ];
}

/** Render the site's footer-copyright template with live values. */
export function renderFooterCopyright(site: Site, contact: Contact, now = new Date()): string {
  return site.footerCopyright
    .replace('{year}', String(now.getFullYear()))
    .replace('{name}', site.name)
    .replace('{cvr}', contact.cvr);
}

// ---- legacy top-level exports (DA) — used by locale-unaware callers ----

export const site = bundles.da.site;
export const contact = bundles.da.contact;
export const bio = bundles.da.bio;
export const home = bundles.da.home;
export const services = bundles.da.services;
