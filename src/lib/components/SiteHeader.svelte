<!--
  Site-wide brand mark / sticky top header. Shown on every page
  (home + service detail pages), so its markup + style lives here
  rather than being duplicated per route.

  It's a `<header>`, not `<nav>` — there are no navigation links to
  announce (Skovbye Sexologi is a single-practitioner editorial
  site; deep-linking happens via URL, not an in-page menu). Using
  `<nav>` with no links confused assistive tech in a prior axe run.

  Relies on the design tokens declared on `.app-shell` — the root wrapper
  of every page that consumes this component.
-->
<script lang="ts">
  import BurgerNav from './BurgerNav.svelte';
  import LocaleSwitcher from './LocaleSwitcher.svelte';
  import type { Locale, NavLink } from '$lib/content';

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
    /** The page's current locale — drives the DA|EN switcher's
     *  "active" label. */
    currentLocale?: Locale;
    /** Target locale for the language switcher — the OTHER locale
     *  from the one the page is currently in. When omitted with
     *  `altHref` the switcher is hidden. */
    altLocale?: Locale;
    /** URL for the language switcher — the peer page in the other
     *  locale (same service for service detail pages, homepage
     *  otherwise). */
    altHref?: string;
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
    currentLocale,
    altLocale,
    altHref,
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
  <!--
    Plain <a href> — brand-mark clicks scroll to the top of
    home. That matches the standard site-logo convention:
    users expect the logo to mean "return to the top of the
    front page," not "restore a scroll position from earlier in
    the session." The service-page "← Forsiden" back link is
    the affordance that restores scroll (see
    `$lib/nav/backNav.svelte.ts`).
  -->
  <a class="top-link" href={homeHref}>{name}</a>
  <span class="mark-meta">{city}</span>
  {#if currentLocale && altLocale && altHref}
    <LocaleSwitcher {currentLocale} {altLocale} {altHref} />
  {/if}
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
    color: var(--text-muted);
    position: sticky;
    top: 0;
    /* Solid fill — `backdrop-filter: blur()` on a sticky header kills
       scroll perf in Safari, particularly compounding with the WebGL
       canvas underneath. Pay the opacity trick in plain RGBA instead. */
    background: var(--surface);
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
    color: var(--text);
    font-weight: 500;
  }
  /*
    City label sits immediately after the brand mark — reads as
    part of the address line "Skovbye Sexologi, København". Not
    clickable (intentionally separate from `.top-link`); the city
    is metadata, not a destination.

    Hidden below 720px — the brand mark, city, DA|EN toggle, and
    burger together crowd the mobile header, and the city is the
    weakest information of the four (people landing on a Danish
    site in Copenhagen have already intuited the city). Dropping
    it reclaims enough horizontal space for the name + toggle +
    burger to breathe at 375px-wide viewports.
  */
  .mark-meta {
    color: var(--text-muted);
    display: none;
  }

  /*
    The right-side group (locale switcher + burger) pushes itself
    to the far edge regardless of whether `.mark-meta` is visible.
    Auto-margin on the first right-group child is independent of
    the city's display state, so showing / hiding the city doesn't
    shift the burger's resting position.

    `:global()` is required because `<LocaleSwitcher>` is an
    imported component; its `.locale-switch` root carries its own
    scope class, not ours.
  */
  .top :global(.locale-switch) {
    margin-left: auto;
  }

  @media (min-width: 720px) {
    .top {
      padding: 1rem 2rem;
    }
    .mark-meta {
      display: inline;
    }
  }
</style>
