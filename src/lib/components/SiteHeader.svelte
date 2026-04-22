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
  interface Props {
    /** Brand-owner name, e.g. "Signe Skovbye". */
    name: string;
    /** City / tagline beside the name, e.g. "København". */
    city: string;
  }

  let { name, city }: Props = $props();
</script>

<header class="top">
  <span class="mark">{name}</span>
  <span class="mark-meta">{city}</span>
</header>

<style>
  .top {
    max-width: 1320px;
    margin: 0 auto;
    padding: 1rem 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
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
    z-index: 10;
    border-bottom: 1px solid var(--rule);
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
