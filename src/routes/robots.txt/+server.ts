import type { RequestHandler } from './$types';
import { SITE_URL } from '$lib/seo/structured-data';

export const prerender = true;

export const GET: RequestHandler = () => {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
