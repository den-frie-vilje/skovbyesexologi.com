/**
 * Typed content loader.
 *
 * Structured content lives under `src/content/{locale}/` as JSON files and
 * is imported at build time via Vite. Zero parsing cost at runtime.
 *
 * Currently Danish-only. Phase 2 adds `src/content/en/` with a locale-aware
 * resolver that picks the right tree based on the URL prefix.
 */

import type { SectionStage } from '$lib/stage/poses';

import siteRaw from '../../content/da/site.json';
import contactRaw from '../../content/da/contact.json';
import bioRaw from '../../content/da/bio.json';
import homeRaw from '../../content/da/home.json';

// ---- types ----

/** Site-level metadata shared across all pages. */
export type Site = {
  name: string;
  lang: string;
  tagline: string;
  leadIn: string;
};

export type Contact = {
  email: string;
  phone: string;
  address: string;
  cvr: string;
  hours: string;
  responseTime: string;
};

export type Bio = {
  heading: string;
  pronouns: string;
  /** Paragraphs. Plain strings today; may upgrade to markdown when we migrate to MDX. */
  body: string[];
};

/** Action button on a service card. `href` is freeform so editors can use
 *  `mailto:`, `tel:`, or an external booking-service URL. `kind` affects
 *  styling only — content stays the same across primary/secondary. */
export type ServiceCTA = {
  label: string;
  href: string;
  kind?: 'primary' | 'secondary';
};

/** Studio credit / client logo. `logo` is a path relative to the site root
 *  (typically `/img/studios/<slug>.svg`). `url` is optional — when set, the
 *  logo links out to the studio's site. */
export type StudioCredit = {
  name: string;
  logo: string;
  url?: string;
};

export type Service = {
  slug: string;
  number: string;
  title: string;
  kicker: string;
  blurb: string;
  bullets: string[];
  supports?: string[];
  testimonial?: { quote: string; source: string };
  cta?: ServiceCTA;
  studios?: StudioCredit[];
};

export type ManifestEntry = { word: string; text: string };
export type RitualStep = { n: string; title: string; body: string };
export type NavLink = { label: string; href: string };

/** Homepage-specific content + per-section stage configuration. */
export type HomePage = {
  pillQuote: string;
  manifest: ManifestEntry[];
  ritual: RitualStep[];
  forPersonal: string[];
  forWork: string[];
  nav: NavLink[];
  sections: SectionStage[];
};

// ---- exports ----

export const site = siteRaw as Site;
export const contact = contactRaw as Contact;
export const bio = bioRaw as Bio;
export const home = homeRaw as HomePage;

// Services are globbed so adding a new `<slug>.json` file auto-registers.
// The service's own `number` field (e.g. "01", "02", …) drives display
// order rather than the filename — this lets Sveltia create services
// with plain slug-based filenames (no NN- prefix) without disturbing
// the sort.
const serviceModules = import.meta.glob<{ default: Service }>(
  '../../content/da/services/*.json',
  { eager: true }
);

export const services: Service[] = Object.values(serviceModules)
  .map((mod) => mod.default)
  .sort((a, b) => a.number.localeCompare(b.number));

export function serviceBySlug(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}
