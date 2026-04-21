/**
 * Param matcher for the optional [[lang=locale]] segment.
 *
 * Matches only `en` so the URL space is:
 *   /           → Danish (no prefix, preserves existing SEO equity)
 *   /en         → English
 *
 * Danish is the default and intentionally prefix-less. Navigating to
 * /da/… returns 404; if that becomes a real problem we'll add a
 * hooks.server.ts redirect (301 /da/… → /…).
 *
 * When adding more locales, include them here AND in the locales
 * array in src/lib/content/index.ts.
 */
import type { ParamMatcher } from '@sveltejs/kit';

export const match: ParamMatcher = (param) => param === 'en';
