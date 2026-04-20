<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { bio, contact, home, serviceBySlug } from '$lib/content';
  import FlodStage from '$lib/components/FlodStage.svelte';
  import StickyCta from '$lib/components/StickyCta.svelte';
  import { resolveAnchor } from '$lib/stage/poses';

  // Chapter state — flips to 1 once the Konsulentydelser section scrolls
  // into the upper half of the viewport. Drives the FlodStage material
  // cross-fade. The bg is a hard-stop linear gradient on `.flod` whose
  // split-line (`--konsulent-y`) is the pixel position of the chapter
  // divider within `.flod`, so the warm paper bg behaves as if it's
  // scrolling up behind the 3D stage from the chapter-II line.
  //
  // Sticky CTAs (Book en tid / Kom i kontakt) no longer need any JS
  // state — each is the first child of its chapter-wrap div and uses
  // `position: sticky; bottom: X` to stay pinned to viewport bottom
  // until its container's end scrolls it up naturally.
  let chapterMode = $state(0);

  onMount(() => {
    if (!browser) return;
    const flodEl = document.querySelector('.flod') as HTMLElement | null;
    const chapterEl = document.querySelector('.chapter-konsulent');
    if (!flodEl || !chapterEl) return;
    let raf = 0;
    const measure = () => {
      const flodRect = flodEl.getBoundingClientRect();
      const chapterRect = chapterEl.getBoundingClientRect();
      // Position of chapter-II top relative to .flod's top (for bg gradient)
      const y = chapterRect.top - flodRect.top;
      flodEl.style.setProperty('--konsulent-y', `${y}px`);
      // Smooth chapter progression (continuous, not binary). 0 when the
      // divider is well below the fold, 1 when it has scrolled past the
      // upper band. The FlodStage lerps materials along this value, so
      // scrolling gives continuous visual transition.
      const vh = window.innerHeight;
      const startY = vh * 0.75; // begin crossfade at 75% of viewport
      const endY = vh * 0.15; // full konsulent when divider is at 15%
      const raw = (startY - chapterRect.top) / Math.max(1, startY - endY);
      chapterMode = Math.max(0, Math.min(1, raw));
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    // Re-measure after fonts/layout settle
    measure();
    const t = setTimeout(measure, 300);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      clearTimeout(t);
      if (raf) cancelAnimationFrame(raf);
    };
  });

  // Section sequence:
  //   hero → who → CHAPTER I · Terapi (manifest, ritual, therapy service, for-personal)
  //        → CHAPTER II · Konsulentydelser (intimacy + embedded testimonial, elderly, teaching, for-work)
  //        → bio → contact
  //
  // Page content + per-section stage config live in `src/content/da/home.json`.
  // Each section declares named poses from $lib/stage/poses for the three
  // WebGL elements (mercury orb, gold metaballs, faceted gem). Poses resolve
  // to NDC coordinates at runtime. Section ids become `data-stage-anchor`
  // attributes on the corresponding section roots; FlodStage queries by that
  // attribute rather than brittle positional CSS selectors.
  const { pillQuote, manifest, ritual, forPersonal, forWork, sections } = home;
  const stageAnchors = sections.map(resolveAnchor);

  // Access individual services by slug so the page can compose each
  // in its own section with a layout that fits its content.
  const therapyService = serviceBySlug('terapi');
  const intimacyService = serviceBySlug('intimacy-coordination');
  const elderlyService = serviceBySlug('aeldrepleje');
  const teachingService = serviceBySlug('undervisning');
</script>

<svelte:head>
  <title>Skovbye Sexologi — klinisk sexolog, intimitetskoordinator, psykomotorisk terapeut</title>
  <meta
    name="description"
    content="Signe Skovbye — klinisk sexolog, intimitetskoordinator og psykomotorisk terapeut i København. Terapi for solo, par og poly · intimitetskoordinering for film, tv og teater · seksuel sundhed i ældresektoren · seksualundervisning."
  />
  <meta property="og:title" content="Skovbye Sexologi" />
  <meta
    property="og:description"
    content="Klinisk sexolog, intimitetskoordinator og psykomotorisk terapeut i København."
  />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="da_DK" />
  <link rel="canonical" href="https://skovbyesexologi.com/" />
</svelte:head>

