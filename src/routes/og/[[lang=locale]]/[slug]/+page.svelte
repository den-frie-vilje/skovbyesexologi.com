<!--
  OG image layout (1200×630) — not a public-facing route. Rendered
  as a real Svelte page so you can iterate on the design live at
  /og/home (DA) or /og/en/home (EN), then the gen-og-images script
  screenshots each URL to PNG.

  noindex/nofollow so search engines don't crawl these raw layouts
  directly (they'll still see the generated PNG referenced as
  og:image from the real pages).

  Layout: split 60/40. Left column holds the brand mark, name,
  role line, and service list. Right column is the portrait (full
  height, softly tinted into the palette). Small URL footer ties
  the image back to the site.
-->
<script lang="ts">
  import { contentFor } from '$lib/content';
  import Stage from '$lib/components/Stage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const bundle = $derived(contentFor(data.locale));
  const site = $derived(bundle.site);
  const home = $derived(bundle.home);
  const bio = $derived(bundle.bio);
  const services = $derived(bundle.services);
  const hero = $derived(home.hero);
  const nameSection = $derived(home.nameSection);
  /*
    Always render the production hostname in the OG image — the
    PNG is baked at generate time and will be served from the
    production site regardless of how/when it was captured.
    Pulling from `SITE_URL` / `PUBLIC_SITE_URL` ties the image's
    label to the build-time env (localhost in dev, staging's
    hostname on staging), which is noise in a social share card.
  */
  const siteHostname = 'skovbyesexologi.com';

  /*
    Single stage anchor pinned to `.og-stage-zone` (full-area span
    inside the 780×630 text column wrapper — portrait column is
    excluded so Signe never covers the gem). With no scroll activity
    the Stage settles on this target in the first few frames.
    Poses — main mirrors home.json's hero section; gold is
    nudged upper-centre so it sits clear of both the mercury orb
    (whose visible edge sweeps up to y≈0.9 on the right) and the
    text column (title upper-left, URL bottom-left). Not an
    existing named pose — a custom (0.35, 0.8) for this one
    layout.
      bubble: bubblePoses.heroFarRight  ( 1.15, -0.1,  1.05)
      drops: (custom upper-centre)   ( 0.35,  0.8,  0.45)
      gem: gemPoses.heroBRhuge     ( 0.9,  -0.9,  1.5)
      intensity: 1.10
    Values are inlined rather than imported so this route stays
    zero-dep. If poses.ts changes, update here too.
  */
  const ogAnchors = [
    {
      selector: '.og-stage-zone',
      bubble: { x: 1.15, y: -0.1, scale: 1.05 },
      drops:  { x: 0.35, y: 0.8,  scale: 0.45 },
      gem:    { x: 0.9,  y: -0.9, scale: 1.5 },
      intensity: 1.1
    }
  ];

  /*
    Stage render area: the 780×630 left column only. Passing these
    dimensions as props makes Stage size its WebGL buffer and
    camera aspect to the text column, so the heroBRhuge gem at
    NDC (0.9, -0.9) lands inside the text column rather than under
    the portrait (which would hide it entirely).
  */
  const STAGE_W = 780;
  const STAGE_H = 630;
</script>

<svelte:head>
  <title>{site.name} — OG image</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div
  class="og"
  class:og-service={data.kind === 'service'}
  data-slug={data.slug}
  data-locale={data.locale}
  data-chapter={data.chapter}
