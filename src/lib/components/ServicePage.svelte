<!--
  Service detail page — content-only component. Consumed by both
  `routes/(app)/ydelser/[slug]/+page.svelte` (DA) and
  `routes/(app)/en/services/[slug]/+page.svelte` (EN); each route
  handles URL resolution, hreflang, and canonical tags.

  The `.flod` shell, FlodStage, SiteHeader, ContactSection, and
  SiteFooter all live in `(app)/+layout.svelte` — they mount once
  and persist across client-side navigation, so switching from
  one service page to another (or home → service) keeps the same
  WebGL stage instance and lerps its pose rather than
  re-initialising. This component only contributes the article
  content + publishes stage config to the shared `stage` store.
-->
<script lang="ts">
  import type {
    HomeList,
    HomeManifest,
    HomeRitual,
    LocaleBundle,
    Service
  } from '$lib/content';
  import { mainPoses, goldPoses, gemPoses } from '$lib/stage/poses';
  import { stage } from '$lib/stage/store.svelte';
  import Testimonials from './Testimonials.svelte';
  import StickyCta from './StickyCta.svelte';
  import ManifestSection from './ManifestSection.svelte';
  import RitualSection from './RitualSection.svelte';
  import NumberedList from './NumberedList.svelte';

  interface Props {
    service: Service;
    /** The `contentFor(locale)` bundle — passed in rather than
     *  re-derived so the caller controls locale reactivity. Used
     *  here for the chapter-level CTA fallback (looks up terapi
     *  / intimacy-coordination's own cta when the current
     *  service doesn't define one). */
    bundle: LocaleBundle;
    /** Label for the "back to all services" link at the article
     *  bottom. Passed in so it translates with the locale. */
    backLabel: string;
    /** Destination of the back link — the homepage of the
     *  current locale: `/` (DA) or `/en` (EN). */
    backHref: string;
    /**
     * Optional chapter-context blocks carried over from the
     * homepage. For services in the terapi chapter we typically
     * pass `home.manifest`, `home.ritual`, and `home.forPersonal`
     * so the detail page echoes the therapy philosophy / session
     * rhythm / "this is for you if…" list rather than ending
     * abruptly after the bullets. Omit individually to hide.
     */
    manifest?: HomeManifest;
    ritual?: HomeRitual;
    forPersonal?: HomeList;
  }

  let {
    service,
    bundle,
    backLabel,
    backHref,
    manifest,
    ritual,
    forPersonal
  }: Props = $props();

  /*
    Resolve the sticky CTA with a chapter-level fallback:
      • Prefer the service's own `cta` if defined.
      • Otherwise, fall back to the chapter's "lead" service:
        terapi chapter → the terapi service's "Book en tid",
        konsulent chapter → the intimacy-coordination service's
        "Kom i kontakt". This mirrors the homepage, where one
        CTA covers the whole konsulent chapter (intimacy, elder
        care, teaching) rather than one per service section.
    The effect: every service detail page has a sticky CTA even
    when its own content JSON doesn't define one.
  */
  const effectiveCta = $derived(
    service.cta ??
      (service.chapter === 'konsulent'
        ? bundle.services.find((s) => s.id === 'intimacy-coordination')?.cta
        : bundle.services.find((s) => s.id === 'terapi')?.cta)
  );

  /*
    Publish this service's stage config to the shared store. The
    layout's persistent FlodStage consumes it; when navigating
    between services (or home → service), the new anchors +
    chapterMode land on the same FlodStage instance and it lerps
    to the new pose.

    `.service-stage-zone` (rendered below as a fixed full-viewport
    span) is the anchor selector — keeps visibility at 1.0 so the
    stage settles on the configured pose in the first few frames.

    `stage.konsulentY` branches on chapter:
      • terapi  → null (layout's CSS fallback → whole page cool)
      • konsulent → 0 (gradient split at the very top → whole
                        page warm)
  */
  $effect(() => {
    stage.anchors = [
      {
        selector: '.service-stage-zone',
        main: mainPoses[service.stage.main],
        drip1: goldPoses[service.stage.gold],
        drip2: gemPoses[service.stage.gem],
        intensity: service.stage.intensity ?? 1.0
      }
    ];
  });
  $effect(() => {
    stage.chapterMode = service.chapter === 'konsulent' ? 1 : 0;
  });
  $effect(() => {
    stage.konsulentY = service.chapter === 'konsulent' ? 0 : null;
  });
