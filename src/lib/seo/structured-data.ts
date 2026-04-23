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

/** Extract the public URLs from a `contact.socials` list, ready
 *  for a schema.org `sameAs` property. Entries without a URL are
 *  filtered so empty placeholders in the content JSON don't emit
 *  broken `sameAs` references. Returns `undefined` when there's
 *  nothing to emit — caller should spread-conditionally so the
 *  key is omitted rather than present as an empty array (Google's
 *  rich-results tester flags empty arrays as suspicious). */
function sameAsUrls(contact: Contact): string[] | undefined {
  const urls = (contact.socials ?? [])
    .map((s) => s.url?.trim())
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
  return urls.length > 0 ? urls : undefined;
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

  // `sameAs` signals entity consolidation to search engines: same
  // URLs emitted on both the LocalBusiness and the Person nodes
  // because the practice and the practitioner share these
  // profiles (single-practitioner business).
  const sameAs = sameAsUrls(contact);

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
    areaServed: { '@type': 'Country', name: 'Denmark' },
    ...(sameAs && { sameAs })
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
    knowsLanguage: ['da', 'en'],
    ...(sameAs && { sameAs })
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

/* ==================================================================
 * PAGE-LEVEL SEO HEAD — typed shape for <SeoHead>
 * ==================================================================
 *
 * Single `PageSeo` object per page. The view layer (`<SeoHead>`) is
 * dumb rendering — all the locale-specific URL / string decisions
 * live in the two `buildXxxPageSeo` builders below so the head
 * emission stays consistent across home, DA service, and EN service
 * pages.
 */

export type PageSeoImage = {
  /** Absolute URL. */
  url: string;
  alt: string;
  width: number;
  height: number;
  /** MIME type, e.g. `image/jpeg`. */
  type: string;
};

export type PageSeo = {
  /** `<title>` contents. May differ from `og.title` (home uses a
   *  short brand name for OG, longer `name · tagline` for <title>). */
  title: string;
  /** `<meta name="description">` — crawler snippet. */
  description: string;
  /** `<meta name="author">`. */
  author: string;
  /** `<meta name="theme-color">` for mobile address-bar tint. */
  themeColor: string;
  /** Absolute canonical URL for this page. */
  canonical: string;
  /** Hreflang alternates — all three emitted in this order every time. */
  alternates: {
    da: string;
    en: string;
    /** Always the DA URL (DA is the default locale). */
    xDefault: string;
  };
  og: {
    type: 'website';
    siteName: string;
    title: string;
    description: string;
    /** Full locale tag, e.g. `da_DK` / `en_US`. */
    locale: string;
    localeAlternate: string;
    url: string;
    image: PageSeoImage;
  };
  twitter: {
    card: 'summary_large_image';
    title: string;
    description: string;
    image: string;
  };
  /** Pre-serialised JSON-LD string, ready for `{@html}` rendering. */
  jsonLd: string;
};

/** Facebook/OG locale tag derived from a 2-letter locale code. */
function ogLocaleFor(locale: Locale): string {
  return locale === 'en' ? 'en_US' : 'da_DK';
}

type BuildHomePageSeoInput = {
  locale: Locale;
  site: Site;
  bio: Bio;
  contact: Contact;
  services: Service[];
};

/** Assemble the `PageSeo` for the bilingual homepage (`/` or `/en`).
 *
 *  Homepage copy conventions (preserved from the pre-refactor state):
 *    • `<title>` = `${site.name} · ${site.tagline}` (long, descriptive)
 *    • `<meta description>` = `${site.leadIn} — ${service titles}` (long,
 *      mentions every service so the SERP snippet advertises the range)
 *    • `og:title` = `site.name` (short; OG previews favour brevity)
 *    • `og:description` = `site.tagline` (short)
 *    • `og:image:alt` = `site.name`
 *    • JSON-LD = full `@graph` with business + person + every service
 */
export function buildHomePageSeo(input: BuildHomePageSeoInput): PageSeo {
  const { locale, site, bio, contact, services } = input;
  const canonical = homeUrl(locale);

  const jsonLd = JSON.stringify(
    buildSiteJsonLd({ locale, site, bio, contact, services, pageUrl: canonical })
  );
  const ogImageUrl = `${SITE_URL}/img/og/home.${locale}.jpg`;

  return {
    title: `${site.name} · ${site.tagline}`,
    description: `${site.leadIn} — ${services.map((s) => s.title).join(' · ')}`,
    author: site.name,
    themeColor: '#f3ede2',
    canonical,
    alternates: {
      da: homeUrl('da'),
      en: homeUrl('en'),
      xDefault: homeUrl('da')
    },
    og: {
      type: 'website',
      siteName: site.name,
      title: site.name,
      description: site.tagline,
      locale: ogLocaleFor(locale),
      localeAlternate: ogLocaleFor(locale === 'en' ? 'da' : 'en'),
      url: canonical,
      image: {
        url: ogImageUrl,
        alt: site.name,
        width: 1200,
        height: 630,
        type: 'image/jpeg'
      }
    },
    twitter: {
      card: 'summary_large_image',
      title: site.name,
      description: site.tagline,
      image: ogImageUrl
    },
    jsonLd
  };
}

type BuildServicePageSeoInput = {
  locale: Locale;
  site: Site;
  bio: Bio;
  contact: Contact;
  service: Service;
  /** Stable service id of the peer in the other locale, used to
   *  construct the hreflang alternate. `null` when no peer exists
   *  (shouldn't happen in practice — content/en mirrors content/da). */
  peer: { locale: Locale; slug: string } | null;
  /** Localised label for the "Home" breadcrumb item ("Forsiden" / "Home"). */
  homeLabel: string;
};

/** Assemble the `PageSeo` for a single service detail page.
 *
 *  Service-page copy conventions (preserved from the pre-refactor state):
 *    • `<title>` = `og:title` = `twitter:title` = `${service.title} · ${site.name}`
 *    • `<meta description>` = `og:description` = `twitter:description` =
 *      `service.blurb` (falls back to `site.tagline` if blurb missing).
 *    • `og:image` = per-service JPEG at `/img/og/{service.id}.{locale}.jpg`.
 *    • `og:image:alt` = `service.title`.
 *    • JSON-LD = business + person + THIS service + BreadcrumbList.
 *
 *  Hreflang alternates always emit da, en, x-default in that order
 *  regardless of the page's own locale — fixes the inconsistency
 *  where EN pages used to emit en-first.
 */
export function buildServicePageSeo(input: BuildServicePageSeoInput): PageSeo {
  const { locale, site, bio, contact, service, peer, homeLabel } = input;
  const canonical = servicePageUrl(locale, service.slug);
  const pageTitle = `${service.title} · ${site.name}`;
  const pageDescription = service.blurb || site.tagline;
  const ogImageUrl = `${SITE_URL}/img/og/${service.id}.${locale}.jpg`;

  const jsonLd = JSON.stringify(
    buildServicePageJsonLd({
      locale,
      site,
      bio,
      contact,
      service,
      pageUrl: canonical,
      homeLabel
    })
  );

  // Hreflang alternates: canonical for the current locale, the peer
  // URL for the other locale (or homeUrl fallback), x-default → DA.
  const thisLocaleUrl = canonical;
  const otherLocale: Locale = locale === 'en' ? 'da' : 'en';
  const otherLocaleUrl = peer ? servicePageUrl(peer.locale, peer.slug) : homeUrl(otherLocale);

  return {
    title: pageTitle,
    description: pageDescription,
    author: site.name,
    themeColor: '#f3ede2',
    canonical,
    alternates: {
      da: locale === 'da' ? thisLocaleUrl : otherLocaleUrl,
      en: locale === 'en' ? thisLocaleUrl : otherLocaleUrl,
      xDefault: locale === 'da' ? thisLocaleUrl : otherLocaleUrl
    },
    og: {
      type: 'website',
      siteName: site.name,
      title: pageTitle,
      description: pageDescription,
      locale: ogLocaleFor(locale),
      localeAlternate: ogLocaleFor(otherLocale),
      url: canonical,
      image: {
        url: ogImageUrl,
        alt: service.title,
        width: 1200,
        height: 630,
        type: 'image/jpeg'
      }
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      image: ogImageUrl
    },
    jsonLd
  };
}
