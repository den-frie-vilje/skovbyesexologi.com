/**
 * Dynamic sitemap.xml generator.
 *
 * Emits one <url> entry per prerendered route with `<lastmod>` set
 * to the build date. When bilingual routing lands, each entry
 * gains `<xhtml:link rel="alternate" hreflang="…" />` children for
 * the DA/EN variants plus `x-default`.
 *
 * `prerender = true` bakes the XML into the static build so hosts
 * serve it like any other file.
 */

import type { RequestHandler } from './$types';
import { SITE_URL } from '$lib/seo/structured-data';

export const prerender = true;

type Entry = {
  loc: string;
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
};

const entries: Entry[] = [
  { loc: '/', changefreq: 'monthly', priority: 1.0 }
  // Phase 2 — per-service detail pages land here when they exist:
  //   { loc: '/terapi' }, { loc: '/intimacy-coordination' }, …
];

export const GET: RequestHandler = () => {
  const lastmod = new Date().toISOString().slice(0, 10);

  const urls = entries
    .map(
      (e) => `  <url>
    <loc>${SITE_URL}${e.loc}</loc>
    <lastmod>${lastmod}</lastmod>${e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : ''}${e.priority !== undefined ? `\n    <priority>${e.priority.toFixed(1)}</priority>` : ''}
  </url>`
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
