<!--
  Site-wide footer strip — copyright + CVR line and the optional
  social-profile row. Shown on every content page.

  Expects to be mounted as a sibling of `<main>` inside an
  `.app-shell` root so design tokens (`--surface`, `--font-mono`)
  resolve. Kept outside `<main>` intentionally: this is the page
  footer landmark, not part of the primary content.

  Social row is conditional — if `socials` is missing, empty, or
  only contains blank-URL entries, `<SocialLinks>` renders
  nothing and the copyright line gets the full row on its own.
-->
<script lang="ts">
  import type { SocialLink } from '$lib/content';
  import SocialLinks from './SocialLinks.svelte';
  import {
    PUBLIC_GIT_SHA,
    PUBLIC_BUILD_TIME,
    PUBLIC_GITHUB_REPO
  } from '$env/static/public';

  interface Props {
    /** Rendered copyright string — already expanded from the
     *  template `{year} {name} · CVR {cvr}` by the caller, so this
     *  component stays presentational. */
    text: string;
    /** Optional social-profile entries from `contact.socials`.
     *  Pass the raw array; the inner component filters out
     *  empty-URL entries. */
    socials?: SocialLink[];
    /** Subject for the social icons' aria-labels, usually
     *  `site.name`. e.g. "Find Skovbye Sexologi on LinkedIn". */
    subject?: string;
    /** Localised "Find" / "Skift til" style verb for the aria-label. */
    findLabel?: string;
    /** Localised "on" / "på" preposition for the aria-label. */
    onLabel?: string;
  }

  let {
    text,
    socials,
    subject = '',
    findLabel,
    onLabel
  }: Props = $props();

  // Build marker — tiny link to the commit this bundle was built
  // from. CI populates these (see .github/workflows/build-and-notify.yml).
  // Local dev builds have all three empty → marker renders nothing.
  const shortSha = PUBLIC_GIT_SHA ? PUBLIC_GIT_SHA.slice(0, 7) : '';
  const commitUrl =
    PUBLIC_GIT_SHA && PUBLIC_GITHUB_REPO
      ? `https://github.com/${PUBLIC_GITHUB_REPO}/commit/${PUBLIC_GIT_SHA}`
      : '';
  // Render build time as a "DD MMM YYYY" label in a stable locale
  // (so the footer string is deterministic across locales + the
  // prerender vs client-hydrate doesn't hydration-mismatch).
  const buildLabel = PUBLIC_BUILD_TIME
    ? new Date(PUBLIC_BUILD_TIME).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '';
</script>

<footer class="foot">
  <div class="foot-inner">
    <p class="copyright">{text}</p>
    <div class="foot-right">
      {#if socials && subject}
        <SocialLinks {socials} {subject} {findLabel} {onLabel} />
      {/if}
      {#if shortSha}
        <a
          class="build-marker"
          href={commitUrl}
          target="_blank"
          rel="noopener"
          title="View commit on GitHub"
        >
          build {shortSha}{#if buildLabel} · {buildLabel}{/if}
        </a>
      {/if}
    </div>
  </div>
</footer>

<style>
  .foot {
    /* Deep fern — a darker floor below the .contact sage. Kept as
       its own explicit value rather than deriving from var(--accent)
       so the typography accent can be a lighter, more-obviously-
       green sage without darkening the .foot strip. */
    background: oklch(0.2 0.06 152);
    /* 65% surface token — 4.5:1 on the deep-fern bg, meeting WCAG
       AA for small text. Was 45% (4.06:1) before the a11y pass. */
    color: color-mix(in oklch, var(--surface) 65%, transparent);
    padding: 1.25rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    position: relative;
    z-index: 1;
  }
  /*
    Inner wrapper shares the 1320px cap the rest of the site uses.
    Row on tablet+, column on mobile so the social icons aren't
    competing with the copyright line for a tight strip of space.
  */
  .foot-inner {
    max-width: 1320px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  .copyright {
    margin: 0;
  }

  /* Right-hand cluster on the same row as the copyright: social
     links (if any) followed by the build marker. Column on mobile
     so nothing wraps awkwardly in a narrow strip. */
  .foot-right {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.6rem;
  }

  /* Build marker — deliberately very muted. Inline with the
     copyright line so it doesn't add a new row of footer height.
     Visible on hover (opacity bumps) but quiet during reading. */
  .build-marker {
    color: inherit;
    text-decoration: none;
    font-size: 0.58rem;
    letter-spacing: 0.08em;
    opacity: 0.3;
    transition: opacity 0.2s ease;
    white-space: nowrap;
  }
  .build-marker:hover {
    opacity: 0.75;
    text-decoration: underline;
  }

  @media (min-width: 720px) {
    .foot-inner {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      padding-left: 2rem;
      padding-right: 2rem;
    }
    .foot-right {
      flex-direction: row;
      align-items: center;
      gap: 1rem;
    }
  }
  @media (min-width: 1024px) {
    .foot-inner {
      padding-left: 3rem;
      padding-right: 3rem;
    }
  }
</style>
