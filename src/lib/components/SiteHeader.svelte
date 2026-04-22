<!--
  Site-wide brand mark / sticky top header. Shown on every page
  (home + service detail pages), so its markup + style lives here
  rather than being duplicated per route.

  It's a `<header>`, not `<nav>` — there are no navigation links to
  announce (Skovbye Sexologi is a single-practitioner editorial
  site; deep-linking happens via URL, not an in-page menu). Using
  `<nav>` with no links confused assistive tech in a prior axe run.

  Relies on the design tokens declared on `.flod` — the root wrapper
  of every page that consumes this component.
-->
<script lang="ts">
  import BurgerNav from './BurgerNav.svelte';
  import type { NavLink } from '$lib/content';

  interface Props {
    /** Brand-owner name, e.g. "Signe Skovbye". */
    name: string;
    /** City / tagline beside the name, e.g. "København". */
    city: string;
    /** Destination for the invisible clickable region around the
     *  brand mark. Defaults to `/` (DA home); service pages can
     *  pass `/en` on the English side. */
    homeHref?: string;
    /** Primary-nav entries for the burger menu. When empty, the
     *  burger button is hidden. Typically comes from `primaryNav(locale)`. */
    navLinks?: NavLink[];
    /** Localised aria-labels for the burger controls. */
    burgerOpenLabel?: string;
    burgerCloseLabel?: string;
    burgerMenuLabel?: string;
  }

  let {
    name,
    city,
    homeHref = '/',
    navLinks = [],
    burgerOpenLabel,
    burgerCloseLabel,
    burgerMenuLabel
  }: Props = $props();
</script>

<!--
  The entire brand-mark row is wrapped in a link to the current
  locale's homepage — invisible clickable target, no visible
  underline or hover colour change, so the header reads as pure
  typography but clicks deliver users to the start of the site.
  Using `aria-label` so screen readers announce "homepage" rather
  than just reading the two text fragments.
-->
<header class="top">
  <a
    class="top-link"
    href={homeHref}
    aria-label={`${name} — ${city}`}
  >
    <span class="mark">{name}</span>
    <span class="mark-meta">{city}</span>
  </a>
  {#if navLinks.length > 0}
    <BurgerNav
      links={navLinks}
      openLabel={burgerOpenLabel}
      closeLabel={burgerCloseLabel}
      menuLabel={burgerMenuLabel}
    />
  {/if}
</header>

<style>
  .top {
    max-width: 1320px;
    margin: 0 auto;
    padding: 1rem 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    position: sticky;
    top: 0;
    /* Solid fill — `backdrop-filter: blur()` on a sticky header kills
       scroll perf in Safari, particularly compounding with the WebGL
       canvas underneath. Pay the opacity trick in plain RGBA instead. */
    background: var(--bone);
    /*
      Must sit above the sticky CTA (z-index: 50) so the burger
      menu's backdrop + panel — rendered inside this header —
      paint over the CTA when opened. At 110 the header's own
      mark + mark-meta also paint over the CTA, but they're at
      the top of the viewport and the CTA at the bottom-right,
      so they never visually overlap.
    */
    z-index: 110;
    border-bottom: 1px solid var(--rule);
  }
  /*
    Invisible clickable target spanning the flex row available to
    it — grows to push the burger button to the far right, and
    internally distributes the two text fragments with its own
    flex. `text-decoration: none` + `color: inherit` keep the link
    from showing any default styling; the `:focus-visible` outline
    from app.css still lands on the anchor for keyboard users.
  */
  .top-link {
    flex: 1 1 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    text-decoration: none;
    color: inherit;
  }
  .mark {
    color: var(--graphite);
    font-weight: 500;
  }
  .mark-meta {
    color: var(--graphite-soft);
  }

  @media (min-width: 720px) {
    .top {
      padding: 1rem 2rem;
    }
  }
</style>