<div class="flod" class:in-konsulent={chapterMode === 1}>
  <FlodStage anchors={stageAnchors} {chapterMode} />

  <nav class="top">
    <span class="mark">Skovbye Sexologi</span>
    <span class="mark-meta">København</span>
  </nav>

  <!--
    Chapter I wrapper. The therapy CTA sits as the first child so its
    sticky-bottom position engages from the top of the scrollable area;
    it stays pinned until the chapter-wrap's bottom (the end of
    for-personal) scrolls up past the sticky threshold, at which point
    the button scrolls up naturally with the container. No JS required.
  -->
  <div class="chapter-wrap chapter-wrap-therapi">
    {#if therapyService?.cta}
      <StickyCta cta={therapyService.cta} />
    {/if}

  <header class="hero" data-stage-anchor="hero">
    <p class="name-card reveal-slide">
      Skovbye Sexologi<br />
      <span>København</span>
    </p>
    <h1 class="statement">
      <span class="line reveal-soft"
        ><span class="ink">Du kommer som du er,</span></span
      >
      <span class="line reveal-soft em">
        <span class="ink">ikke som du </span><em>burde</em
        ><span class="ink dot">.</span>
      </span>
    </h1>
    <p class="attribution reveal">
      Signe Skovbye — klinisk sexolog, intimitetskoordinator, psykomotorisk terapeut.
    </p>
    <div class="hero-scroll">
      <span>mærk</span>
      <span class="arrow">↓</span>
    </div>
  </header>

  <section class="name-section" data-stage-anchor="name-section">
    <div class="name-grid">
      <div class="reveal-slide">
        <p class="eyebrow">Hvem</p>
        <h2>
          Signe <em>Skovbye</em>
        </h2>
        <p class="pronouns">hun / hende · de / dem</p>
      </div>
      <div class="reveal">
        <p class="role-line">
          Klinisk sexolog <span class="dotsep">·</span> intimitetskoordinator
          <span class="dotsep">·</span> psykomotorisk terapeut.
        </p>
        <p class="role-sub">
          Uddannet psykomotorisk terapeut (KP) og klinisk sexolog (DACS). Arbejder
          med solo, par, poly, unge, ældre — og med instruktører og performere der
          skal håndtere intimitet på settet.
        </p>
      </div>
    </div>
  </section>

  <!-- ============== CHAPTER I · TERAPI ============== -->
  <section class="chapter chapter-terapi" data-stage-anchor="chapter-terapi">
    <div class="chapter-inner reveal">
      <p class="chapter-mark">I</p>
      <h2 class="chapter-title">Terapi</h2>
      <p class="chapter-lede">
        For dig, for jer. Solo, par, poly. Kropsligt, samtaleligt,
        skamfrit. Dit tempo, din rækkefølge, din krop.
      </p>
    </div>
  </section>

  <section class="manifest" data-stage-anchor="manifest">
    <p class="section-label reveal">Manifest</p>
    <ul>
      {#each manifest as m, i}
        <li class="reveal">
          <span class="m-num">{String(i + 1).padStart(2, '0')}</span>
          <p>
            {#each m.text.split(m.word) as part, j}
              {part}{#if j < m.text.split(m.word).length - 1}<em>{m.word}</em>{/if}
            {/each}
          </p>
        </li>
      {/each}
    </ul>
  </section>

  <section class="ritual" data-stage-anchor="ritual">
    <div class="ritual-head reveal">
      <p class="section-label">Sådan mødes vi</p>
      <h2>En session har fire bevægelser.</h2>
    </div>
    <ol class="ritual-list">
      {#each ritual as step}
        <li class="reveal">
          <span class="r-n">{step.n}</span>
          <div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </div>
        </li>
      {/each}
    </ol>
  </section>

  {#if therapyService}
    <section class="service service-terapi" id={therapyService.slug} data-stage-anchor="service-terapi">
      <div class="service-head reveal">
        <span class="s-num">{therapyService.number}</span>
        <span class="s-kicker">{therapyService.kicker}</span>
      </div>
      <h2 class="service-title reveal">{therapyService.title}</h2>
      <p class="s-blurb reveal">{therapyService.blurb}</p>
      <ul class="s-bullets reveal">
        {#each therapyService.bullets as bullet}
          <li>{bullet}</li>
        {/each}
      </ul>
      {#if therapyService.supports}
        <div class="s-supports-block reveal">
          <p class="s-supports-label">Understøtter din eller jeres</p>
          <p class="s-supports">{therapyService.supports.join(' · ')}</p>
        </div>
      {/if}
    </section>
  {/if}

  <section class="for-personal" data-stage-anchor="for-personal">
    <p class="section-label reveal">Kom forbi hvis du —</p>
    <ul>
      {#each forPersonal as reason, i}
        <li class="reveal" style="--d: {i * 60}ms">
          <span class="fy-num">{String(i + 1).padStart(2, '0')}</span>
          <span>{reason}</span>
        </li>
      {/each}
    </ul>
  </section>

  </div><!-- /.chapter-wrap-therapi -->

  <!-- ============== CHAPTER II · KONSULENTYDELSER ============== -->
  <div class="chapter-wrap chapter-wrap-konsulent">
    {#if intimacyService?.cta}
      <StickyCta cta={intimacyService.cta} />
    {/if}

  <section class="chapter chapter-konsulent" data-stage-anchor="chapter-konsulent">
    <div class="chapter-inner reveal">
      <p class="chapter-mark">II</p>
      <h2 class="chapter-title">Konsulentydelser</h2>
      <p class="chapter-lede">
        For institutioner, filmproduktioner, plejesektoren og
        ungdomsuddannelser. Undervisning, intimitetskoordinering,
        rådgivning — altid baseret i samme terapeutiske fundament.
      </p>
    </div>
  </section>

  {#if intimacyService}
    <section class="service service-intimacy" id={intimacyService.slug} data-stage-anchor="service-intimacy">
      <div class="service-head reveal">
        <span class="s-num">{intimacyService.number}</span>
        <span class="s-kicker">{intimacyService.kicker}</span>
      </div>
      <h2 class="service-title reveal">{intimacyService.title}</h2>
      <p class="s-blurb reveal">{intimacyService.blurb}</p>
      <ul class="s-bullets reveal">
        {#each intimacyService.bullets as bullet}
          <li>{bullet}</li>
        {/each}
      </ul>
      <!-- The pull-quote LIVES here, inline with intimacy coordination -->
      <blockquote class="inline-quote reveal">
        <p>{pillQuote}</p>
      </blockquote>
      {#if intimacyService.testimonial}
        <footer class="s-testimonial reveal">
          <p>"{intimacyService.testimonial.quote}"</p>
          <cite>— {intimacyService.testimonial.source}</cite>
        </footer>
      {/if}
      {#if intimacyService.studios?.length}
        <div class="studios reveal">
          <p class="studios-lede">Tidligere samarbejder</p>
          <ul class="studios-list">
            {#each intimacyService.studios as studio}
              <li>
                {#if studio.url}
                  <a href={studio.url} target="_blank" rel="noopener">
                    <img src={studio.logo} alt={studio.name} loading="lazy" />
                  </a>
                {:else}
                  <img src={studio.logo} alt={studio.name} loading="lazy" />
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </section>
  {/if}

  {#if elderlyService}
    <section class="service service-elderly" id={elderlyService.slug} data-stage-anchor="service-elderly">
      <div class="service-head reveal">
        <span class="s-num">{elderlyService.number}</span>
        <span class="s-kicker">{elderlyService.kicker}</span>
      </div>
      <h2 class="service-title reveal">{elderlyService.title}</h2>
      <p class="s-blurb reveal">{elderlyService.blurb}</p>
      <ul class="s-bullets reveal">
        {#each elderlyService.bullets as bullet}
          <li>{bullet}</li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if teachingService}
    <section class="service service-teaching" id={teachingService.slug} data-stage-anchor="service-teaching">
      <div class="service-head reveal">
        <span class="s-num">{teachingService.number}</span>
        <span class="s-kicker">{teachingService.kicker}</span>
      </div>
      <h2 class="service-title reveal">{teachingService.title}</h2>
      <p class="s-blurb reveal">{teachingService.blurb}</p>
      <ul class="s-bullets reveal">
        {#each teachingService.bullets as bullet}
          <li>{bullet}</li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="for-work" data-stage-anchor="for-work">
    <p class="section-label reveal">Skriv til mig hvis I —</p>
    <ul>
      {#each forWork as reason, i}
        <li class="reveal" style="--d: {i * 60}ms">
          <span class="fy-num">{String(i + 1).padStart(2, '0')}</span>
          <span>{reason}</span>
        </li>
      {/each}
    </ul>
  </section>

  </div><!-- /.chapter-wrap-konsulent -->

  <section class="bio" data-stage-anchor="bio">
    <p class="section-label reveal">Om</p>
    <div class="bio-grid">
      <figure class="bio-portrait reveal">
        <img
          src="/img/signe.jpg"
          alt="Portræt af Signe Skovbye"
          width="1200"
          height="1400"
          loading="lazy"
          decoding="async"
        />
        <figcaption>
          <span class="bio-name">Signe Skovbye</span>
          <span class="bio-pronouns">{bio.pronouns}</span>
        </figcaption>
      </figure>
      <div class="bio-body">
        {#each bio.body as p, i}
          <p class="reveal" style="--d: {i * 80}ms">{p}</p>
        {/each}
      </div>
    </div>
  </section>

  <section id="kontakt" class="contact" data-stage-anchor="contact">
    <p class="section-label reveal">Kontakt</p>
    <h2 class="reveal">
      Skriv<span class="dot">.</span>
    </h2>
    <p class="contact-lede reveal">
      Jeg svarer så snart jeg kan — oftest inden for 24–48 timer. Der er plads
      til alle spørgsmål, også dem der er svære at sige højt.
    </p>
    <div class="contact-grid">
      <div class="reveal">
        <p class="label">Email</p>
        <a href="mailto:{contact.email}">{contact.email}</a>
      </div>
      <div class="reveal">
        <p class="label">Telefon</p>
        <a href="tel:+4531604215">{contact.phone}</a>
      </div>
      <div class="reveal">
        <p class="label">By</p>
        <p>{contact.address}</p>
      </div>
      <div class="reveal">
        <p class="label">Åbent</p>
        <p>{contact.hours}</p>
      </div>
    </div>
  </section>

  <footer class="foot">
    <p>
      © {new Date().getFullYear()} Skovbye Sexologi · CVR {contact.cvr}
    </p>
  </footer>
</div>

<style>
  .flod {
    --bone: oklch(0.96 0.009 215);
    --bone-warm: oklch(0.94 0.03 72);
    --bone-2: oklch(0.93 0.012 210);
    --graphite: oklch(0.17 0.012 240);
    --graphite-soft: color-mix(in oklch, var(--graphite) 70%, transparent);
    --tangerine: oklch(0.94 0.26 120);
    /* Accent text (numbers, list markers, hover, chapter numerals).
       Swapped from violet to a dark moss green that echoes the sage
       contact footer and complements the cool bone page bg. */
    --violet: oklch(0.36 0.14 150);
    --rose-deep: oklch(0.48 0.14 20);
    --mercury: oklch(0.78 0.015 220);
    --rule: color-mix(in oklch, var(--graphite) 18%, transparent);
    min-height: 100vh;
    /* Cool bone above the chapter-II divider, warm paper below. The
       `--konsulent-y` custom property is set from JS to the exact pixel
       position of `.chapter-konsulent` within `.flod`, so the split line
       aligns with the divider and scrolls naturally with the page. */
    background: linear-gradient(
      to bottom,
      var(--bone) 0,
      var(--bone) var(--konsulent-y, 200vh),
      var(--bone-warm) var(--konsulent-y, 200vh),
      var(--bone-warm) 100%
    );
    color: var(--graphite);
    font-family: var(--font-sans);
    font-weight: 300;
    position: relative;
    /* Form a stacking context so the fixed canvas at z-index:-1 paints
       between .flod's gradient bg and the sections, rather than escaping
       out behind .flod entirely. */
    isolation: isolate;
  }

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

  /* ============== HERO ============== */
  .hero {
    position: relative;
    min-height: 100vh;
    max-width: 1320px;
    margin: 0 auto;
    padding: clamp(3rem, 8vw, 6rem) 1.25rem clamp(4rem, 9vw, 6rem);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  /* NB: deliberately no position/z-index here — that would create a new
     stacking context and break the `mix-blend-mode: difference` on the
     statement's `.ink` spans. Normal flow stacks above the fixed stage
     canvas (z-index: 0) naturally. */

  .name-card {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--graphite);
    margin: 0 0 auto;
    padding-bottom: 4rem;
  }
  .name-card span {
    color: var(--graphite-soft);
  }

  .statement {
    font-family: var(--font-serif);
    font-size: clamp(2.8rem, 11vw, 9rem);
    line-height: 0.94;
    letter-spacing: -0.03em;
    font-weight: 400;
    margin: 0 0 3rem;
    max-width: 18ch;
  }
  /* Plain black — the WebGL canvas behind the text doesn't reliably
     participate in CSS mix-blend-mode compositing, so the "dynamic
     inversion over 3D" effect isn't achievable without moving off WebGL. */
  .statement .ink {
    color: var(--graphite);
  }
  .statement .line {
    display: block;
  }
  .statement em {
    font-style: italic;
    font-weight: 500;
    background: linear-gradient(180deg, transparent 66%, var(--tangerine) 66%);
    padding: 0 0.08em;
  }
  .dot {
    color: oklch(0.82 0.22 115);
    display: inline-block;
    transform: translateY(0.02em);
    font-weight: 600;
  }

  .attribution {
    font-family: var(--font-mono);
    font-size: clamp(0.78rem, 1.2vw, 0.92rem);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    max-width: 54ch;
    margin: 0 0 4rem;
  }

  .hero-scroll {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    margin-top: auto;
  }
  .arrow {
    font-size: 1rem;
    animation: drip 2.4s ease-in-out infinite;
  }
  @keyframes drip {
    0%, 100% { transform: translateY(0); opacity: 0.6; }
    50% { transform: translateY(6px); opacity: 1; }
  }

  /* ============== NAME SECTION ============== */
  .name-section {
    max-width: 1320px;
    margin: 0 auto;
    padding: clamp(4rem, 10vw, 9rem) 1.25rem;
    border-top: 1px solid var(--rule);
  }
  .name-grid {
    display: grid;
    gap: 2.5rem;
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    margin: 0 0 1rem;
  }
  .name-section h2 {
    font-family: var(--font-serif);
    font-size: clamp(2.4rem, 6vw, 4.5rem);
    line-height: 0.96;
    font-weight: 400;
    letter-spacing: -0.02em;
    margin: 0 0 1rem;
  }
  .name-section h2 em {
    font-style: italic;
    font-weight: 500;
  }
  .pronouns {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.1em;
    color: var(--graphite);
    margin: 0;
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--graphite);
    display: inline-block;
  }
  .role-line {
    font-family: var(--font-serif);
    font-size: clamp(1.3rem, 2.6vw, 1.8rem);
    line-height: 1.25;
    font-weight: 400;
    margin: 0 0 1.25rem;
    max-width: 32ch;
  }
  .dotsep {
    color: var(--violet);
  }
  .role-sub {
    font-size: 1rem;
    line-height: 1.65;
    max-width: 48ch;
    color: color-mix(in oklch, var(--graphite) 85%, transparent);
    margin: 0;
  }

  /* ============== MANIFEST ============== */
  .manifest {
    max-width: 1320px;
    margin: 0 auto;
    padding: clamp(4rem, 9vw, 8rem) 1.25rem;
    border-top: 1px solid var(--graphite);
  }
  .section-label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    margin: 0 0 3rem;
  }
  .manifest ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0;
  }
  .manifest li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1.5rem;
    padding: 2rem 0;
    border-bottom: 1px solid var(--rule);
  }
  .manifest li:first-child {
    border-top: 1px solid var(--rule);
  }
  .m-num {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    letter-spacing: 0.14em;
    color: var(--violet);
    padding-top: 0.4em;
  }
  .manifest p {
    font-family: var(--font-serif);
    font-size: clamp(1.5rem, 4.5vw, 3rem);
    line-height: 1.15;
    letter-spacing: -0.02em;
    font-weight: 400;
    margin: 0;
    max-width: 26ch;
  }
  .manifest em {
    font-style: italic;
    font-weight: 500;
    background: linear-gradient(180deg, transparent 68%, color-mix(in oklch, var(--tangerine) 55%, transparent) 68%);
    padding: 0 0.04em;
  }

  /* ============== RITUAL ============== */
  .ritual {
    max-width: 1320px;
    margin: 0 auto;
    padding: clamp(3rem, 8vw, 7rem) 1.25rem;
    border-block: 1px solid var(--graphite);
    position: relative;
  }
  /* Ritual's tinted bg sits on a pseudo-element with z-index:-2 so it
     paints BEHIND the fixed 3D canvas (z-index:-1) but still above the
     .flod gradient bg. The canvas thus stays visible across the section. */
  .ritual::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--bone-2);
    z-index: -2;
    pointer-events: none;
  }
  .ritual-head {
    max-width: 54ch;
    margin-bottom: 3rem;
  }
  .ritual-head h2 {
    font-family: var(--font-serif);
    font-size: clamp(1.9rem, 5vw, 3.2rem);
    line-height: 1;
    letter-spacing: -0.02em;
    font-weight: 400;
    margin: 0;
  }
  .ritual-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0;
  }
  .ritual-list li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2rem;
    padding: 2rem 0;
    border-top: 1px solid var(--rule);
    align-items: baseline;
  }
  .ritual-list li:last-child {
    border-bottom: 1px solid var(--rule);
  }
  .r-n {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    letter-spacing: 0.14em;
    color: var(--violet);
  }
  .ritual h3 {
    font-family: var(--font-serif);
    font-size: clamp(1.4rem, 3vw, 2rem);
    font-weight: 500;
    font-style: italic;
    letter-spacing: -0.01em;
    margin: 0 0 0.6rem;
  }
  .ritual p {
    font-size: 1.02rem;
    line-height: 1.65;
    margin: 0;
    max-width: 60ch;
    color: color-mix(in oklch, var(--graphite) 85%, transparent);
  }

  /* ============== CHAPTER DIVIDERS ============== */
  .chapter {
    max-width: 1320px;
    margin: 0 auto;
    padding: clamp(6rem, 14vw, 11rem) 1.25rem clamp(3rem, 7vw, 5rem);
    border-top: 1px solid var(--graphite);
  }
  .chapter-inner {
    display: grid;
    gap: 1rem;
    max-width: 60ch;
  }
  .chapter-mark {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: clamp(4rem, 12vw, 8rem);
    line-height: 1;
    margin: 0;
    color: var(--violet);
  }
  .chapter-title {
    font-family: var(--font-serif);
    font-weight: 400;
    font-size: clamp(2.4rem, 7vw, 5rem);
    line-height: 1;
    letter-spacing: -0.02em;
    margin: 0 0 1rem;
  }
  .chapter-lede {
    font-family: var(--font-serif);
    font-size: clamp(1.15rem, 2.4vw, 1.4rem);
    line-height: 1.5;
    max-width: 48ch;
    margin: 0;
    color: color-mix(in oklch, var(--graphite) 88%, transparent);
  }

  /* ============== SERVICE SECTIONS ============== */
  .service {
    max-width: 1320px;
    margin: 0 auto;
    padding: clamp(3rem, 7vw, 5.5rem) 1.25rem;
    border-top: 1px solid var(--rule);
  }
  .service-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 1rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    max-width: 70ch;
  }
  .s-num {
    color: var(--violet);
    font-size: 0.92rem;
  }
  .s-kicker {
    color: var(--graphite-soft);
  }
  .service-title {
    font-family: var(--font-serif);
    font-size: clamp(2rem, 5vw, 3.4rem);
    line-height: 1.02;
    letter-spacing: -0.02em;
    font-weight: 400;
    margin: 0 0 1.25rem;
    max-width: 22ch;
  }
  .s-blurb {
    font-family: var(--font-serif);
    font-size: clamp(1.15rem, 2.2vw, 1.4rem);
    line-height: 1.45;
    max-width: 48ch;
    margin: 0 0 1.5rem;
    color: color-mix(in oklch, var(--graphite) 90%, transparent);
  }
  .s-bullets {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
    font-size: 1rem;
    line-height: 1.85;
    color: color-mix(in oklch, var(--graphite) 82%, transparent);
    max-width: 60ch;
  }
  .s-bullets li::before {
    content: '— ';
    color: var(--violet);
  }
  .s-supports-block {
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px dashed var(--rule);
    max-width: 60ch;
  }
  .s-supports-label {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin: 0 0 0.5rem;
    color: var(--graphite-soft);
  }
  .s-supports {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: clamp(1.1rem, 2vw, 1.25rem);
    line-height: 1.5;
    margin: 0;
    color: color-mix(in oklch, var(--graphite) 88%, transparent);
  }

  /* Intimacy coordination — pull-quote + testimonial live inside the section */
  .service-intimacy .inline-quote {
    margin: 2rem 0 0;
    padding: 1.5rem 0 0;
    border-top: 2px solid var(--graphite);
    max-width: 32ch;
  }
  .service-intimacy .inline-quote p {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: clamp(1.35rem, 3vw, 2rem);
    line-height: 1.2;
    letter-spacing: -0.015em;
    font-weight: 400;
    margin: 0;
    color: var(--graphite);
  }
  .s-testimonial {
    margin-top: 1.75rem;
    padding-top: 1.25rem;
    border-top: 1px dashed var(--rule);
    max-width: 55ch;
  }
  .s-testimonial p {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 1.1rem;
    line-height: 1.4;
    margin: 0 0 0.4rem;
  }
  .s-testimonial cite {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    font-style: normal;
  }

  /* ============== CHAPTER WRAPPERS ============== */
  /*
    Each chapter wrap bounds a section group. The `<StickyCta>` at the
    top of each wrap uses position: sticky to pin to viewport bottom
    while scrolling through the wrap; when the wrap's bottom edge
    scrolls past the sticky threshold, the CTA exits with the container
    naturally. See StickyCta.svelte for details.
  */
  .chapter-wrap {
    position: relative;
  }

  /* ============== STUDIO CREDITS ============== */
  .studios {
    margin-top: 2.25rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--rule);
  }
  .studios-lede {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    margin: 0 0 1.1rem;
  }
  /* Single row, scrolls sideways when more logos are added. */
  .studios-list {
    list-style: none;
    margin: 0;
    padding: 0 0 0.25rem;
    display: flex;
    gap: 2.25rem;
    flex-wrap: nowrap;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in oklch, var(--graphite) 25%, transparent) transparent;
  }
  .studios-list::-webkit-scrollbar {
    height: 3px;
  }
  .studios-list::-webkit-scrollbar-thumb {
    background: color-mix(in oklch, var(--graphite) 25%, transparent);
    border-radius: 2px;
  }
  .studios-list li {
    margin: 0;
    flex-shrink: 0;
  }
  .studios-list img {
    display: block;
    /* Explicit height ensures SVGs without intrinsic width/height attrs
       compute a non-zero size (they'd otherwise collapse to 0×0 because
       max-height doesn't establish a concrete dimension for the browser
       to derive aspect-ratio-based width from). */
    height: 40px;
    width: auto;
    color: var(--graphite);
    opacity: 0.65;
    transition: opacity 0.2s ease;
  }
  .studios-list a {
    display: block;
    line-height: 0;
  }
  .studios-list a:hover img {
    opacity: 1;
  }

  /* ============== FOR YOU (shared styles for .for-personal + .for-work) ============== */
  .for-personal,
  .for-work {
    max-width: 1320px;
    margin: 0 auto;
    padding: clamp(4rem, 9vw, 7rem) 1.25rem;
    border-top: 1px solid var(--graphite);
  }
  .for-personal ul,
  .for-work ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0;
  }
  .for-personal li,
  .for-work li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1.5rem;
    padding: 1.25rem 0;
    border-top: 1px solid var(--rule);
    font-family: var(--font-serif);
    font-size: clamp(1.15rem, 2.4vw, 1.6rem);
    line-height: 1.3;
    align-items: baseline;
  }
  .for-personal li:last-child,
  .for-work li:last-child {
    border-bottom: 1px solid var(--rule);
  }
  .fy-num {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    letter-spacing: 0.14em;
    color: var(--violet);
  }

  /* ============== BIO ============== */
  .bio {
    max-width: 1320px;
    margin: 0 auto;
    padding: clamp(4rem, 9vw, 7rem) 1.25rem;
  }
  .bio-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: clamp(2rem, 5vw, 4rem);
    align-items: start;
  }
  .bio-portrait {
    margin: 0;
    position: relative;
    max-width: 420px;
  }
  .bio-portrait img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 6 / 7;
    object-fit: cover;
    /* Subtle warm tint border echoes the konsulent paper */
    box-shadow:
      0 1px 0 color-mix(in oklch, var(--graphite) 10%, transparent),
      0 24px 48px -24px color-mix(in oklch, var(--graphite) 45%, transparent);
    filter: saturate(0.92) contrast(1.02);
  }
  .bio-portrait figcaption {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-family: var(--font-sans);
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .bio-portrait .bio-name {
    color: var(--graphite);
    font-weight: 500;
  }
  .bio-portrait .bio-pronouns {
    color: var(--graphite-soft);
    letter-spacing: 0.08em;
    text-transform: none;
    font-style: italic;
    font-family: var(--font-serif);
    font-size: 0.95rem;
  }
  .bio-body p {
    font-family: var(--font-serif);
    font-size: clamp(1.1rem, 2.3vw, 1.5rem);
    line-height: 1.45;
    margin: 0 0 1.5rem;
    max-width: 42ch;
  }
  .bio-body p:last-child {
    margin-bottom: 0;
  }
  @media (min-width: 860px) {
    .bio-grid {
      grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
      gap: clamp(3rem, 6vw, 5rem);
      align-items: start;
    }
    .bio-portrait {
      position: sticky;
      top: 6rem;
      max-width: none;
    }
  }

  /* ============== CONTACT ============== */
  .contact {
    position: relative;
    /* Muted sage — a warmer green companion to the cool bone bg up top */
    background: oklch(0.48 0.09 152);
    color: var(--bone);
    padding: clamp(5rem, 12vw, 10rem) 1.25rem;
    overflow: hidden;
    /* Sits above the fixed stage canvas so the sage is solid, not
       blended with the 3D elements behind */
    z-index: 1;
  }
  .contact > * {
    position: relative;
    z-index: 2;
  }
  .contact .section-label {
    color: color-mix(in oklch, var(--bone) 70%, transparent);
  }
  .contact h2 {
    font-family: var(--font-serif);
    font-size: clamp(4rem, 22vw, 14rem);
    line-height: 0.88;
    letter-spacing: -0.045em;
    font-weight: 400;
    margin: 0 0 2rem;
    color: var(--bone);
  }
  .contact h2 .dot {
    color: var(--tangerine);
  }
  .contact-lede {
    font-family: var(--font-serif);
    font-size: clamp(1.2rem, 2.5vw, 1.6rem);
    line-height: 1.4;
    max-width: 40ch;
    margin: 0 0 3.5rem;
    color: color-mix(in oklch, var(--bone) 88%, transparent);
  }
  .contact-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 2rem;
    max-width: 1100px;
  }
  .contact a,
  .contact p {
    font-family: var(--font-mono);
    font-size: 0.92rem;
    line-height: 1.55;
    color: inherit;
    text-decoration: none;
    margin: 0;
  }
  .contact a {
    border-bottom: 1px solid currentColor;
  }
  .contact a:hover {
    color: var(--tangerine);
    border-color: var(--tangerine);
  }
  .label {
    font-size: 0.66rem !important;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: color-mix(in oklch, var(--bone) 55%, transparent) !important;
    margin: 0 0 0.35rem !important;
    border: none !important;
  }

  .foot {
    /* Deep fern — continues the sage from .contact into a darker floor */
    background: oklch(0.2 0.06 152);
    color: color-mix(in oklch, var(--bone) 45%, transparent);
    padding: 1rem 1.25rem 2.5rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    position: relative;
    z-index: 1;
  }
  .foot p {
    max-width: 1320px;
    margin: 0 auto;
  }

  /* ============== REVEAL STAGGER ============== */
  .reveal,
  .reveal-soft,
  .reveal-slide {
    animation-delay: var(--d, 0ms) !important;
  }

  /* ============== RESPONSIVE ============== */
  @media (min-width: 720px) {
    .top { padding: 1rem 2rem; }
    .hero,
    .name-section,
    .chapter,
    .manifest,
    .ritual,
    .service,
    .for-personal,
    .for-work,
    .bio,
    .contact,
    .foot p {
      padding-left: 2rem;
      padding-right: 2rem;
    }
    .name-grid {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      gap: 4rem;
    }
    .manifest li,
    .ritual-list li,
    .for-personal li,
    .for-work li {
      grid-template-columns: 4rem minmax(0, 1fr);
      gap: 2.5rem;
    }
  }

  @media (min-width: 1024px) {
    .hero,
    .name-section,
    .chapter,
    .manifest,
    .ritual,
    .service,
    .for-personal,
    .for-work,
    .bio,
    .contact,
    .foot p {
      padding-left: 3rem;
      padding-right: 3rem;
    }
  }
</style>
