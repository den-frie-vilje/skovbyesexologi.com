<!--
  Service detail page shell. Consumed by both
  `routes/ydelser/[slug]/+page.svelte` (DA) and
  `routes/en/services/[slug]/+page.svelte` (EN) — the two routes
  handle URL resolution, hreflang, and canonical tags; this
  component only concerns itself with presenting one service.

  Content model intentionally matches the existing Service type
  (see $lib/content) so no schema migration is needed to ship the
  first service page. Sections render only when the corresponding
  content fields are present (`supports`, `testimonial`, `studios`),
  which lets each service grow richer over time without this
  component branching.

  No FlodStage here yet — deferred until per-service stage anchors
  are designed. The `.flod` gradient background still reads cleanly
  as a static backdrop, and the @media (prefers-reduced-motion)
  code path on the homepage is effectively the default here.
-->
<script lang="ts">
  import type {
    HomeList,
    HomeManifest,
    HomeRitual,
    Locale,
    LocaleBundle,
    Service
  } from '$lib/content';
  import { primaryNav } from '$lib/content';
  import { mainPoses, goldPoses, gemPoses } from '$lib/stage/poses';
  import SiteHeader from './SiteHeader.svelte';
  import SiteFooter from './SiteFooter.svelte';
  import ContactSection from './ContactSection.svelte';
  import Testimonials from './Testimonials.svelte';
  import FlodStage from './FlodStage.svelte';
  import StickyCta from './StickyCta.svelte';
  import ManifestSection from './ManifestSection.svelte';
  import RitualSection from './RitualSection.svelte';
  import NumberedList from './NumberedList.svelte';

  interface Props {
    locale: Locale;
    service: Service;
    /** The `contentFor(locale)` bundle — passed in rather than
     *  re-derived so the caller controls locale reactivity. */
    bundle: LocaleBundle;
    /** Copy of the caller's rendered footer copyright. The template
     *  render lives at the route level so year/name/CVR tokens
     *  resolve with the same clock the rest of the page uses. */
    footerCopyright: string;
    /** Label for the "back to all services" link at the page bottom.
     *  Passed in so it translates with the locale. */
    backLabel: string;
    /** Destination of the back link — the homepage of the current
     *  locale, i.e. `/` for DA or `/en` for EN. */
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
    locale,
    service,
    bundle,
    footerCopyright,
    backLabel,
    backHref,
    manifest,
    ritual,
    forPersonal
  }: Props = $props();

  const hero = $derived(bundle.home.hero);
  const contact = $derived(bundle.contact);

  /*
    Per-service stage configuration: resolve the content's named
    poses into concrete NDC coords, and map the narrative chapter
    into FlodStage's `chapterMode` (0 = terapi / iridescent,
    1 = konsulent / chrome).

    The service page has no scroll-driven anchor changes — it's one
    article, one pose. The `.service-stage-zone` below is a
    full-viewport anchor so FlodStage always sees visibility 1.0
    and settles on the pose in the first few frames.
  */
  const stageAnchors = $derived([
    {
      selector: '.service-stage-zone',
      main: mainPoses[service.stage.main],
      drip1: goldPoses[service.stage.gold],
      drip2: gemPoses[service.stage.gem],
      intensity: service.stage.intensity ?? 1.0
    }
  ]);
  const chapterMode = $derived(service.chapter === 'konsulent' ? 1 : 0);
</script>

<div class="flod flod-service" lang={locale} data-chapter={service.chapter}>
  <!--
    Full-viewport FlodStage. Same component as the homepage, but
    mounted with a single fixed anchor from the service's content
    config (typically one element at `fullBleed` acting as a
    background wash). Automatically skips mount under
    `prefers-reduced-motion: reduce`.
  -->
  <FlodStage anchors={stageAnchors} {chapterMode} />

  <!--
    Invisible, full-card anchor span — FlodStage reads its
    bounding rect for visibility weighting. Inset:0 keeps the
    weight at 1.0 regardless of scroll position.
  -->
  <span class="service-stage-zone" aria-hidden="true"></span>

  <SiteHeader
    name={hero.name}
    city={hero.city}
    homeHref={backHref}
    navLinks={primaryNav(locale)}
    burgerOpenLabel={locale === 'en' ? 'Open menu' : 'Åbn menu'}
    burgerCloseLabel={locale === 'en' ? 'Close menu' : 'Luk menu'}
    burgerMenuLabel={locale === 'en' ? 'Primary navigation' : 'Hovednavigation'}
  />

  <main>
    <article class="service-page">
      <!--
        Sticky CTA — pinned near the viewport bottom-right while
        the user is scrolling through this article, released when
        the article's bottom approaches (i.e. right before the
        contact section). Same component as the homepage's
        chapter-wrap CTAs; `position: sticky` behaves here because
        the article has enough height + a `padding-bottom: var(--cta-v)`
        to give the release point room.
      -->
      {#if service.cta}
        <StickyCta cta={service.cta} />
      {/if}

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

    <ContactSection {contact} />
  </main>

  <SiteFooter text={footerCopyright} />
</div>

<style>
  /*
    Same `.flod` palette the homepage uses — keeps service pages
    visually part of the site. `.flod-service` is a single-article
    variant: no scroll-driven konsulent split, just one solid
    chapter-appropriate bone tint decided by the `data-chapter`
    attribute (`terapi` → cool bone, `konsulent` → warm bone).
  */
  .flod {
    --bone: oklch(0.96 0.009 215);
    --bone-warm: oklch(0.94 0.03 72);
    --graphite: oklch(0.17 0.012 240);
    --graphite-soft: color-mix(in oklch, var(--graphite) 70%, transparent);
    --tangerine: oklch(0.94 0.26 120);
    --violet: oklch(0.48 0.09 152);
    --rule: color-mix(in oklch, var(--graphite) 18%, transparent);
    /* Sticky-CTA gutters — inherit `--cta-h` from StickyCta's
       own default (the 1320px homepage frame) so the CTA sits at
       the same distance from the viewport's right edge on every
       page type. The article's narrower 1100px max-width is a
       content constraint, not a chrome constraint. `--cta-v` is
       the inner gutter that controls the sticky release point. */
    --cta-v: 1.5rem;
    --cta-h-box: 3.3rem;
    min-height: 100vh;
    color: var(--graphite);
    font-family: var(--font-sans);
    font-weight: 300;
    position: relative;
    /* Contain FlodStage's position:fixed canvas (z-index: -1)
       within this page's stacking context — otherwise the canvas
       escapes behind the root and disappears. */
    isolation: isolate;
  }
  .flod-service[data-chapter='terapi'] {
    background: var(--bone);
  }
  .flod-service[data-chapter='konsulent'] {
    background: var(--bone-warm);
  }

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

  /* ============== ARTICLE FRAME ============== */
  /*
    `padding-bottom: var(--cta-v)` matches the homepage's
    chapter-wrap convention — the sticky CTA's release point sits
    this far above the article's bottom, so the CTA scrolls out of
    the viewport just before the contact section begins.
  */
  .service-page {
    max-width: 1100px;
    margin: 0 auto;
    padding: clamp(3rem, 8vw, 6rem) 1.25rem var(--cta-v);
  }
  /*
    StickyCta's fixed height gets negated here by lifting the
    first post-CTA section up by an equal amount — otherwise the
    header would start a full button's height below the top
    padding. Same pattern as `.chapter-wrap > :nth-child(2)` on
    the homepage.
  */
  .service-page > :nth-child(2) {
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