>
  <!--
    Real Stage, constrained to the 780×630 text column so the
    hero pose's bottom-right gem stays visible (the 420px portrait
    column would otherwise cover it). The wrapper's translateZ(0)
    creates a containing block so Stage's position:fixed canvas
    is clipped to the wrapper rather than the full 1200×630 card.

    Headed Chromium (via `pnpm og`) has ~6s after load to let the
    Three.js modules import, shaders compile, and the pose settle
    before the screenshot fires — see scripts/gen-og-images.ts.
  -->
  <div class="og-stage-wrap">
    <Stage
      anchors={ogAnchors}
      chapterMode={data.chapter === 'konsulent' ? 1 : 0}
      width={STAGE_W}
      height={STAGE_H}
    />
    <span class="og-stage-zone" aria-hidden="true"></span>
  </div>

  <div class="og-inner">
    <!-- Left: text column -->
    <div class="og-text">
      <!--
        Eyebrow is just the city — the brand name is already
        implied by the big title below, so repeating it reads as
        noise at messenger-preview sizes. Doubled in size from
        the earlier mono eyebrow so the location still lands.
      -->
      <p class="og-mark">{hero.city}</p>

      {#if data.kind === 'home'}
        <!--
          Home OG: proprietor name as the hero — "Signe" plain +
          "Skovbye" italicised with chartreuse underline, then a
          bullet list of the three practice roles as the "what".
        -->
        <h1 class="og-name">
          {data.title} <em>{data.em}</em>
        </h1>

        <ul class="og-roles">
          {#each nameSection.roleLine.replace(/\.\s*$/, '').split(/\s*·\s*/) as role}
            <li><span>{role}</span></li>
          {/each}
        </ul>
      {:else}
        <!--
          Service OG layout, top → bottom: the service title
          claims the hero, the kicker lands as a dark-green
          italic subheading underneath, URL pins to the bottom.
          No proprietor byline here — the URL + portrait + visual
          identity already say "Signe", and every extra typographic
          slot was pushing content toward the URL's reserved space
          at the densest titles (EN "Psychomotor sexological
          therapy" wraps three lines).
        -->
        <h1 class="og-service-title">{data.title}</h1>
        <p class="og-kicker">{data.kicker}</p>
      {/if}

      <p class="og-url">{siteHostname}</p>
    </div>

    <!-- Right: portrait + accent. -->
    <div class="og-portrait">
      <img
        src="/img/signe.jpg"
        alt={bio.portraitAlt}
        width="1200"
        height="1400"
      />
      <span class="og-accent" aria-hidden="true"></span>
    </div>
  </div>
</div>

<style>
  /* ============================================================
     Root override — this is the ONLY content on the page. The OG
     page is designed for screenshotting at a fixed 1200×630 so we
     bypass .app-shell's gradient bg and fonts-link in +layout.svelte.
     ============================================================ */
  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  :global(body) {
    background: oklch(0.96 0.009 215); /* --surface, matches live site */
  }

  .og {
    width: 1200px;
    height: 630px;
    color: oklch(0.17 0.012 240); /* --text */
    font-family: 'Instrument Serif', 'Fraunces', serif;
    display: flex;
    align-items: stretch;
    box-sizing: border-box;
    overflow: hidden;
    position: relative;
    /* Contain Stage's fixed-position canvas to this 1200×630 card */
    isolation: isolate;
    /* Scoped CSS custom properties */
    --og-accent: oklch(0.48 0.09 152);
    --og-highlight: oklch(0.94 0.26 120);
    --og-text: oklch(0.17 0.012 240);
    --og-surface: oklch(0.96 0.009 215);
    --og-surface-warm: oklch(0.94 0.03 72);
    --og-text-muted: color-mix(in oklch, var(--og-text) 70%, transparent);
  }
  /*
    Chapter palette — matches the live site's terapi vs konsulent
    scheme: terapi is cool surface (with a warm-tint radial hint on
    the right so the iridescent orb sits in a warm glow), konsulent
    is warm surface (with a cool-tint radial hint on the right where
    the chrome elements catch the blue cast). Home OG is terapi.
  */
  .og[data-chapter='terapi'] {
    background:
      radial-gradient(ellipse at 85% 50%, var(--og-surface-warm) 0%, transparent 60%),
      var(--og-surface);
  }
  .og[data-chapter='konsulent'] {
    background:
      radial-gradient(ellipse at 85% 50%, var(--og-surface) 0%, transparent 60%),
      var(--og-surface-warm);
  }

  /*
    Stage wrapper — constrains Stage to the 780×630 left column.
    `transform: translateZ(0)` promotes this to a containing block
    for fixed descendants, so Stage's position:fixed canvas is
    captured inside this box rather than filling the 1200×630 card
    (which would extend it behind the portrait and hide the gem).
  */
  .og-stage-wrap {
    position: absolute;
    left: 0;
    top: 0;
    width: 780px;
    height: 630px;
    transform: translateZ(0);
    pointer-events: none;
    /* Sits in the default (auto) layer, below .og-inner (z-index:1)
       but above .og's background. Stage's own canvas sets
       z-index:-1 within this scope, which with isolation here lifts
       to paint above .og's gradient background. */
    isolation: isolate;
    overflow: hidden;
  }

  /*
    Override Stage's default full-viewport sizing inside the OG
    card. Without this, `.stage-host` stays at `position: fixed;
    inset: 0; width: 100vw; height: 100vh`, which escapes the
    .og-stage-wrap containing block (100vw/100vh are viewport units,
    not container-relative). Scoped with :global() because
    .stage-host is defined inside the Stage component.
  */
  :global(.og-stage-wrap .stage-host) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  /*
    Invisible anchor span — Stage reads its bounding rect to
    compute the visibility weight for ogAnchors[0]. Full-wrap
    inset:0 means weight stays at 1.0, so the stage settles on the
    configured pose in the first few frames.
  */
  .og-stage-zone {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .og-inner {
    display: grid;
    grid-template-columns: 1fr 420px;
    width: 100%;
    height: 100%;
    position: relative;
    z-index: 1; /* paint above the Stage canvas */
  }

  /* ============================================================
     Left column — text
     ============================================================ */
  /*
    Left text column — content stacks from the top, URL pinned to
    the bottom via `position: absolute` so it never gets pushed
    off the card no matter how much the title wraps. `padding-bottom`
    reserves room for the URL so the content above doesn't collide
    with it at the densest layouts.
  */
  .og-text {
    padding: 56px 48px 108px 72px;
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
    position: relative;
  }

  /*
    Eyebrow — city only, doubled from 15px to 30px so it reads at
    messenger-preview sizes without drowning the title below.
  */
  .og-mark {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 30px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--og-text-muted);
    margin: 0 0 48px;
  }
  /* Service OGs keep the default eyebrow→title gap. The byline
     now lives at the bottom of the column (above the URL), so
     no extra tightening is needed up top. */

  /*
    Title — must match the live homepage's name-section h2 exactly.
    `Fraunces` only (serif fallback is Georgia via ui-serif); the
    earlier 'Instrument Serif' stack here produced a noticeably
    different italic, breaking visual parity with the site hero.
    Fraunces is wider than Instrument Serif at the same size, so
    `font-size` is 104px (not the old 128) to keep "Signe Skovbye"
    on a single line inside the 780-col text area (660px internal
    after padding).
  */
  .og-name {
    font-family: 'Fraunces', ui-serif, Georgia, serif;
    font-size: 104px;
    font-weight: 400;
    line-height: 0.92;
    letter-spacing: -0.02em;
    /* More breathing room before the bullet list — the title is
       visually dense enough that a 28px gap felt like the bullets
       were pinned to the baseline of the name. */
    margin: 0 0 52px;
    color: var(--og-text);
  }
  .og-name em {
    font-style: italic;
    font-weight: 500; /* matches .name-section h2 em on the home page */
    /* Echo the chartreuse highlight from the hero "burde/should" */
    background:
      linear-gradient(
        to top,
        var(--og-highlight) 10%,
        var(--og-highlight) 35%,
        transparent 35%
      );
    padding: 0 0.04em;
  }

  /*
    Role bullet list — one role per row with an em-dash marker in
    chartreuse echoing the back-link arrow. Prevents the earlier
    middot run from wrapping mid-phrase and reading as a broken
    list. `::marker` is enough here since the bullets are flat
    serif text; no nested alignment needed.
  */
  .og-roles {
    list-style: none;
    padding: 0;
    margin: 0 0 36px;
    font-family: 'Fraunces', 'Instrument Serif', serif;
    font-size: 38px;
    line-height: 1.2;
    color: color-mix(in oklch, var(--og-text) 88%, transparent);
  }
  .og-roles li {
    display: grid;
    grid-template-columns: 1.2em 1fr;
    gap: 0.35em;
  }
  .og-roles li::before {
    content: '—';
    color: var(--og-accent);
  }
  /*
    Force a capital first letter on each role — a formatting
    concern, not a content one. Content stays as sentence-case
    "intimitetskoordinator" / "psykomotorisk terapeut" so the
    same strings flow unmodified into the rest of the site.
    Applied to the wrapping `<span>` so the em-dash marker in
    `::before` isn't affected.
  */
  .og-roles li span::first-letter {
    text-transform: uppercase;
  }

  /*
    Service OG variant: small Signe byline above the service
    title, then the blurb as prose below. Byline sits at roughly
    half the home OG's hero size (52px), the service title claims
    the hero slot at 72px (small enough that long Danish
    compounds — "Seksuel sundhed i ældresektoren" — wrap to a
    clean two-liner rather than a three-liner), and the blurb is
    comfortable reading prose at 26px.
  */
  /*
    Service title is the hero of every service OG (the
    proprietor byline was dropped — the URL + portrait + overall
    visual identity carry "Signe" without extra typography).
    96px gives the title a stronger presence on the card and
    still accommodates the wrapped EN "Psychomotor sexological
    therapy" without pushing the URL off the bottom.
  */
  .og-service-title {
    font-family: 'Fraunces', ui-serif, Georgia, serif;
    font-size: 96px;
    font-weight: 400;
    line-height: 0.95;
    letter-spacing: -0.02em;
    color: var(--og-text);
    margin: 0 0 32px;
  }
  /*
    Kicker — short service tagline beneath the title. Middot-
    separated audiences ("solo · par · poly" / "film · tv ·
    teater"). Italic serif in dark green (the `--og-accent`
    accent) so it reads as a branded subheading rather than
    body prose.
  */
  .og-kicker {
    font-family: 'Fraunces', ui-serif, Georgia, serif;
    font-style: italic;
    font-size: 32px;
    line-height: 1.25;
    color: var(--og-accent);
    margin: 0 0 36px;
    max-width: 22ch;
  }

  /*
    URL — anchored to the bottom of the text column so the
    content above can grow (long titles wrapping, extra lines in
    the kicker) without pushing the URL off the card. 28px for
    messenger-preview legibility.
  */
  .og-url {
    position: absolute;
    left: 72px;
    bottom: 48px;
    margin: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 28px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--og-text-muted);
  }

  /* ============================================================
     Right column — portrait
     ============================================================ */
  .og-portrait {
    position: relative;
    width: 420px;
    height: 100%;
    overflow: hidden;
  }
  .og-portrait img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* Subtle warm filter so portrait feels part of the palette */
    filter: saturate(0.94) contrast(1.02);
  }
  /* Small chartreuse accent mark lower-right — a nod to the site's
     highlighter underline without redrawing the WebGL stage. */
  .og-accent {
    position: absolute;
    right: 44px;
    bottom: 44px;
    width: 64px;
    height: 8px;
    background: var(--og-highlight);
    border-radius: 1px;
  }
</style>
