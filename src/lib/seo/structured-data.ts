/**
 * Schema.org structured-data builder.
 *
 * Produces a single `@graph` document with nodes for the business
 * itself, Signe as a Person, and each service as a Service node —
 * all cross-linked via `@id`. Emit this as one `<script type=
 * "application/ld+json">` tag in the page head.
 *
 * When bilingual routing lands, pass the appropriate locale content
 * and the target page URL — this builder is already locale-aware
 * via `site.lang` on the input.
 */

import type { Bio, Contact, Service, Site } from '$lib/content';

export const SITE_URL = 'https://skovbyesexologi.com';

type BuildInput = {
  site: Site;
  bio: Bio;
  contact: Contact;
  services: Service[];
  /** Full URL of the current page, used as `url` on the business node. */
  pageUrl?: string;
};

/** Strip separators and parenthesis from the contact phone, returning
 *  an E.164-ish string suitable for `schema.org/telephone`. */
function toE164(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

/** Extract the person's name from a heading like "Signe Skovbye, grundlægger". */
function personName(bioHeading: string): string {
  return bioHeading.split(',')[0].trim();
}

export function buildSiteJsonLd(input: BuildInput): object {
  const { site, bio, contact, services } = input;
  const pageUrl = input.pageUrl ?? `${SITE_URL}/`;

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
    // Phase 2 EN scaffolding — keep both languages declared here so the
    // same graph serves both locales. If Signe adds more, update here.
    knowsLanguage: ['da', 'en']
  };

  const serviceNodes = services.map((s) => ({
    '@type': 'Service',
    '@id': `${SITE_URL}/#service-${s.slug}`,
    name: s.title,
    description: s.blurb,
    provider: { '@id': businessId },
    serviceType: s.title,
    areaServed: { '@type': 'Country', name: 'Denmark' },
    inLanguage: site.lang,
    url: `${SITE_URL}/#${s.slug}`,
    // Testimonial on the intimacy service → schema Review.
    ...(s.testimonial && {
      review: {
        '@type': 'Review',
        reviewBody: s.testimonial.quote,
        author: { '@type': 'Person', name: s.testimonial.source }
      }
    })
  }));

  return {
    '@context': 'https://schema.org',
    '@graph': [business, person, ...serviceNodes]
  };
}
