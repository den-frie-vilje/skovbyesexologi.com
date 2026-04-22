/**
 * Schema.org structured-data builder.
 *
 * Two emitters:
 *
 *   • `buildSiteJsonLd` — for the HOMEPAGE. Produces a single
 *     `@graph` with the business, Signe as a Person, and every
 *     service as a Service node (all cross-linked via `@id`).
 *     Each Service node's `url` points at the locale-appropriate
 *     detail page so crawlers discover them from the graph.
 *
 *   • `buildServicePageJsonLd` — for a SERVICE DETAIL PAGE.
 *     Emits the same business + person nodes (reinforces the
 *     business info on every page in the graph) plus a single
 *     Service node for this page, plus a BreadcrumbList
 *     (Home → Service) so search results can render a breadcrumb
 *     trail.
 *
 * Both emit the same overall `@context`; consumers serialise the
 * result as one `<script type="application/ld+json">` tag in the
 * page head. Locale is passed explicitly (DA service URLs use
 * `/ydelser/{slug}`, EN use `/en/services/{slug}`).
 */

import type { Bio, Contact, Locale, Service, Site } from '$lib/content';
import { env } from '$env/dynamic/public';

/*
  Reading PUBLIC_SITE_URL via `$env/dynamic/public` instead of the
  static variant: the static import fails at dev boot when no
  `.env.development` is on disk, because SvelteKit refuses to emit
  an export for a var that isn't declared at build time. Dynamic
  env proxies `process.env`, so a missing value is `undefined`
  rather than a hard module error — the fallback below then kicks
  in and dev works out of the box. Production + staging builds
  still read their respective `.env.[mode]` files at build time,
  so the canonical URL is baked into the prerendered output.
*/
function normalizeSiteUrl(raw: string | undefined): string {
  const fallback = 'https://skovbyesexologi.com';
  const value = (raw ?? '').trim() || fallback;
  return value.replace(/\/+$/, '');
}

export const SITE_URL = normalizeSiteUrl(env.PUBLIC_SITE_URL);

/** Per-locale detail-page URL for a service. DA lives at
 *  `/ydelser/{da-slug}`, EN at `/en/services/{en-slug}`. */
function servicePageUrl(locale: Locale, slug: string): string {
  return locale === 'en'
    ? `${SITE_URL}/en/services/${slug}`
    : `${SITE_URL}/ydelser/${slug}`;
}

/** Home-page URL per locale. Used for the business node's `url`
 *  and for breadcrumbs. */
function homeUrl(locale: Locale): string {
  return locale === 'en' ? `${SITE_URL}/en` : `${SITE_URL}/`;
}

/** Strip separators and parenthesis from the contact phone, returning
 *  an E.164-ish string suitable for `schema.org/telephone`. */
function toE164(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

/** Extract the person's name from a heading like "Signe Skovbye, grundlægger". */
function personName(bioHeading: string): string {
  return bioHeading.split(',')[0].trim();
}

/** Shared business + person nodes, emitted on both the homepage
 *  and each service detail page so every crawlable URL in the
 *  graph has the full business info. */
function businessAndPerson(
  site: Site,
  bio: Bio,
  contact: Contact,
  pageUrl: string
): { business: object; person: object; businessId: string; personId: string } {
  const businessId = `${SITE_URL}/#business`;
  const personId = `${SITE_URL}/#signe`;

  const business = {
    '@type': ['LocalBusiness', 'ProfessionalService'],
    '@id': businessId,
    name: site.name,
    url: pageUrl,
    telephone: toE164(contact.phone),
    email: contact.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: contact.address,
      addressCountry: 'DK'
    },
    // Danish CVR (VAT / company registration number) — schema.org uses
    // taxID as the general field for tax/registration identifiers.
    taxID: contact.cvr,
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '10:00',
        closes: '17:00'
      }
    ],
    founder: { '@id': personId },
    employee: { '@id': personId },
    inLanguage: site.lang,
    description: site.tagline,
    areaServed: { '@type': 'Country', name: 'Denmark' }
  };

  const person = {
    '@type': 'Person',
    '@id': personId,
    name: personName(bio.heading),
    jobTitle: site.tagline,
    description: bio.body.join(' '),
    worksFor: { '@id': businessId },
    pronouns: bio.pronouns,
    // Both locales declared up front so a DA-page graph also
    // surfaces EN capability (and vice versa). Update this if
    // the list of spoken languages changes.
    knowsLanguage: ['da', 'en']
  };

  return { business, person, businessId, personId };
}

/** Single Service node. Keyed by stable `service.id` in the
 *  global graph `@id`, with the locale-appropriate detail page
 *  URL as `url`. */
function serviceNode(locale: Locale, service: Service, businessId: string) {
  return {
    '@type': 'Service',
    '@id': `${SITE_URL}/#service-${service.id}`,
    name: service.title,
    description: service.blurb,
    provider: { '@id': businessId },
    serviceType: service.title,
    areaServed: { '@type': 'Country', name: 'Denmark' },
    inLanguage: locale,
    url: servicePageUrl(locale, service.slug),
    // Each testimonial becomes a schema Review. When multiple
    // testimonials are present, schema.org's `review` field accepts
    // an array of Review nodes, so we map all of them rather than
    // emitting only the first.
    ...(service.testimonials && service.testimonials.length > 0 && {
      review: service.testimonials.map((t) => ({
        '@type': 'Review',
        reviewBody: t.quote,
        author: { '@type': 'Person', name: t.source }
      }))
    })
  };
}

type BuildSiteInput = {
  locale: Locale;
  site: Site;
  bio: Bio;
  contact: Contact;
  services: Service[];
  /** Full URL of the current page — the business node's `url`
   *  field. Pass the canonical for the active locale, not the
   *  default-locale URL, so the DA and EN homepages advertise
   *  different canonicals. */
  pageUrl: string;
};

/** JSON-LD for the bilingual homepage. Graph contains business +
 *  person + every service node. */
export function buildSiteJsonLd(input: BuildSiteInput): object {
  const { locale, site, bio, contact, services, pageUrl } = input;
  const { business, person, businessId } = businessAndPerson(site, bio, contact, pageUrl);
  const serviceNodes = services.map((s) => serviceNode(locale, s, businessId));

  return {
    '@context': 'https://schema.org',
    '@graph': [business, person, ...serviceNodes]
  };
}

type BuildServiceInput = {
  locale: Locale;
  site: Site;
  bio: Bio;
  contact: Contact;
  service: Service;
  /** Full URL of this service detail page. Used as the business
   *  node's `url`, the Service node's `url`, and the terminal
   *  breadcrumb item. */
  pageUrl: string;
  /** Localised label for the "Home" breadcrumb item. Should match
   *  the visible back-link on the page ("Forsiden" / "Home"). */
  homeLabel: string;
};

/** JSON-LD for a service detail page. Graph contains business +
 *  person + THIS service + a BreadcrumbList (Home → Service). */
export function buildServicePageJsonLd(input: BuildServiceInput): object {
  const { locale, site, bio, contact, service, pageUrl, homeLabel } = input;
  const { business, person, businessId } = businessAndPerson(site, bio, contact, pageUrl);
  const thisService = serviceNode(locale, service, businessId);

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: homeLabel,
        item: homeUrl(locale)
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: service.title,
        item: pageUrl
      }
    ]
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [business, person, thisService, breadcrumb]
  };
}
