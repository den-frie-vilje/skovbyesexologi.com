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

/**
 * Split paragraph-shaped markdown (blank-line-separated) into an array
 * of INLINE-rendered HTML strings — one per paragraph. Used where the
 * surrounding component owns the <p> elements (e.g. the bio's
 * per-paragraph staggered reveal) but the text should still carry inline
 * markdown (bold, italic, links). Block syntax (headings, lists) is not
 * applied here by design — these are prose paragraphs.
 */
export function renderInlineParagraphs(md: string): string[] {
  return md
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    // parseInline is synchronous (async defaults off) — the union return
    // type includes Promise, so assert the string branch.
    .map((p) => marked.parseInline(p) as string);
}

/**
 * Inline-render a single markdown string to HTML — no block wrapper, no
 * line splitting. For one-line fields that allow only inline marks
 * (e.g. a manifest line where one word carries the accent emphasis).
 */
export function renderInline(md: string): string {
  return marked.parseInline(md.trim()) as string;
}

/**
 * Inline-render markdown split on EVERY line break (not just blank
 * lines) — one HTML string per display line. Used by the hero
 * statement, where each line is a separate `.line` block and a word can
 * carry the accent emphasis (italic). Treats single and double newlines
 * alike so it doesn't matter whether the editor makes a soft or hard
 * break.
 */
export function renderInlineLines(md: string): string[] {
  return md
    .trim()
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => marked.parseInline(l) as string);
}

/**
 * Flatten markdown to plain text — for meta descriptions / JSON-LD where
 * markup must not leak. Renders then strips tags + collapses whitespace.
 * First-party, build-time content, so a tag-strip is sufficient.
 */
export function markdownToPlainText(md: string): string {
  const html = marked.parse(md.trim(), { async: false });
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
