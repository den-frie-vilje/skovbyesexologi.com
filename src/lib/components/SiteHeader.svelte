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
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import BurgerNav from './BurgerNav.svelte';
  import LocaleSwitcher from './LocaleSwitcher.svelte';
  import type { Locale, NavLink } from '$lib/content';

  /*
    ── LOGOTYPE DEMO (temporary) ─────────────────────────────────
    Signe wants a stronger, logotype-like brand mark. Until one is
    picked, the header can render five candidate treatments; append
    `?logotype` to any URL to get a floating picker (e.g.
    `/?logotype` or `/?logotype=serif`). The choice is written back
    to the URL so it survives reload and can be shared. Default —
    with no query param — is the pre-existing mono mark, so nothing
    changes for normal visitors. Once a variant is chosen, delete
    the losers + this switcher and hard-wire the winner.
  */
  const LOGO_VARIANTS = ['current', 'serif', 'stacked', 'contrast', 'signature'] as const;
  type LogoVariant = (typeof LOGO_VARIANTS)[number];
  const variantLabels: Record<LogoVariant, string> = {
    current: 'Nuværende',
    serif: 'Serif',
    stacked: 'Stablet',
    contrast: 'Kontrast',
    signature: 'Signatur'
  };

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

  /* "Skovbye Sexologi" → first word + rest, so the variants can
     treat the two halves differently. Falls back gracefully for a
     single-word name. */
  const nameParts = $derived.by(() => {
    const words = name.trim().split(/\s+/);
    return { first: words[0] ?? name, rest: words.slice(1).join(' ') };
  });

  /*
    The URL is the single source of truth for the demo state; the
    pills below write it back via `replaceState`, which `page.url`
    reacts to. `browser`-guarded because prerender forbids reading
    `url.searchParams` — the static HTML always ships the default
    mark and the picker appears only after hydration.
  */
  const showLogoPicker = $derived(browser && page.url.searchParams.has('logotype'));
  const logoVariant = $derived.by((): LogoVariant => {
    if (!browser) return 'current';
    const v = page.url.searchParams.get('logotype');
    return v && (LOGO_VARIANTS as readonly string[]).includes(v) ? (v as LogoVariant) : 'current';
  });

  /* `goto`, not shallow `replaceState`: shallow routing only sets
     `page.state` — `page.url` (which `logoVariant` derives from)
     reacts to real navigations only. */
  function pickLogoVariant(v: LogoVariant) {
    const url = new URL(page.url);
    url.searchParams.set('logotype', v);
    goto(url, { replaceState: true, keepFocus: true, noScroll: true });
  }
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
  <a class="top-link logo-{logoVariant}" href={homeHref}>
    {#if logoVariant === 'serif'}
      {nameParts.first} <em>{nameParts.rest}</em>
    {:else if logoVariant === 'stacked'}
      <span class="stack-line">{nameParts.first}</span>
      <span class="stack-line">{nameParts.rest}</span>
    {:else if logoVariant === 'contrast'}
      <strong>{nameParts.first}</strong><span class="thin">{nameParts.rest}</span>
    {:else if logoVariant === 'signature'}
      {name}<span class="sig-dot" aria-hidden="true">.</span>
    {:else}
      {name}
    {/if}
  </a>
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

{#if showLogoPicker}
  <!-- Temporary demo control — see the LOGOTYPE DEMO note above. -->
  <div class="logo-picker" role="group" aria-label="Logotype-varianter (demo)">
    {#each LOGO_VARIANTS as v (v)}
      <button
        type="button"
        aria-pressed={logoVariant === v}
        class:active={logoVariant === v}
        onclick={() => pickLogoVariant(v)}
      >
        {variantLabels[v]}
      </button>
    {/each}
  </div>
{/if}

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
    white-space: nowrap;
  }

  /*
    ── Logotype candidates (see LOGOTYPE DEMO note in <script>) ──
    Every variant draws only on families already in the page's
    Google-Fonts payload; sizes are tuned so the widest variant +
    DA|EN toggle + burger still fit a 375px viewport (the city is
    hidden below 720px).
  */

  /* A — the name-section echo: Fraunces roman + italic. */
  .logo-serif {
    font-family: var(--font-serif);
    font-size: 1.05rem;
    font-weight: 500;
    letter-spacing: -0.01em;
    text-transform: none;
    line-height: 1;
  }
  .logo-serif em {
    font-style: italic;
    font-weight: 500;
  }

  /* B — stacked caps lockup, fashion-label compact. */
  .logo-stacked {
    display: flex;
    flex-direction: column;
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.32em;
    line-height: 1.45;
  }
  .stack-line {
    display: block;
  }

  /* C — one-line caps, bold ⁄ regular weight contrast. */
  .logo-contrast {
    font-family: var(--font-display);
    font-size: 0.78rem;
    letter-spacing: 0.22em;
    line-height: 1;
  }
  .logo-contrast strong {
    font-weight: 700;
  }
  .logo-contrast .thin {
    /* Space Grotesk ships 400/500/700 here — 400 is the light pole. */
    font-weight: 400;
    margin-left: 0.5em;
  }

  /* D — Instrument Serif italic, signature-like, with the hero's
     accent dot. */
  .logo-signature {
    font-family: var(--font-humanist);
    font-style: italic;
    font-size: 1.25rem;
    font-weight: 400;
    letter-spacing: 0.01em;
    text-transform: none;
    line-height: 1;
  }
  .logo-signature .sig-dot {
    font-style: normal;
    font-weight: 600;
    color: oklch(0.82 0.22 115);
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

  /* Temporary logotype picker — bottom-left, clear of the
     bottom-right StickyCta; above the header (110) and CTA (50). */
  .logo-picker {
    position: fixed;
    left: 0.9rem;
    bottom: 0.9rem;
    z-index: 200;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    max-width: calc(100vw - 1.8rem);
    font-family: var(--font-mono);
  }
  .logo-picker button {
    font-family: inherit;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.45rem 0.7rem;
    border-radius: 999px;
    border: 1px solid var(--rule);
    background: var(--surface);
    color: var(--text-muted);
    cursor: pointer;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }
  .logo-picker button:hover {
    color: var(--text);
  }
  .logo-picker button.active {
    background: var(--text);
    color: var(--surface);
    border-color: var(--text);
  }
</style>
