<!--
  Site-wide brand mark / sticky top header. Shown on every page
  (home + service detail pages), so its markup + style lives here
  rather than being duplicated per route.

  It's a `<header>`, not `<nav>` — there are no navigation links to
  announce (Skovbye Sexologi is a single-practitioner editorial
  site; deep-linking happens via URL, not an in-page menu). Using
  `<nav>` with no links confused assistive tech in a prior axe run.

  THE BRAND MARK (settled 2026-07-30 after a picker-driven
  exploration of ~13 candidates): "SKOVBYE SEXOLOGI" in Space
  Grotesk 700 caps with the three O's as circles. On mount the O's
  start as solid ink discs and bloom open staggered — a chartreuse
  core grows from each centre as the inner border thins to the
  type's stroke weight, then the neon fades, resting on outline
  O's. Hover/focus quotes the CTA buttons' hovered state: a
  borderless chartreuse rectangle, dark-green type, and the rings
  growing (via inset shadow) until the O's are solid.

  Relies on the design tokens declared on `.app-shell` — the root wrapper
  of every page that consumes this component.
-->
<script lang="ts">
  import BurgerNav from './BurgerNav.svelte';
  import LocaleSwitcher from './LocaleSwitcher.svelte';
  import type { Locale, NavLink } from '$lib/content';

  interface Props {
    /** Brand name, e.g. "Skovbye Sexologi". */
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

  /* "Skovbye Sexologi" → ["Sk","o","vbye Sex","o","l","o","gi"]:
     every o/O renders as a circle; `dot` numbers them (0,1,2) so
     their opening animation staggers. */
  const dotTokens = $derived.by(() => {
    let dot = 0;
    return name
      .split(/([oO])/)
      .filter((t) => t !== '')
      .map((t) => (t === 'o' || t === 'O' ? { dot: dot++, text: '' } : { dot: -1, text: t }));
  });
  const dotCount = $derived(dotTokens.filter((t) => t.dot >= 0).length);

  /*
    The intro animation's fill-mode would keep overriding the
    dots' hover styles forever — so once every dot has finished
    its (staggered) opening, `dotsSettled` drops the animations
    entirely (which also cues the third dot's blink) and the
    CTA-quoting hover can transition freely. Each dot carries
    story layers (shake / bounce / eyelid) that fire their own
    animationend — only `dot-open` counts toward settling (the
    name arrives scope-prefixed, hence `includes`). The counter
    only ever needs to reach dotCount once: a locale switch
    re-renders the spans, and `settled` correctly keeps the
    intro from replaying mid-session.
  */
  let dotsSettled = $state(false);
  let settledCount = 0;
  function onDotAnimationEnd(e: AnimationEvent) {
    if (!e.animationName.includes('dot-open')) return;
    if (++settledCount >= dotCount) dotsSettled = true;
  }
</script>

<!--
  Brand mark on the left is a link to the current locale's
  homepage — the mark itself is aria-hidden (the O's are not
  letters), so the anchor carries the real name for assistive
  tech. The city sits beside it as plain metadata, intentionally
  NOT inside the link — the city is a tagline, not a destination;
  making the whole row clickable was confusing users who expected
  the city label to behave differently from the brand mark.
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
  <a class="top-link" href={homeHref} aria-label={name}>
    <span class="dots-visual" class:settled={dotsSettled} aria-hidden="true">
      {#each dotTokens as tok, i (i)}
        {#if tok.dot >= 0}
          <span class="o-dot" data-dot={tok.dot} onanimationend={onDotAnimationEnd}></span>
        {:else}
          <span class="dot-seg">{tok.text}</span>
        {/if}
      {/each}
    </span>
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
    The brand mark. `:focus-visible` gets the same treatment as
    hover on top of app.css's global focus ring.

    Hover quotes the CTA buttons' hovered state: a borderless
    chartreuse rectangle (their 2px radius), dark-green
    typography, dark-green-filled O's — accent on chartreuse
    measures 5.42:1. Padding + equal negative margins paint the
    box outward without moving the mark or growing the header
    row.
  */
  .top-link {
    text-decoration: none;
    color: var(--text);
    white-space: nowrap;
    font-family: var(--font-display);
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1;
    /*
      "Iris" spring — a damped, fleshy settle for the dot
      geometry: overshoots ~12% past the target, contracts, and
      ripples once faintly before resting (a pupil adjusting to
      light). Only ever applied to GEOMETRY (border-width, shadow
      spread) — colours keep plain ease, where overshoot reads as
      a glitch. The bezier is the fallback for engines without
      linear() (single soft overshoot, no ripple); the @supports
      block below upgrades it — a second declaration wouldn't
      work, custom properties aren't syntax-validated at parse.
    */
    --ease-flesh: cubic-bezier(0.34, 1.56, 0.64, 1);
    padding: 0.5em 0.55em 0.45em;
    margin: -0.5em -0.55em -0.45em;
    border-radius: 2px;
    transition:
      background-color 0.25s ease,
      color 0.25s ease;
  }
  @supports (animation-timing-function: linear(0, 1)) {
    .top-link {
      --ease-flesh: linear(
        0,
        0.42 12%,
        0.81 22%,
        1.05 34%,
        1.12 42%,
        1.08 52%,
        0.99 66%,
        0.97 76%,
        1 88%,
        1
      );
    }
  }
  .top-link:hover,
  .top-link:focus-visible {
    background-color: var(--highlight);
    color: var(--accent);
  }

  .dots-visual {
    display: inline-block;
  }
  /* Inter-token tracking — letter-spacing doesn't apply between
     inline-block boxes, so the rhythm is carried by margins. */
  .dots-visual > :global(* + *) {
    margin-left: 0.2em;
  }
  .dot-seg {
    display: inline-block;
    white-space: nowrap;
    vertical-align: bottom;
    letter-spacing: 0.2em;
    /* An inline-block's width includes the trailing letter-space;
       pull the next token back so token gaps equal the intra-
       segment tracking. */
    margin-right: -0.2em;
  }

  .o-dot {
    display: inline-block;
    /* Pixel-perfect against the real glyph, measured via canvas
       measureText('O') in the rendered font (Space Grotesk 700
       @ 11.52px): ink box 6.64×8.39px — asc 8.23 above baseline,
       0.16px round-shape overshoot below. The dot stays a CIRCLE
       (the brand gesture) at the O's ink height plus Ole's 0.5px
       optical size-up (0.771em), anchored via the inline-block
       baseline rule — an empty inline-block's baseline is its
       bottom margin edge, so with default vertical-align the
       dot's bottom sits exactly ON the text baseline; the 0.014em
       translate adds the font's own below-baseline overshoot.
       Verified in-DOM: bottom at 0.00px delta against the O's ink
       bottom, the size-up growing upward only.

       Static values are the RESTING state (outline O, transparent
       counter) — keyframes override during the intro, and
       reduced-motion (animation: none) lands on the finished mark
       directly. Border-box keeps the outer circle constant while
       the border thins inward.

       Hover-fill mechanics: the border NEVER changes — the
       constant 0.14em ring owns the outer edge in every state,
       so the silhouette can't drift by even a fraction of a
       pixel (a border grown past the radius rasterizes as a
       filled path whose antialiased edge paints ~half a device
       pixel wider than the stroked ring — measured on the
       fine-tuned O). The fill is an INSET box-shadow growing
       inward from the ring's inner edge; inset shadows are
       clipped to the padding box by spec, so overpaint is
       impossible by construction. */
    width: 0.771em;
    height: 0.771em;
    box-sizing: border-box;
    border-radius: 50%;
    background: transparent;
    border: 0.14em solid currentColor;
    transform: translateY(0.014em);
    box-shadow: inset 0 0 0 0 currentColor;
    transition: box-shadow 0.4s var(--ease-flesh);
  }
  /*
    THE STORY (staggered 0.3s, left→right): each O opens with its
    own temperament, layered on the shared `dot-open`
    (border-thinning + chartreuse fade) —
      1. opens trembling, the jitter dying out as it rests;
      2. opens with a small physical bounce as it lands;
      3. opens as an EYE — a solid slit widening (scaleY) around
         an accent pupil (radial-gradient) — and, once all three
         have settled, blinks once and sheds the pupil.
    Story layers own `transform` per dot (dot-open never animates
    transform), and every transform frame carries the 0.014em
    baseline translate.
  */
  .o-dot[data-dot='0'] {
    animation:
      dot-open 2.4s cubic-bezier(0.22, 1, 0.36, 1) both,
      dot-shake 2.4s linear both;
  }
  .o-dot[data-dot='1'] {
    animation:
      dot-open 2.4s cubic-bezier(0.22, 1, 0.36, 1) both,
      dot-sway 2.4s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: 0.4s, 0.4s;
  }
  .o-dot[data-dot='2'] {
    animation: dot-open 2.4s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: 0.8s;
    position: relative;
  }
  /*
    The eye's interior — a pseudo layer INSIDE the ring (inset
    just past the border) so the circle itself never deforms:
    a solid ink EYELID (a slab slid by background-position —
    length-based, animates smoothly cross-browser, unlike
    gradient-stop interpolation) over an accent pupil. The lid
    parts upward as the core opens; the blink slides it down and
    up again; the final settle fades the whole interior away
    (opacity), leaving the plain O.
  */
  .o-dot[data-dot='2']::after {
    content: '';
    position: absolute;
    inset: 0.1em;
    border-radius: 50%;
    background-image:
      linear-gradient(var(--text), var(--text)),
      radial-gradient(circle closest-side, var(--accent) 0 46%, transparent 47% 100%);
    background-repeat: no-repeat;
    background-size: 100% 100%;
    /* Rest value: lid parked above (open). */
    background-position:
      0 -0.7em,
      center;
    animation: eye-lid-open 2.4s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: 0.8s;
  }
  /* The O's fill by the ring visually growing inward until solid
     — the intro's opening gesture in reverse, all three
     synchronously. The spread (0.3em) exceeds the inner radius
     (0.255em after border), so the shadow closes at the centre;
     currentColor keeps ring + fill tracking the type's colour
     transition for free. */
  .top-link:hover .o-dot,
  .top-link:focus-visible .o-dot {
    box-shadow: inset 0 0 0 0.3em currentColor;
  }
  /* Once the staggered intro has finished, drop the animations so
     their fill-mode stops outranking the hover styles above. */
  .dots-visual.settled .o-dot {
    animation: none;
  }
  /* …except the third dot's INTERIOR, whose settling IS the
     finale: the lid sweeps down and back up once, then the whole
     eye (lid + pupil) fades out, leaving the plain O. The blink
     lives on the pseudo, so the settled animation-none rule
     above doesn't touch it. */
  .dots-visual.settled .o-dot[data-dot='2']::after {
    animation: eye-blink 1.2s ease-in-out 0.4s both;
  }

  /* Intro: solid ink disc (border ≈ over the radius — exactly
     half computed to a sub-pixel chartreuse pinhole) → the
     chartreuse core opens from the centre as the inner border
     thins, on the Iris spring (the core blooms slightly past its
     final size and contracts) → hold the ringed-neon beat → the
     chartreuse fades once the stroke matches the type's weight.
     Timing functions are per-keyframe: the spring drives only
     the geometry segment; the colour fade keeps plain ease. */
  @keyframes dot-open {
    0%,
    12% {
      border-width: 0.42em;
      background-color: var(--highlight);
      animation-timing-function: var(--ease-flesh);
    }
    58%,
    70% {
      border-width: 0.14em;
      background-color: var(--highlight);
      animation-timing-function: ease;
    }
    100% {
      border-width: 0.14em;
      background-color: transparent;
    }
  }

  /* Act 1 — anxious → calm: rapid tremble as the core opens
     (72ms half-cycles at 2.4s), both frequency and amplitude
     decaying to rest. */
  @keyframes dot-shake {
    0%,
    12% {
      transform: translateY(0.014em) translateX(0);
    }
    15% {
      transform: translateY(0.014em) translateX(-0.06em);
    }
    18% {
      transform: translateY(0.014em) translateX(0.055em);
    }
    21% {
      transform: translateY(0.014em) translateX(-0.05em);
    }
    24% {
      transform: translateY(0.014em) translateX(0.045em);
    }
    28% {
      transform: translateY(0.014em) translateX(-0.035em);
    }
    33% {
      transform: translateY(0.014em) translateX(0.025em);
    }
    39% {
      transform: translateY(0.014em) translateX(-0.015em);
    }
    46% {
      transform: translateY(0.014em) translateX(0.008em);
    }
    58%,
    100% {
      transform: translateY(0.014em) translateX(0);
    }
  }

  /* Act 2 — slutty (per direction, and on-brand): not a bounce
     but a ROLL. It swells slowly, shifts its weight out of phase
     — stretching tall, then wide, a grind rather than a pulse —
     lingers at the peak a beat too long, and releases slowly.
     The scaleX/scaleY phase offset is what reads as body
     language; every frame eases in-out so nothing ever snaps. */
  @keyframes dot-sway {
    0%,
    40% {
      transform: translateY(0.014em) scale(1, 1);
      animation-timing-function: ease-in-out;
    }
    52% {
      transform: translateY(0.014em) scale(1.04, 1.1);
      animation-timing-function: ease-in-out;
    }
    64% {
      transform: translateY(0.014em) scale(1.1, 1.05);
      animation-timing-function: ease-in-out;
    }
    76% {
      transform: translateY(0.014em) scale(1.06, 1.08);
      animation-timing-function: ease-in-out;
    }
    88% {
      transform: translateY(0.014em) scale(1.015, 1.02);
      animation-timing-function: ease-in-out;
    }
    100% {
      transform: translateY(0.014em) scale(1, 1);
    }
  }

  /* Act 3 — the eyelid parts upward as the core opens; the
     circle itself never deforms. */
  @keyframes eye-lid-open {
    0%,
    12% {
      background-position:
        0 0,
        center;
    }
    58%,
    100% {
      background-position:
        0 -0.7em,
        center;
    }
  }

  /* Finale — the lid sweeps down and back up once, then the
     whole interior fades: the eye becomes a plain O. */
  @keyframes eye-blink {
    0% {
      background-position:
        0 -0.7em,
        center;
      opacity: 1;
    }
    25% {
      background-position:
        0 0,
        center;
    }
    50% {
      background-position:
        0 -0.7em,
        center;
    }
    75% {
      opacity: 1;
    }
    100% {
      background-position:
        0 -0.7em,
        center;
      opacity: 0;
    }
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

  @media (prefers-reduced-motion: reduce) {
    /* Straight to the resting mark: no story, no blink — and the
       eye interior goes too (it only exists to be shed). */
    .o-dot,
    .o-dot[data-dot='2']::after,
    .dots-visual.settled .o-dot[data-dot='2']::after {
      animation: none;
      transition: none;
    }
    .o-dot[data-dot='2']::after {
      opacity: 0;
    }
  }
</style>
