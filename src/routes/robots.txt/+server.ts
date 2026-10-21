/**
 * robots.txt — per-environment content.
 *
 * Production build (PUBLIC_ALLOW_INDEXING=true, default): allow
 * crawling, disallow the admin + publish tool pages, point at the
 * sitemap.
 *
 * Staging build (PUBLIC_ALLOW_INDEXING=false, set in
 * `.env.staging`): disallow everything so search engines don't
 * surface `skovbyesexologi-com.stage.denfrievilje.dk` instead of the real domain. We
 * don't even advertise a sitemap here — there'd be nothing useful
 * at `/sitemap.xml` for crawlers since any URLs would be staging
 * duplicates of production content.
 *
 * Belt-and-braces:
 *   1. this file leaves staging crawlable ON PURPOSE, disallowing only
 *      /admin/ and /publish/, so the noindex below is actually read.
 *      A crawler blocked by robots.txt never fetches the page and so
 *      never sees the noindex, and Google documents that such a URL
 *      can still be indexed from an inbound link (SC-1, nas-sites#45)
 *   2. deploy/Caddyfile.staging stamps `X-Robots-Tag: noindex,
 *      nofollow, noarchive, nosnippet` on every staging response —
 *      the PRIMARY strap, now that it can be read (in-repo, deploys with
 *      the stack — an earlier claim that the DSM vhost sent this
 *      header was measured false on 2026-07-30)
 *   3. the `/admin` and `/publish` pages set their own
 *      `<meta name="robots" content="noindex">` inside <svelte:head>
 */

import type { RequestHandler } from './$types';
import { PUBLIC_ALLOW_INDEXING } from '$env/static/public';
import { SITE_URL } from '$lib/seo/structured-data';

export const prerender = true;

export const GET: RequestHandler = () => {
  /* Static env, not dynamic — mode-file-sourced and loud on a
     missing declaration, so this can't silently default to the
     production Allow-all variant again (staging images shipped
     exactly that until 2026-07-29; see structured-data.ts).
     FAIL-CLOSED per the DFV canonical per-mode pattern: only the
     literal "true" bakes the indexable variant — an empty or
     malformed declaration disallows, it never opens. */
  const allowIndexing = PUBLIC_ALLOW_INDEXING === 'true';

  const body = allowIndexing
    ? [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin/',
        'Disallow: /publish/',
        '',
        `Sitemap: ${SITE_URL}/sitemap.xml`
      ].join('\n')
    : [
        '# Staging build. Crawlable ON PURPOSE, so that the noindex on every',
        '# response is actually read. Nothing here may enter an index.',
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin/',
        'Disallow: /publish/'
      ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
