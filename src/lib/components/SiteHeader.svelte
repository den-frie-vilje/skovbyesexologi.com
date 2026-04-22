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
  Brand mark on the left is a link to the current locale's
  homepage — invisible styling so the header reads as pure
  typography but clicks land on `/` (or `/en`). The city sits
  beside it as plain metadata, intentionally NOT inside the
  link — the city is a tagline, not a destination; making the
  whole row clickable was confusing users who expected the city
  label to behave differently from the brand mark.
-->
<header class="top">
  <a class="top-link" href={homeHref}>{name}</a>
  <span class="mark-meta">{city}</span>
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
    Invisible clickable brand mark on the left. `text-decoration:
    none` + `color: inherit` keep it visually plain; the
    `:focus-visible` outline from app.css still lands on the
    anchor so keyboard users get a clear indicator.
  */
  .top-link {
    text-decoration: none;
    color: var(--graphite);
    font-weight: 500;
  }
  /*
    City label — pushed to the right with `margin-left: auto` so
    the burger button follows at the far edge. Not clickable
    (intentionally separate from `.top-link`).
  */
  .mark-meta {
    margin-left: auto;
    color: var(--graphite-soft);
  }

  @media (min-width: 720px) {
    .top {
      padding: 1rem 2rem;
    }
  }
</style>
