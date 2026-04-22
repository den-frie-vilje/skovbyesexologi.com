<!--
  General-purpose testimonials block. Picks a layout automatically
  based on item count:

    • 1 item   → centred featured pull-quote
    • 2        → responsive grid of two equal-width cards
    • 3+       → horizontal snap-scroll carousel with seamless
                  infinite wrap, typographic arrows, a centred
                  dot indicator, and autoplay that pauses on hover
                  or recent user interaction

  Used by:
    • `<ServicePage>` — per-service client quotes
    • The homepage `testimonials` section — a curated mix
      across services

  Carousel mechanics:
    • Items are rendered 3× in the DOM (`[prev-copy | middle-copy
      | next-copy]`). Scroll starts at the middle copy; when the
      user (or autoplay) scrolls past either edge into a neighbour
      copy, `scrollend` instantly shifts `scrollLeft` by one
      copy-width to land at the equivalent card in the middle
      copy. Visually identical, no teleport flash — true infinite
      wrap without any frame where content pops.
    • Native scroll + `scroll-snap-type: x mandatory` keeps
      swipe/trackpad momentum feeling right; arrows and dots just
      call `scrollIntoView` on the target card.
    • Autoplay suspends while hovered, and for
      INTERACTION_COOLDOWN_MS after any arrow click, dot click,
      pointer-down, or touch-start — whichever the user did
      most recently.
    • Scrollbar is hidden via `scrollbar-width: none` +
      `::-webkit-scrollbar { display: none }`. No a11y impact:
      arrows + dots give keyboard navigation, focus ring is
      visible on all controls, and screen readers never rendered
      the scrollbar anyway (it's a pure visual affordance).
-->
<script lang="ts">
  import type { Testimonial } from '$lib/content';
  import { onMount } from 'svelte';

  interface Props {
    items: Testimonial[];
    /** Optional section label rendered above the list. */
    label?: string;
    /** Localised aria-labels for the carousel controls. */
    prevLabel?: string;
    nextLabel?: string;
  }

  let {
    items,
    label,
    prevLabel = 'Previous testimonial',
    nextLabel = 'Next testimonial'
  }: Props = $props();

  const layout = $derived(
    items.length === 1 ? 'single' : items.length === 2 ? 'grid' : 'scroll'
  );

  /** The three-copy DOM list — only used in scroll layout. The
   *  middle copy is the user's "home"; prev/next copies exist
   *  solely so `scrollLeft` can briefly cross into them during a
   *  wrap, before `scrollend` shifts back. */
  const tripled = $derived(
    layout === 'scroll' ? [...items, ...items, ...items] : items
  );

  // ---- Carousel state (scroll layout only) ----

  let listEl: HTMLUListElement | null = $state(null);
  /** Logical index into the user-visible items, 0..items.length-1.
   *  Drives the dot indicator; separate from DOM index, which lives
   *  in the 3× tripled space. */
  let currentIndex = $state(0);
  let hovered = $state(false);
  let lastInteractionAt = $state(0);

  /** One autoplay advance every this many ms. */
  const AUTOPLAY_MS = 6000;
  /** Quiet period after user interaction before autoplay resumes. */
  const INTERACTION_COOLDOWN_MS = 8000;

  function markInteraction() {
    lastInteractionAt = Date.now();
  }

  function stepWidth(): number {
    if (!listEl) return 0;
    const first = listEl.firstElementChild as HTMLElement | null;
    if (!first) return 0;
    const gap = parseFloat(getComputedStyle(listEl).columnGap || '0') || 0;
    return first.offsetWidth + gap;
  }

  /** DOM index of the card currently nearest `scrollLeft`. */
  function currentDomIndex(): number {
    if (!listEl) return items.length; // default: start of middle copy
    const step = stepWidth();
    if (step === 0) return items.length;
    return Math.round(listEl.scrollLeft / step);
  }

  /**
   * Move the carousel to a given DOM index.
   *
   * Sets `listEl.scrollLeft` directly instead of using
   * `scrollIntoView` — the latter also adjusts the page's
   * *vertical* scroll if the target card is near the viewport
   * edge, which yanks the whole page up/down whenever the
   * autoplay ticks. Pure horizontal scroll on the list container
   * leaves page scroll untouched.
   */
  function scrollToDomIndex(i: number, behavior: ScrollBehavior = 'smooth') {
    if (!listEl) return;
    const step = stepWidth();
    if (step === 0) return;
    listEl.scrollTo({ left: i * step, behavior });
  }

  function next(interactive = true) {
    if (items.length === 0 || !listEl) return;
    if (interactive) markInteraction();
    const dom = currentDomIndex();
    // Always animate forward by one card — the wrap happens
    // silently inside onScrollEnd if we've crossed a copy edge.
    scrollToDomIndex(dom + 1, 'smooth');
  }

  function prev() {
    if (items.length === 0 || !listEl) return;
    markInteraction();
    const dom = currentDomIndex();
    scrollToDomIndex(dom - 1, 'smooth');
  }

  /** Jump to a specific logical index (used by the dot cluster).
   *  Target lands in the middle copy; if the user is currently in
   *  a neighbour copy, a subsequent scrollend will normalise. */
  function goto(i: number) {
    if (i < 0 || i >= items.length) return;
    markInteraction();
    scrollToDomIndex(items.length + i, 'smooth');
  }

  /** Fires after any settled scroll (user or programmatic). Two
   *  jobs: (1) wrap — if we've scrolled into the prev or next
   *  copy, shift scrollLeft by one copy-width so we're back in
   *  the middle without a visible hop; (2) update `currentIndex`
   *  for the dot indicator. */
  function onScrollEnd() {
    if (!listEl || layout !== 'scroll') return;
    const step = stepWidth();
    if (step === 0) return;
    const dom = currentDomIndex();
    let newDom = dom;
    if (dom < items.length) {
      // Crossed into the prev copy — shift forward one copy.
      listEl.scrollTo({
        left: listEl.scrollLeft + items.length * step,
        behavior: 'instant'
      });
      newDom = dom + items.length;
    } else if (dom >= items.length * 2) {
      // Crossed into the next copy — shift back one copy.
      listEl.scrollTo({
        left: listEl.scrollLeft - items.length * step,
        behavior: 'instant'
      });
      newDom = dom - items.length;
    }
    currentIndex = newDom % items.length;
  }

  /** Initial positioning — land on the middle copy's first card
   *  so there's headroom for a leftward wrap from the very start. */
  onMount(() => {
    if (layout !== 'scroll') return;
    // Wait one frame so the browser has laid out the tripled list.
    requestAnimationFrame(() => {
      scrollToDomIndex(items.length, 'instant');
    });
  });

  /** Autoplay loop. Re-subscribes when `layout` changes (items
   *  array grows past 3 or shrinks below 4) so it only runs in
   *  scroll mode. */
  $effect(() => {
    if (layout !== 'scroll') return;
    const tick = setInterval(() => {
      if (hovered) return;
      if (Date.now() - lastInteractionAt < INTERACTION_COOLDOWN_MS) return;
      next(false);
    }, AUTOPLAY_MS);
    return () => clearInterval(tick);
  });
</script>

{#if items.length > 0}
  <section
    class="testimonials"
    data-layout={layout}
    aria-label={label ?? 'Testimonials'}
    onmouseenter={() => (hovered = true)}
    onmouseleave={() => (hovered = false)}
  >
    {#if label}
      <p class="t-label">{label}</p>
    {/if}

    <ul
      class="t-list"
      bind:this={listEl}
      onscrollend={onScrollEnd}
      onpointerdown={markInteraction}
      ontouchstart={markInteraction}
    >
      {#each tripled as t, i}
        <li
          class="t-card"
          aria-hidden={layout === 'scroll' &&
            (i < items.length || i >= items.length * 2)
            ? 'true'
            : undefined}
        >
          <blockquote>
            <p class="t-quote">"{t.quote}"</p>
            <cite class="t-source">— {t.source}</cite>
          </blockquote>
        </li>
      {/each}
    </ul>

    {#if layout === 'scroll'}
      <!--
        Nav row: typographic ← arrow left, dot cluster centred,
        typographic → arrow right. Borrows the mono-glyph
        treatment of the "← Forsiden" back link for visual family.
      -->
      <div class="t-nav">
        <button
          type="button"
          class="t-arrow t-arrow-prev"
          aria-label={prevLabel}
          onclick={prev}
        >←</button>

        <ol class="t-dots" aria-label="Testimonial navigation">
          {#each items as _, i}
            <li>
              <button
                type="button"
                class="t-dot"
                class:active={i === currentIndex}
                aria-label={`Go to testimonial ${i + 1}`}
                aria-current={i === currentIndex ? 'true' : undefined}
                onclick={() => goto(i)}
              ></button>
            </li>
          {/each}
        </ol>

        <button
          type="button"
          class="t-arrow t-arrow-next"
          aria-label={nextLabel}
          onclick={() => next(true)}
        >→</button>
      </div>
    {/if}
  </section>
{/if}

<style>
  /* `.testimonials` relies on `.flod` design tokens (`--graphite`,
     `--rule`, `--violet`, `--font-serif`, `--font-mono`) from the
     page root — no own-rules needed on the wrapper itself. */

  .t-label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    margin: 0 0 1.5rem;
  }

  .t-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  /* `.t-card` has no default rules — card styling is layout-specific
     and lives in the `[data-layout='…']` blocks below. */

  blockquote {
    margin: 0;
  }

  .t-quote {
    font-family: var(--font-serif);
    font-style: italic;
    line-height: 1.4;
    letter-spacing: -0.005em;
    margin: 0 0 1rem;
    color: var(--graphite);
  }
  .t-source {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    font-style: normal;
  }

  /* ============== LAYOUT: SINGLE (featured pull-quote) ============== */
  [data-layout='single'] .t-list {
    display: flex;
    justify-content: flex-start;
  }
  [data-layout='single'] .t-card {
    max-width: 40ch;
  }
  [data-layout='single'] .t-quote {
    font-size: clamp(1.4rem, 2.8vw, 2rem);
  }

  /* ============== LAYOUT: GRID (2–3 items) ============== */
  [data-layout='grid'] .t-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2.5rem;
  }
  [data-layout='grid'] .t-card {
    padding-top: 1.5rem;
    border-top: 1px solid var(--rule);
  }
  [data-layout='grid'] .t-quote {
    font-size: clamp(1.05rem, 1.6vw, 1.25rem);
  }

  /* ============== LAYOUT: SCROLL (4+ items) ============== */
  [data-layout='scroll'] .t-list {
    display: flex;
    gap: 2rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-padding: 0 1.25rem;
    padding: 0.25rem 1.25rem 1rem;
    margin: 0 -1.25rem;
    -webkit-overflow-scrolling: touch;

    /* Hide scrollbar — keyboard users have arrow buttons + dot
       buttons; screen readers don't see scrollbars; touch
       scrollbars are auto-hidden anyway. The mask-image fade at
       the right edge still communicates "there's more". */
    scrollbar-width: none;

    /*
      Right-edge fade so the partial card peeking in from the
      infinite-wrap + snap-scroll looks like a soft transition
      rather than a hard cut. Width is `--t-fade`, bumped by a
      media query at ≥720px once the list is wide enough for a
      second card to actually peek in. The left edge stays sharp
      because the scroll-snap always starts there — no "previous"
      card sticks out on the left in this layout.
    */
    --t-fade: 2rem;
    mask-image: linear-gradient(
      to right,
      black 0,
      black calc(100% - var(--t-fade)),
      transparent 100%
    );
    -webkit-mask-image: linear-gradient(
      to right,
      black 0,
      black calc(100% - var(--t-fade)),
      transparent 100%
    );
  }
  [data-layout='scroll'] .t-list::-webkit-scrollbar {
    display: none;
  }
  [data-layout='scroll'] .t-card {
    flex: 0 0 min(340px, 80vw);
    scroll-snap-align: start;
    padding: 1.5rem 0 0;
    border-top: 1px solid var(--rule);
  }
  [data-layout='scroll'] .t-quote {
    font-size: 1.1rem;
  }

  /* Nav row — 3-col grid: prev arrow left, dots centred, next
     arrow right. Using grid (not flex + margin:auto) keeps the
     dot cluster optically centred regardless of count. */
  .t-nav {
    margin-top: 1.5rem;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1rem;
  }

  /* Typographic arrows — same mono glyph/weight as the
     `← Forsiden` back link. Dark green (--violet) for
     accessible contrast on the cream bg; chartreuse reads
     too soft there. 44px min-height preserved for tap
     accuracy without visual bulk. */
  .t-arrow {
    font-family: var(--font-mono);
    font-size: 1rem;
    line-height: 1;
    color: var(--violet);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.75rem 0.25rem;
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    transition: color 0.15s, transform 0.15s;
  }
  .t-arrow-prev {
    justify-self: start;
  }
  .t-arrow-next {
    justify-self: end;
  }
  .t-arrow:hover {
    color: var(--graphite);
  }
  .t-arrow:active {
    transform: translateX(var(--t-arrow-nudge, 0));
  }
  .t-arrow-prev:active {
    --t-arrow-nudge: -2px;
  }
  .t-arrow-next:active {
    --t-arrow-nudge: 2px;
  }

  .t-dots {
    display: flex;
    gap: 0.6rem;
    padding: 0;
    margin: 0;
    list-style: none;
    justify-self: center;
  }
  .t-dot {
    width: 8px;
    height: 8px;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    transition:
      background 0.2s,
      border-color 0.2s,
      transform 0.2s;
  }
  .t-dot.active {
    /* Dark green (--violet) — visible on the cream bg, unlike
       chartreuse which disappears at small sizes. */
    background: var(--violet);
    border-color: var(--violet);
    transform: scale(1.1);
  }
  .t-dot:hover:not(.active) {
    border-color: var(--graphite-soft);
  }

  @media (min-width: 720px) {
    [data-layout='scroll'] .t-list {
      padding-left: 2rem;
      padding-right: 2rem;
      margin-left: -2rem;
      margin-right: -2rem;
      scroll-padding-left: 2rem;
      /* At this breakpoint the list is wide enough that the
         next card visibly peeks in on the right. Widen the fade
         so the peek dissolves rather than hard-clipping at the
         edge. */
      --t-fade: 6rem;
    }
    [data-layout='scroll'] .t-card {
      flex-basis: 380px;
    }
  }
  @media (min-width: 1024px) {
    [data-layout='scroll'] .t-list {
      padding-left: 3rem;
      padding-right: 3rem;
      margin-left: -3rem;
      margin-right: -3rem;
      scroll-padding-left: 3rem;
      /* Even wider at this breakpoint — 2+ cards peek on the
         right at once; fade needs to cover the whole overlap. */
      --t-fade: 10rem;
    }
  }

  /* Reduced motion — flatten smooth scrolling + transitions so
     autoplay advances and arrow clicks feel like instant jumps
     rather than slides. The JS timer still runs; users who need
     a full pause can hover. */
  @media (prefers-reduced-motion: reduce) {
    [data-layout='scroll'] .t-list {
      scroll-behavior: auto;
    }
    .t-arrow,
    .t-dot {
      transition: none;
    }
  }
</style>
