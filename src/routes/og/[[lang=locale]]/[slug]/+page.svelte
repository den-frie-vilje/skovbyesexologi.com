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
  import FlodStage from '$lib/components/FlodStage.svelte';
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
    Single stage anchor pinned to `.og-stage-zone` (full-area span
    inside the 780×630 text column wrapper — portrait column is
    excluded so Signe never covers the gem). With no scroll activity
    the FlodStage settles on this target in the first few frames.
    Poses mostly mirror home.json's "hero" section, with one
    divergence — the gold is pulled down to the bottom (using the
    `disperseLowR` pose) because the hero's top-left gold landed
    right over the "SKOVBYE SEXOLOGI" mark in the OG's narrower
    780×630 render area and crowded the brand line.
      main:  mainPoses.heroFarRight  ( 1.15, -0.1,  1.05)
      drip1: goldPoses.disperseLowR  ( 0.35, -0.75, 0.78)
      drip2: gemPoses.heroBRhuge     ( 0.9,  -0.9,  1.5)
      intensity: 1.10
    Values are inlined rather than imported so this route stays
    zero-dep. If poses.ts changes, update here too.
  */
  const ogAnchors = [
    {
      selector: '.og-stage-zone',
      main:  { x: 1.15, y: -0.1,  scale: 1.05 },
      drip1: { x: 0.35, y: -0.75, scale: 0.78 },
      drip2: { x: 0.9,  y: -0.9,  scale: 1.5 },
      intensity: 1.1
    }
  ];

  /*
    Stage render area: the 780×630 left column only. Passing these
    dimensions as props makes FlodStage size its WebGL buffer and
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

<div class="og" data-slug={data.slug} data-locale={data.locale}>
  <!--
    Real FlodStage, constrained to the 780×630 text column so the
    hero pose's bottom-right gem stays visible (the 420px portrait
    column would otherwise cover it). The wrapper's translateZ(0)
    creates a containing block so FlodStage's position:fixed canvas
    is clipped to the wrapper rather than the full 1200×630 card.

    Headed Chromium (via `pnpm og`) has ~6s after load to let the
    Three.js modules import, shaders compile, and the pose settle
    before the screenshot fires — see scripts/gen-og-images.ts.
  -->
  <div class="og-stage-wrap">
    <FlodStage
      anchors={ogAnchors}
      chapterMode={0}
      width={STAGE_W}
      height={STAGE_H}
    />
    <span class="og-stage-zone" aria-hidden="true"></span>
  </div>

  <div class="og-inner">
    <!-- Left: text column -->
    <div class="og-text">
      <p class="og-mark">
        <span>{hero.name}</span>
        <span class="og-dot">·</span>
        <span>{hero.city}</span>
      </p>

      <h1 class="og-name">
        {nameSection.firstName} <em>{nameSection.lastName}</em>
      </h1>

      <p class="og-role">{nameSection.roleLine}</p>

      <ul class="og-services">
        {#each services as s}
          <li>
            <span class="og-num">{s.number}</span>
            <span class="og-title">{s.title}</span>
          </li>
        {/each}
      </ul>

      <p class="og-url">skovbyesexologi.com</p>
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
     bypass .flod's gradient bg and fonts-link in +layout.svelte.
     ============================================================ */
  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  :global(body) {
    background: oklch(0.96 0.009 215); /* --bone, matches live site */
  }

  .og {
    width: 1200px;
    height: 630px;
    background:
      radial-gradient(ellipse at 85% 50%, oklch(0.94 0.03 72) 0%, transparent 60%),
      oklch(0.96 0.009 215);
    color: oklch(0.17 0.012 240); /* --graphite */
    font-family: 'Instrument Serif', 'Fraunces', serif;
    display: flex;
    align-items: stretch;
    box-sizing: border-box;
    overflow: hidden;
    position: relative;
    /* Contain FlodStage's fixed-position canvas to this 1200×630 card */
    isolation: isolate;
    /* Scoped CSS custom properties */
    --og-violet: oklch(0.48 0.09 152);
    --og-tangerine: oklch(0.94 0.26 120);
    --og-graphite: oklch(0.17 0.012 240);
    --og-graphite-soft: color-mix(in oklch, var(--og-graphite) 70%, transparent);
  }

  /*
    Stage wrapper — constrains FlodStage to the 780×630 left column.
    `transform: translateZ(0)` promotes this to a containing block
    for fixed descendants, so FlodStage's position:fixed canvas is
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
       but above .og's background. FlodStage's own canvas sets
       z-index:-1 within this scope, which with isolation here lifts
       to paint above .og's gradient background. */
    isolation: isolate;
    overflow: hidden;
  }

  /*
    Override FlodStage's default full-viewport sizing inside the OG
    card. Without this, `.flod-stage` stays at `position: fixed;
    inset: 0; width: 100vw; height: 100vh`, which escapes the
    .og-stage-wrap containing block (100vw/100vh are viewport units,
    not container-relative). Scoped with :global() because
    .flod-stage is defined inside the FlodStage component.
  */
  :global(.og-stage-wrap .flod-stage) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  /*
    Invisible anchor span — FlodStage reads its bounding rect to
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
    z-index: 1; /* paint above the FlodStage canvas */
  }

  /* ============================================================
     Left column — text
     ============================================================ */
  .og-text {
    padding: 56px 48px 48px 72px;
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
  }

  .og-mark {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 15px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--og-graphite-soft);
    margin: 0 0 48px;
    display: flex;
    gap: 0.9em;
    align-items: baseline;
  }
  .og-dot {
    color: var(--og-violet);
  }

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
    margin: 0 0 28px;
    color: var(--og-graphite);
  }
  .og-name em {
    font-style: italic;
    font-weight: 500; /* matches .name-section h2 em on the home page */
    /* Echo the chartreuse highlight from the hero "burde/should" */
    background:
      linear-gradient(
        to top,
        var(--og-tangerine) 10%,
        var(--og-tangerine) 35%,
        transparent 35%
      );
    padding: 0 0.04em;
  }

  .og-role {
    font-family: 'Fraunces', 'Instrument Serif', serif;
    font-size: 24px;
    line-height: 1.35;
    color: color-mix(in oklch, var(--og-graphite) 85%, transparent);
    margin: 0 0 36px;
    max-width: 28ch;
  }

  .og-services {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 10px;
  }
  .og-services li {
    display: grid;
    grid-template-columns: 44px 1fr;
    align-items: baseline;
    font-family: 'Fraunces', serif;
    font-size: 22px;
    line-height: 1.25;
    color: var(--og-graphite);
  }
  .og-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    letter-spacing: 0.12em;
    color: var(--og-violet);
  }

  .og-url {
    margin: auto 0 0; /* pushed to the bottom of the column */
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--og-graphite-soft);
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
    background: var(--og-tangerine);
    border-radius: 1px;
  }
</style>
