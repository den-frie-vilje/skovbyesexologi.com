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
 * The DA and EN variants of the same page often have DIFFERENT
 * URL segments (slugs are translated per locale — "terapi"
 * vs "therapy", "intimitetskoordinering" vs "intimacy-coordination"),
 * so each `Page` carries an explicit per-locale `paths` record
 * rather than a single shared suffix that's just prefixed with
 * `/en`.
 *
 * Deliberately NO <lastmod>, <changefreq>, or <priority>:
 * changefreq/priority are ignored by Google, and the only lastmod
 * this build could emit honestly would be the build date stamped
 * on every URL — which claims everything changed on every deploy.
 * Google ignores lastmod it can't trust, and a per-file git date
 * isn't reachable here (CI builds from a shallow checkout, and
 * the promote flow squash-merges to main, collapsing history).
 * Omitting the optional tags entirely is the honest shape; the
 * <urlset> stays purely derived from content + env.
 *
 * `prerender = true` bakes the XML into the static build so hosts
 * serve it like any other file. Services enumerate from
 * `$lib/content` at build time — drifts automatically as services
 * are added or renamed.
 */

import type { RequestHandler } from './$types';
import { contentFor, DEFAULT_LOCALE, LOCALES, type Locale } from '$lib/content';
import { SITE_URL } from '$lib/seo/structured-data';

export const prerender = true;

type Page = {
  /** Per-locale site-relative paths. Both keys required so each
   *  <url> can cross-reference its alternate. Use `/` for DA root
   *  and `/en` for EN root. */
  paths: Record<Locale, string>;
};

/*
  Static pages — currently just the bilingual homepage. Anything
  added here must have a path in BOTH locales; if a page is
  single-locale the alt link would point at a 404.
*/
const STATIC_PAGES: Page[] = [{ paths: { da: '/', en: '/en' } }];

/*
  Per-service pages — one entry per DA service, paired with its EN
  twin by stable `service.id` (the content filename, e.g.
  `terapi.json` → id `terapi`). If a DA service has no EN peer
  (shouldn't happen in practice since content/en mirrors
  content/da), the entry is skipped rather than emitted with a
  broken alternate.
*/
function servicePages(): Page[] {
  const daServices = contentFor('da').services;
  const enServices = contentFor('en').services;

  return daServices.flatMap((da) => {
    const en = enServices.find((s) => s.id === da.id);
    if (!en) return [];
    return [
      {
        paths: {
          da: `/ydelser/${da.slug}`,
          en: `/en/services/${en.slug}`
        }
      }
    ];
  });
}

function fullUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

export const GET: RequestHandler = () => {
  const pages: Page[] = [...STATIC_PAGES, ...servicePages()];

  const urls = pages
    .flatMap((page) =>
      LOCALES.map((locale) => {
        const loc = fullUrl(page.paths[locale]);
        const alternates = LOCALES.map(
          (alt) =>
            `    <xhtml:link rel="alternate" hreflang="${alt}" href="${fullUrl(page.paths[alt])}" />`
        ).join('\n');
        const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${fullUrl(page.paths[DEFAULT_LOCALE])}" />`;
        return `  <url>
    <loc>${loc}</loc>
${alternates}
${xDefault}
  </url>`;
      })
    )
    .join('\n');

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
