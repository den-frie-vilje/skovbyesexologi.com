/**
 * robots.txt — per-environment content.
 *
 * Production build (PUBLIC_ALLOW_INDEXING=true, default): allow
 * crawling, disallow the admin + publish tool pages, point at the
 * sitemap.
 *
 * Staging build (PUBLIC_ALLOW_INDEXING=false, set in
 * `.env.staging`): disallow everything so search engines don't
 * surface `signe.denfrievilje.dk` instead of the real domain. We
 * don't even advertise a sitemap here — there'd be nothing useful
 * at `/sitemap.xml` for crawlers since any URLs would be staging
 * duplicates of production content.
 *
 * Belt-and-braces:
 *   1. this file Disallows all on staging
 *   2. staging Web Station sends `X-Robots-Tag: noindex, nofollow`
 *      on every response (configured at the vhost level — see
 *      DEPLOY.md)
 *   3. the `/admin` and `/publish` pages set their own
 *      `<meta name="robots" content="noindex">` inside <svelte:head>
 */

import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { SITE_URL } from '$lib/seo/structured-data';

export const prerender = true;

export const GET: RequestHandler = () => {
  const allowIndexing = (env.PUBLIC_ALLOW_INDEXING ?? 'true').toLowerCase() !== 'false';

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
        '# Staging build — not intended for search engines.',
        'User-agent: *',
        'Disallow: /'
      ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
