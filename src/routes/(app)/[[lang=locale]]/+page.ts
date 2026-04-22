/**
 * Load function for the homepage in both locales.
 *
 * URL space:
 *   /     → DA (no prefix)
 *   /en   → EN
 *
 * `entries` lists both variants explicitly so the static adapter
 * knows to prerender each — without this, the DA variant gets built
 * but /en won't unless something on the site links to it.
 */

import { DEFAULT_LOCALE, type Locale } from '$lib/content';
import type { PageLoad } from './$types';

export const prerender = true;

export const entries = () => [{}, { lang: 'en' as const }];

export const load: PageLoad = ({ params }) => {
  const locale: Locale = params.lang === 'en' ? 'en' : DEFAULT_LOCALE;
  return { locale };
};
