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
    picked, the header can render the candidate treatments below; append
    `?logotype` to any URL to get a floating picker (e.g.
    `/?logotype` or `/?logotype=serif`). The choice is written back
    to the URL so it survives reload and can be shared. Default —
    with no query param — is the pre-existing mono mark, so nothing
    changes for normal visitors. Once a variant is chosen, delete
    the losers + this switcher and hard-wire the winner.
  */
  const LOGO_VARIANTS = [
    'current',
    'serif',
    'stacked',
    'contrast',
    'signature',
    'monogram',
    'highlight',
    'lowercase',
    'stamp',
    'block',
    'stampduo',
    'greenstack',
    'stampintro',
    'dots'
  ] as const;
  type LogoVariant = (typeof LOGO_VARIANTS)[number];
  const variantLabels: Record<LogoVariant, string> = {
    current: 'Nuværende',
    serif: 'Serif',
    stacked: 'Stablet',
    contrast: 'Kontrast',
    signature: 'Signatur',
    monogram: 'Monogram',
    highlight: 'Markeret',
    lowercase: 'Minuskel',
    stamp: 'Stempel',
    block: 'Blok',
    stampduo: 'Dobbeltstempel',
    greenstack: 'Grøn stak',
    stampintro: 'Stempel intro',
    dots: 'Prikker'
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
  /* "Skovbye Sexologi" → "SS" for the monogram variant. */
  const initials = $derived((nameParts.first[0] ?? '') + (nameParts.rest[0] ?? ''));

  /* "Skovbye Sexologi" → ["Sk","o","vbye Sex","o","l","o","gi"]
     for the dots variant: every o/O renders as a circle; `dot`
     numbers them (0,1,2) so their opening animation staggers. */
  const dotTokens = $derived.by(() => {
    let dot = 0;
    return name
      .split(/([oO])/)
      .filter((t) => t !== '')
      .map((t) => (t === 'o' || t === 'O' ? { dot: dot++, text: '' } : { dot: -1, text: t }));
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
  <a
    class="top-link logo-{logoVariant}"
    href={homeHref}
    aria-label={logoVariant === 'dots' ? name : undefined}
  >
    {#if logoVariant === 'serif'}
      {nameParts.first} <em>{nameParts.rest}</em>
    {:else if logoVariant === 'stacked'}
      <span class="stack-line">{nameParts.first}</span>
      <span class="stack-line">{nameParts.rest}</span>
    {:else if logoVariant === 'contrast'}
      <strong>{nameParts.first}</strong><span class="thin">{nameParts.rest}</span>
    {:else if logoVariant === 'signature'}
      {name}<span class="sig-dot" aria-hidden="true">.</span>
    {:else if logoVariant === 'monogram'}
      <span class="mono-mark" aria-hidden="true">{initials}</span>
      <span class="mono-name">{name}</span>
    {:else if logoVariant === 'highlight'}
      {nameParts.first} <span class="hl">{nameParts.rest}</span>
    {:else if logoVariant === 'lowercase'}
      {name}<span class="lc-dot" aria-hidden="true">.</span>
    {:else if logoVariant === 'block' || logoVariant === 'greenstack'}
      <span class="stack-line">{nameParts.first}</span>
      <span class="stack-line stack-tail">{nameParts.rest}</span>
    {:else if logoVariant === 'stampintro'}
      <span class="stamp-text">{name}</span>
    {:else if logoVariant === 'dots'}
      <!-- The anchor carries aria-label={name}; this construction
           is visual-only (the O's are not letters here). -->
      <span class="dots-visual" aria-hidden="true">
        {#each dotTokens as tok, i (i)}
          {#if tok.dot >= 0}
            <span class="o-dot" style="--dot-i: {tok.dot}"></span>
          {:else}
            <span class="dot-seg">{tok.text}</span>
          {/if}
        {/each}
      </span>
    {:else}
      <!-- `current`, `stamp` and `stampduo` render the plain name —
           the variant class alone carries the box / fill. -->
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

  /* E — italic-serif SS monogram beside the mono name; the mark
     carries the identity, so it survives any size. */
  .logo-monogram {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .logo-monogram .mono-mark {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 1.35rem;
    font-weight: 600;
    /* Tight negative tracking pulls the two S's into a single
       interlocked mark rather than two letters. */
    letter-spacing: -0.12em;
    line-height: 1;
    text-transform: none;
  }
  .logo-monogram .mono-name {
    letter-spacing: 0.16em;
  }

  /* F — the hero's chartreuse highlighter swipe on the second
     word: the site's core accent gesture applied to the mark. */
  .logo-highlight {
    font-family: var(--font-serif);
    font-size: 1.05rem;
    font-weight: 500;
    letter-spacing: -0.01em;
    text-transform: none;
    line-height: 1;
  }
  .logo-highlight .hl {
    font-style: italic;
    background: linear-gradient(180deg, transparent 66%, var(--highlight) 66%);
    padding: 0 0.08em;
  }

  /* G — all-lowercase Fraunces, warm and contemporary, closed by
     the accent dot. */
  .logo-lowercase {
    font-family: var(--font-serif);
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: -0.015em;
    text-transform: lowercase;
    line-height: 1;
  }
  .logo-lowercase .lc-dot {
    color: oklch(0.82 0.22 115);
  }

  /* H — hairline stamp: the mono caps boxed like a credential
     label. Inherits the header's mono + uppercase. */
  .logo-stamp {
    font-size: 0.6rem;
    letter-spacing: 0.18em;
    border: 1px solid currentColor;
    padding: 0.5em 0.75em 0.42em;
    line-height: 1;
  }

  /* I — the stack with SEXOLOGI on a solid neon block: the
     highlighter gesture in masthead form. City goes dark green
     to tie the pair (see the ≥720px block below). */
  .logo-block {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.32em;
    line-height: 1.45;
  }
  .logo-block .stack-tail {
    background: var(--highlight);
    padding: 0.14em 0.1em 0.14em 0.42em;
    margin-top: 0.12em;
    line-height: 1.15;
  }

  /* J — twin stamps: the name filled dark green; København (≥720)
     answers as a hairline-outline stamp in the same green. */
  .logo-stampduo {
    font-size: 0.6rem;
    letter-spacing: 0.18em;
    padding: 0.55em 0.8em 0.47em;
    line-height: 1;
    background: var(--accent);
    color: var(--surface);
    /* Transparent border so this box and the city's outlined twin
       (which carries a real 1px border) are exactly equal height. */
    border: 1px solid transparent;
  }

  /* L — the stamp, stamped: an intro that establishes the mark on
     a dark-green plate with a chartreuse rim, wipes the name in
     left-to-right in neon, then drains everything to the resting
     black hairline stamp. Runs once when the variant mounts (and
     re-runs on each picker switch, since the class re-applies). */
  .logo-stampintro {
    font-size: 0.6rem;
    letter-spacing: 0.18em;
    padding: 0.5em 0.75em 0.42em;
    line-height: 1;
    border: 1px solid currentColor;
    animation: stamp-intro-box 2.2s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .logo-stampintro .stamp-text {
    display: inline-block;
    animation: stamp-intro-text 2.2s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  /* Sequencing rule (measured, not guessed): the text turns ink
     WHILE the plate is still green (ink-on-green 3.1:1, a brief
     decorative beat), and only then does the plate drain around
     the black text — neon text never crosses the cream surface
     (that crossing measured as low as 1.96:1 in an earlier cut). */
  @keyframes stamp-intro-box {
    0% {
      opacity: 0;
      background-color: var(--accent);
      border-color: var(--highlight);
    }
    8% {
      opacity: 1;
    }
    70% {
      background-color: var(--accent);
      border-color: var(--highlight);
    }
    100% {
      background-color: transparent;
      border-color: var(--text);
    }
  }
  @keyframes stamp-intro-text {
    0%,
    18% {
      clip-path: inset(0 100% 0 0);
      color: var(--highlight);
    }
    55% {
      clip-path: inset(0 0 0 0);
      color: var(--highlight);
    }
    68%,
    100% {
      clip-path: inset(0 0 0 0);
      color: var(--text);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .logo-stampintro,
    .logo-stampintro .stamp-text,
    .logo-dots .o-dot {
      animation: none;
    }
  }

  /* M — the three O's as dots. The logotype stands fully
     established from the first frame; the intro lives entirely
     in the O's: each starts as a SOLID dark-green disc (a
     border-box circle whose border is as thick as its radius),
     a chartreuse core opens from the centre as that inner
     border thins outward, and once the stroke has thinned to
     the type's own weight the chartreuse fades away — resting
     on true outline O's. */
  .logo-dots {
    font-family: var(--font-display);
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1;
  }
  .logo-dots .dots-visual {
    display: inline-block;
  }
  /* Inter-token tracking — letter-spacing doesn't apply between
     inline-block boxes, so the rhythm is carried by margins. */
  .logo-dots .dots-visual > :global(* + *) {
    margin-left: 0.2em;
  }
  .logo-dots .dot-seg {
    display: inline-block;
    overflow: hidden;
    white-space: nowrap;
    vertical-align: bottom;
    letter-spacing: 0.2em;
    /* An inline-block's width includes the trailing letter-space;
       pull the next token back so token gaps equal the intra-
       segment tracking. */
    margin-right: -0.2em;
  }
  .logo-dots .o-dot {
    display: inline-block;
    /* Pixel-perfect against the real glyph, measured via canvas
       measureText('O') in the rendered font (Space Grotesk 700
       @ 11.52px): ink box 6.64×8.39px — asc 8.23 above baseline,
       0.16px round-shape overshoot below. The dot stays a CIRCLE
       (the brand gesture) at the O's exact ink HEIGHT:
       0.728em = 8.39px. Vertical anchoring uses the inline-block
       baseline rule — an empty inline-block's baseline is its
       bottom margin edge, so with default vertical-align the
       dot's bottom sits exactly ON the text baseline; the 0.014em
       translate adds the font's own below-baseline overshoot.
       Verified in-DOM: top/bottom within 0.05px of the O's ink
       box.

       Static values are the RESTING state (outline O, transparent
       counter) — keyframes override during the intro, and
       reduced-motion (animation: none) lands on the finished mark
       directly. Border-box keeps the outer circle constant while
       the border thins inward. */
    width: 0.728em;
    height: 0.728em;
    box-sizing: border-box;
    border-radius: 50%;
    background: transparent;
    border: 0.14em solid currentColor;
    /* 0.014em puts the dot mathematically on the O's ink box
       (incl. its below-baseline overshoot); the extra −0.0434em
       (0.5px) is Ole's optical correction — a filled/ringed
       circle reads lower than the O's thin bowl at this size. */
    transform: translateY(-0.03em);
    /* Staggered: each O opens 0.3s after the previous (with
       `both` fill the later dots hold the solid-disc first frame
       while they wait). */
    animation: dot-open 2s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: calc(var(--dot-i, 0) * 0.3s);
  }
  /* Solid disc (border = radius, chartreuse hidden beneath it) →
     the core opens as the border thins → hold the ringed-neon
     beat → the chartreuse fades once the stroke matches the
     type's weight. */
  @keyframes dot-open {
    0%,
    12% {
      /* Slightly over half the 0.76em diameter: computed border
         widths snap to device pixels, and exactly-half left a
         sub-pixel chartreuse pinhole at the centre (measured 4px
         computed vs the 4.4px radius). */
      border-width: 0.42em;
      background-color: var(--highlight);
    }
    58%,
    70% {
      border-width: 0.14em;
      background-color: var(--highlight);
    }
    100% {
      border-width: 0.14em;
      background-color: transparent;
    }
  }

  /* K — the stack in dark green over a thin neon baseline bar;
     the city (≥720) gets a neon fraction-slash prefix. */
  .logo-greenstack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.32em;
    line-height: 1.45;
    color: var(--accent);
    border-bottom: 2px solid var(--highlight);
    padding-bottom: 0.35em;
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

    /*
      Variant-specific København treatments — the city is part of
      the lockup at this breakpoint, so the green/neon variants
      style their own suffix. Below 720px the city is hidden and
      these are inert.
    */
    /* Blok: city in the dark green so the pair reads mark + place. */
    .logo-block ~ .mark-meta {
      color: var(--accent);
    }
    /* Dobbeltstempel: city as the outline twin of the filled stamp. */
    .logo-stampduo ~ .mark-meta {
      display: inline-block;
      font-size: 0.6rem;
      letter-spacing: 0.18em;
      line-height: 1;
      padding: 0.55em 0.8em 0.47em;
      border: 1px solid var(--accent);
      color: var(--accent);
    }
    /* Grøn stak: neon fraction-slash prefix before the city
       (darker chartreuse — the glyph-safe neon, same as the hero
       dot; empty alt string keeps it out of the a11y tree). */
    .logo-greenstack ~ .mark-meta {
      color: var(--accent);
    }
    .logo-greenstack ~ .mark-meta::before {
      content: '⁄ ' / '';
      color: oklch(0.82 0.22 115);
      font-weight: 700;
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
