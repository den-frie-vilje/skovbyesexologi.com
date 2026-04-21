/**
 * Admin route — Sveltia CMS host.
 *
 * Sveltia manages its own client-side routing via history.pushState,
 * which conflicts with SvelteKit's router. Disable CSR so SvelteKit
 * renders this page as a pre-baked static HTML and leaves the browser
 * alone — Sveltia runs completely standalone on this URL.
 *
 * Prerender locks the output into the static build so hosts serve it
 * the same way they serve the rest of the site.
 */
export const csr = false;
export const prerender = true;
