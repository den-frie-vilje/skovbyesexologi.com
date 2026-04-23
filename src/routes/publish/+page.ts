/**
 * The `/publish` page is the "push staging → production" button for
 * non-technical editors. It's a CLIENT-side interactive page — it
 * reads Sveltia's stored OAuth token from `localStorage` and talks
 * directly to the GitHub API (compare + merges endpoints). None of
 * that makes sense during prerender, and there's no meaningful
 * static HTML to bake, so:
 *   • prerender off — fetches happen in the browser
 *   • csr on (default) — we need the reactive UI
 *
 * Not indexed (see the `robots.txt` route, which Disallows `/publish/`
 * in production, and returns Disallow:/ globally in staging). A
 * belt-and-braces `<meta name="robots" content="noindex">` ships
 * in the page's head.
 */
export const prerender = false;
