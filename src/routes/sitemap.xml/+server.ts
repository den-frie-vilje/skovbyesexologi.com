/**
 * Dynamic sitemap.xml generator.
 *
 * Emits one <url> per (page × locale) pair with cross-referenced
 * `<xhtml:link rel="alternate" hreflang="…" />` children — the
 * preferred bilingual-SEO pattern per Google's hreflang docs:
 *
 *   Each <url> lists itself first, then *all* locale alternates
 *   (including itself), plus an x-default pointing at the Danish
 *   (canonical) version.
 *
 * `prerender = true` bakes the XML into the static build so hosts
 * serve it like any other file.
 */

import type { RequestHandler } from './$types';
import { SITE_URL } from '$lib/seo/structured-data';

export const prerender = true;

type Page = {
  /** Canonical path WITHOUT locale prefix. DA adds no prefix, EN adds `/en`. */
  path: string;
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
};

type Locale = 'da' | 'en';
const LOCALES: Locale[] = ['da', 'en'];
const DEFAULT_LOCALE: Locale = 'da';

const pages: Page[] = [
  { path: '/', changefreq: 'monthly', priority: 1.0 }
  // Phase 2 — per-service detail pages:
  //   { path: '/terapi' }, { path: '/intimacy-coordination' }, …
];

function localizedUrl(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return `${SITE_URL}${path}`;
  // EN prefix: /en/terapi, /en  (collapsing double-slashes for the root case)
  return `${SITE_URL}/${locale}${path}`.replace(/\/$/, '') || `${SITE_URL}/${locale}`;
}

export const GET: RequestHandler = () => {
  const lastmod = new Date().toISOString().slice(0, 10);

  const urls = pages.flatMap((page) =>
    LOCALES.map((locale) => {
      const loc = localizedUrl(locale, page.path);
      const alternates = LOCALES.map(
        (alt) => `    <xhtml:link rel="alternate" hreflang="${alt}" href="${localizedUrl(alt, page.path)}" />`
      ).join('\n');
      const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${localizedUrl(DEFAULT_LOCALE, page.path)}" />`;
      const meta = [
        `    <lastmod>${lastmod}</lastmod>`,
        page.changefreq ? `    <changefreq>${page.changefreq}</changefreq>` : null,
        page.priority !== undefined ? `    <priority>${page.priority.toFixed(1)}</priority>` : null
      ]
        .filter(Boolean)
        .join('\n');
      return `  <url>
    <loc>${loc}</loc>
${meta}
${alternates}
${xDefault}
  </url>`;
    })
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
