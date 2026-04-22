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
  /*
    Each page returns its bilingual peer so the shared layout's
    language switcher can offer a direct link to the other-locale
    version of the current page. On the homepage this is trivial:
    DA ↔ EN just maps `/` ↔ `/en`. Service detail pages compute
    their peer via stable `service.id` lookup — see their +page.ts.
  */
  const altLocale: Locale = locale === 'en' ? 'da' : 'en';
  const altHref = altLocale === 'en' ? '/en' : '/';
  return { locale, altLocale, altHref };
};