</script>

<!--
  Invisible full-viewport anchor span — FlodStage reads its
  bounding rect for visibility weighting, so a fixed-inset span
  keeps the weight at 1.0 regardless of scroll position. Lives
  outside the article's flow via `position: fixed`, takes no
  layout space.
-->
<span class="service-stage-zone" aria-hidden="true"></span>

<!--
  `.service-wrap` mirrors the homepage's `.chapter-wrap`: it spans
  the full viewport width (no max-width, no horizontal padding) so
  that `<StickyCta>` — a child of this wrap — computes its right
  gutter against the viewport edge via `--cta-h` rather than
  against the inner article's padded content box. Without this
  wrap the CTA would be nested inside `.service-page`'s 2rem
  padding and end up `padding + --cta-h` from the viewport edge,
  sitting visibly further in than the homepage CTA at wide
  breakpoints.
-->
<div class="service-wrap" class:has-cta={!!effectiveCta}>
  <!--
    Sticky CTA — pinned near the viewport bottom-right while the
    user is scrolling through this article, released when the
    wrap's bottom approaches (i.e. right before the contact
    section). Uses `effectiveCta` (with chapter-level fallback)
    so every service gets a CTA, matching the homepage where one
    CTA covers the whole konsulent chapter.
  -->
  {#if effectiveCta}
    <StickyCta cta={effectiveCta} />
  {/if}

  <article class="service-page">
      <!-- ============== HEADER ============== -->
      <header class="s-head">
        <!--
          No service number here — the "01/02/03/04" ordering is a
          listing convention for the homepage's four-service grid,
          where it helps skim. On a detail page the number carries
          no meaning: the page IS the service.
        -->
        <p class="s-eyebrow">
          <span class="s-kicker">{service.kicker}</span>
        </p>
        <h1 class="s-title">{service.title}</h1>
        <p class="s-blurb">{service.blurb}</p>
      </header>

      <!-- ============== WHAT'S INCLUDED ============== -->
      {#if service.bullets.length > 0}
        <section class="s-block s-bullets-block">
          <ul class="s-bullets">
            {#each service.bullets as bullet, i}
              <li>
                <span class="b-num">{String(i + 1).padStart(2, '0')}</span>
                <span class="b-text">{bullet}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <!-- ============== SUPPORTS (therapy) ============== -->
      <!--
        Prose rendering — middot-joined italic line — mirrors how
        the homepage renders the same field in its service card.
        Earlier the detail page used pill chips, which introduced
        a typographic element the rest of the site doesn't use;
        the prose form keeps detail pages quieter than the
        homepage while staying inside the design vocabulary.
      -->
      {#if service.supports && service.supportsLabel}
        <section class="s-block s-supports-block">
          <p class="s-label">{service.supportsLabel}</p>
          <p class="s-supports">{service.supports.join(' · ')}</p>
        </section>
      {/if}

      <!--
        Optional chapter-context blocks from the homepage —
        passed in explicitly by the route when the service's
        `chapter` makes them relevant (today: terapi carries
        manifest + ritual + forPersonal over). Keeps each detail
        page from ending abruptly after bullets and gives the
        philosophical / process / audience framing that the
        homepage has the space to unfold.
      -->

      <!--
        Chapter-context blocks rendered via reusable components.
        Each renders the same design the homepage uses for the
        corresponding content (manifest / ritual / for-personal),
        so a user arriving on a detail page encounters familiar
        type + rhythm rather than new typographic elements.
      -->
      {#if manifest}
        <section class="s-block">
          <ManifestSection {manifest} />
        </section>
      {/if}
      {#if ritual}
        <section class="s-block">
          <RitualSection {ritual} />
        </section>
      {/if}
      {#if forPersonal}
        <section class="s-block">
          <NumberedList list={forPersonal} />
        </section>
      {/if}

      <!-- ============== STUDIOS ============== -->
      <!--
        Studios sit between the concrete "what's included" bullets
        and the testimonials — logos read as "I've worked with" and
        flow naturally into "here's what they said".
      -->
      {#if service.studios && service.studiosLabel}
        <section class="s-block s-studios-block">
          <p class="s-label">{service.studiosLabel}</p>
          <ul class="s-studios">
            {#each service.studios as studio}
              <li>
                {#if studio.url}
                  <a href={studio.url} target="_blank" rel="noopener noreferrer">
                    <img src={studio.logo} alt={studio.name} />
                  </a>
                {:else}
                  <img src={studio.logo} alt={studio.name} />
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <!-- ============== TESTIMONIALS ============== -->
      {#if service.testimonials && service.testimonials.length > 0}
        <section class="s-block s-testimonials-block">
          <Testimonials items={service.testimonials} />
        </section>
      {/if}

      <!-- No inline CTA block — the sticky StickyCta at the top
           of the article is the primary call-to-action. Keeping
           the page flow ending on the back-link anchor. -->

      <!-- ============== BACK LINK ============== -->
      <nav class="s-back">
        <a href={backHref}>← {backLabel}</a>
      </nav>
  </article>
</div>

<style>
  /*
    `.flod` design tokens, gradient bg, and stacking context all
    live in `(app)/+layout.svelte` — this component inherits them
    via normal CSS cascade. The terapi/konsulent palette branch
    happens through the shared store's `konsulentY` (see the
    `$effect` above): setting it to 0 makes the layout's gradient
    paint the whole viewport warm, null falls through to the CSS
    fallback of 200vh = whole viewport cool.
  */

  /* Full-viewport invisible anchor — FlodStage uses its bounding
     rect to compute visibility weighting. Fixed so it stays in
     view regardless of scroll, keeping the stage settled on the
     service's configured pose. */
  .service-stage-zone {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: -1;
  }

  /* ============== WRAP + ARTICLE FRAME ============== */
  /*
    `.service-wrap` spans the full viewport width with no
    horizontal padding — directly parallel to the homepage's
    `.chapter-wrap`. It exists so the <StickyCta> child can
    compute its right gutter via `--cta-h` against the viewport
    edge, producing the same flush-to-edge placement the
    homepage CTA has. Any horizontal padding on this wrap would
    be additive with `--cta-h` and push the CTA inward.

    `padding-bottom: var(--cta-v)` matches the homepage's
    chapter-wrap convention — the sticky CTA's release point
    sits this far above the wrap's bottom, so the CTA scrolls
    out of the viewport just before the contact section begins.
  */
  .service-wrap {
    position: relative;
    padding-bottom: var(--cta-v);
  }
  /*
    The article holds the page content and caps at the same 1320px
    frame the homepage sections use, with the same 2rem horizontal
    padding — so service detail pages share the home's left/right
    gutters at every breakpoint.
  */
  .service-page {
    max-width: 1320px;
    margin: 0 auto;
    padding: clamp(3rem, 8vw, 6rem) 2rem 0;
  }
  /*
    StickyCta is `.service-wrap`'s first child and takes up
    `--cta-h-box` of vertical space in flow. Pull the SECOND
    child (the `.service-page` article) up by exactly that
    amount so the article's top padding starts where it would
    have without the CTA above it — same trick the homepage
    uses on `.chapter-wrap > :nth-child(2)`. Gated on `.has-cta`
    so services without a CTA don't collapse their top padding.
  */
  .service-wrap.has-cta > :nth-child(2) {
    margin-top: calc(-1 * var(--cta-h-box));
  }

  /* ============== HEADER ============== */
  .s-head {
    margin-bottom: clamp(3rem, 6vw, 5rem);
  }
  .s-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin: 0 0 1.5rem;
  }
  .s-kicker {
    color: var(--graphite-soft);
  }
  .s-title {
    font-family: var(--font-serif);
    font-size: clamp(2.5rem, 7vw, 5rem);
    line-height: 1;
    font-weight: 400;
    letter-spacing: -0.02em;
    margin: 0 0 2rem;
    max-width: 22ch;
  }
  .s-blurb {
    font-family: var(--font-serif);
    font-size: clamp(1.15rem, 2vw, 1.4rem);
    line-height: 1.5;
    color: color-mix(in oklch, var(--graphite) 88%, transparent);
    max-width: 42ch;
    margin: 0;
  }

  /* ============== BLOCKS ============== */
  .s-block {
    margin-top: clamp(3rem, 6vw, 5rem);
  }
  .s-label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    margin: 0 0 1.5rem;
  }

  /* ============== BULLETS ============== */
  .s-bullets {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    /*
      No `gap` here — each <li> provides its own vertical rhythm
      via `padding: 1rem 0`. Adding a grid gap on top stacked
      gap + padding between items 2..n but left item 1 with only
      padding, so item 1 felt tighter against the top rule than
      the others against their dividers.
    */
    border-top: 1px solid var(--rule);
  }
  .s-bullets li {
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr);
    gap: 1.5rem;
    align-items: baseline;
    padding: 1rem 0;
    border-bottom: 1px solid var(--rule);
  }
  .b-num {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.14em;
    color: var(--violet);
    padding-top: 0.2rem;
  }
  .b-text {
    font-family: var(--font-serif);
    font-size: clamp(1.05rem, 1.6vw, 1.25rem);
    line-height: 1.45;
  }

  /* ============== SUPPORTS (italic prose line) ============== */
  .s-supports {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: clamp(1.05rem, 1.7vw, 1.25rem);
    line-height: 1.5;
    margin: 0;
    max-width: 52ch;
    color: color-mix(in oklch, var(--graphite) 88%, transparent);
  }

  /* Manifest / ritual / for-personal blocks render via the
     shared `<ManifestSection>`, `<RitualSection>`, and
     `<NumberedList>` components — styles live in those files
     so the detail page stays aligned with the homepage design
     without duplicated CSS. */

  /* Testimonials block rendered via $lib/components/Testimonials.svelte —
     styles live there so the same component can be used on the
     homepage featured section. */

  /* ============== STUDIOS ============== */
  .s-studios {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 2.5rem;
    align-items: center;
  }
  .s-studios li {
    line-height: 0;
  }
  .s-studios img {
    height: 28px;
    width: auto;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  .s-studios a:hover img,
  .s-studios a:focus-visible img {
    opacity: 1;
  }

  /* CTA moved from inline `.s-cta-block` to `<StickyCta>` at the
     top of the article — styles live in the component. */

  /* ============== BACK LINK ============== */
  .s-back {
    margin-top: clamp(4rem, 8vw, 6rem);
  }
  .s-back a {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    padding-bottom: 0.2rem;
    transition: color 0.15s, border-color 0.15s;
  }
  .s-back a:hover,
  .s-back a:focus-visible {
    color: var(--graphite);
    border-bottom-color: var(--graphite);
  }

  /* ============== RESPONSIVE ============== */
  @media (min-width: 720px) {
    .service-page {
      padding-left: 2rem;
      padding-right: 2rem;
    }
  }
  @media (min-width: 1024px) {
    .service-page {
      padding-left: 3rem;
      padding-right: 3rem;
    }
  }
</style>
