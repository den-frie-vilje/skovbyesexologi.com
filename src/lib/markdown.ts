/**
 * Markdown → HTML for CMS-authored prose (service detail `body`).
 *
 * Trust boundary: the markdown is FIRST-PARTY — authored by the editor
 * through the GitHub-backed Sveltia admin and baked into the static
 * build at prerender time. It is no more privileged than the rest of
 * the repo's source, so `{@html}` of this output carries the same trust
 * as the JSON content already rendered into the page. No runtime
 * user-generated markdown flows through here; if that ever changes,
 * add a sanitiser (DOMPurify) at the boundary.
 *
 * Editorial shape (kept deliberately small so the CMS stays simple):
 *   - **bold**, *italic*, [links](https://…)
 *   - two heading levels only — `##` and `###`. Any `#` is clamped up
 *     to `##` so a body can never emit a second page-level <h1>
 *     (the page title owns the only <h1>).
 *   - *italic inside a heading* renders as the site's accent-underline
 *     emphasis (the same `<em>` the hero + manifest use); in body text
 *     it stays plain italic. The split is purely CSS — see
 *     `ServicePage.svelte` `.s-body :is(h2, h3) em`.
 */
import { marked } from 'marked';

marked.use({
  gfm: true,
  // Clamp every heading into the two-level [h2, h3] band: depth 1–2 → 2,
  // depth ≥3 → 3. Mutating `depth` here (pre-render) makes the default
  // renderer emit the clamped tag — version-stable across marked
  // releases, unlike overriding `renderer.heading`.
  walkTokens(token) {
    if (token.type === 'heading') {
      token.depth = token.depth <= 2 ? 2 : 3;
    }
  }
});

/** Render a service `body` markdown string to an HTML fragment. */
export function renderServiceBody(md: string): string {
  return marked.parse(md.trim(), { async: false });
}
