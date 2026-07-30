<!--
  Studio-credit logo strip, shared by the homepage intimacy block
  and the service detail pages.

  Two problems this solves over a plain fixed-height flex row:

  1. PROPORTIONAL SIZING. The source SVGs vary wildly in aspect —
     Bedside Productions is a 787×46 wordmark (~17:1) while Får302
     is portrait (720×976). A uniform height renders the wide mark
     enormous and the portrait mark tiny. Instead each logo's
     height is set so all logos occupy roughly the same optical
     AREA: equal area ⇒ h ∝ 1/√aspect, i.e.

       height = clamp(MIN, K / sqrt(w/h), MAX) × scale

     computed from the image's natural dimensions once it loads.
     `max-width` backstops the extremes: an ultra-wide wordmark is
     object-fit-contained down so it can never dominate the row.

  2. AUTOSCROLL ON OVERFLOW. When the strip is wider than its
     container the row auto-scrolls marquee-style; when it fits, it
     is a plain static row (no duplicate DOM, no motion). The
     travel distance is MEASURED (offset between the first and the
     duplicated set), and the animation-duration is derived from
     travel ÷ PX_PER_SECOND and recomputed on resize — a fixed
     duration would make the on-screen speed scale with track
     width and crawl on narrow screens. The animation starts only
     after every logo has settled (load or error, plus a timeout
     fallback), so late-loading images can't re-time a running
     animation and cause a visible jump.

  Fallbacks: before hydration, and under `prefers-reduced-motion`,
  the container is a manual `overflow-x: auto` scroller (thin
  scrollbar) — the pre-existing homepage affordance. The marquee
  pauses on hover, and a small pause/play toggle covers touch +
  keyboard users (WCAG 2.2.2 pause-stop-hide).
-->
<script lang="ts">
  import type { StudioCredit } from '$lib/content';

  interface Props {
    studios: StudioCredit[];
    /** Accessible name for the strip, e.g. the studios label. */
    label: string;
    /** Drives the pause-button aria-labels. Accepts `site.lang`
     *  (a plain string) — anything but 'en' falls back to DA. */
    locale?: string;
    /** Proportional size multiplier — homepage feature strip runs
     *  slightly larger than the service-page row. */
    scale?: number;
  }

  let { studios, label, locale = 'da', scale = 1 }: Props = $props();

  /*
    Equal-area constants at scale=1 (service page). K is tuned so a
    mid-aspect logo (~1.7:1, e.g. Filmskolen 265×157) keeps roughly
    the pre-existing 28px height: 28 × √1.7 ≈ 36.5. `$derived` so a
    (theoretical) runtime `scale` change re-sizes the strip.
  */
  const K = $derived(36.5 * scale);
  const MIN = $derived(16 * scale);
  const MAX = $derived(44 * scale);
  const MAX_W = $derived(180 * scale);
  const PX_PER_SECOND = 36;

  const pauseLabels = $derived(
    locale === 'en'
      ? { pause: 'Pause the logo strip', play: 'Play the logo strip' }
      : { pause: 'Sæt logobåndet på pause', play: 'Afspil logobåndet' }
  );

  /* Marquee engages only when the single set overflows the
     container AND the user hasn't asked for reduced motion. */
  let overflowing = $state(false);
  let reducedMotion = $state(false);
  /* Animation is held at translateX(0) until images have settled
     and the duration is sized — flipping a class reactively; a
     runtime-added class would be pruned from the scoped CSS. */
  let ready = $state(false);
  let paused = $state(false);

  const marquee = $derived(overflowing && !reducedMotion);

  function logoHeight(node: HTMLImageElement) {
    const apply = () => {
      const w = node.naturalWidth;
      const h = node.naturalHeight;
      if (!w || !h) return;
      const height = Math.min(MAX, Math.max(MIN, K / Math.sqrt(w / h)));
      node.style.setProperty('--logo-h', `${height.toFixed(1)}px`);
    };
    if (node.complete) apply();
    node.addEventListener('load', apply);
    return { destroy: () => node.removeEventListener('load', apply) };
  }

  /*
    Container-level measurement. Reads the first `.set`'s width vs
    the container's, decides `overflowing`, and — when the
    duplicate set exists — measures the exact loop travel
    (set2.offsetLeft − set1.offsetLeft, which bakes in the flex
    gap) and derives the duration. Only custom properties and
    state flags are written; neither changes the observed widths,
    so the ResizeObserver can't feed back on itself.
  */
  let measure: (() => void) | undefined;

  function autoscroll(node: HTMLElement) {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mql.matches;
    const onMql = () => (reducedMotion = mql.matches);
    mql.addEventListener('change', onMql);

    measure = () => {
      const sets = node.querySelectorAll<HTMLElement>('.set');
      const first = sets[0];
      if (!first) return;
      const setWidth = first.getBoundingClientRect().width;
      overflowing = setWidth > node.clientWidth + 1;
      const second = sets[1];
      if (second) {
        /* A scroll offset left over from the static overflow-x
           mode would visually shift the marquee's start. */
        if (node.scrollLeft !== 0) node.scrollLeft = 0;
        const travel = second.offsetLeft - first.offsetLeft;
        if (travel > 0) {
          node.style.setProperty('--travel', `${travel.toFixed(1)}px`);
          node.style.setProperty(
            '--marquee-duration',
            `${(travel / PX_PER_SECOND).toFixed(2)}s`
          );
        }
      }
    };

    const ro = new ResizeObserver(() => measure?.());
    ro.observe(node);
    const firstSet = node.querySelector('.set');
    if (firstSet) ro.observe(firstSet);

    /* Gate the start until the logos have settled so the duration
       is never re-derived mid-animation (visible jump otherwise).
       Belt-and-braces timeout in case an image never fires. */
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      measure?.();
      ready = true;
    };
    const pending = Array.from(node.querySelectorAll('img')).filter((img) => !img.complete);
    const fallback = setTimeout(start, 2000);
    if (pending.length === 0) {
      start();
    } else {
      let remaining = pending.length;
      const settle = () => {
        if (--remaining === 0) start();
      };
      for (const img of pending) {
        img.addEventListener('load', settle, { once: true });
        img.addEventListener('error', settle, { once: true });
      }
    }

    return {
      destroy: () => {
        ro.disconnect();
        clearTimeout(fallback);
        mql.removeEventListener('change', onMql);
        measure = undefined;
      }
    };
  }

  /*
    The duplicate set mounts AFTER `overflowing` flips true, and its
    arrival changes neither the track's nor the first set's box — so
    the ResizeObserver never fires for it. Measure explicitly the
    frame it lands, otherwise `--travel` stays at its 0px fallback
    and the marquee runs in place.
  */
  function measureTravel(_node: HTMLElement) {
    const raf = requestAnimationFrame(() => measure?.());
    return { destroy: () => cancelAnimationFrame(raf) };
  }
</script>

{#snippet logoSet(hidden: boolean)}
  <!-- `measureTravel` on both copies is idempotent — its real job
       is firing when the DUPLICATE mounts mid-life. -->
  <ul class="set" aria-hidden={hidden ? 'true' : undefined} use:measureTravel>
    {#each studios as studio (studio.name)}
      <li>
        {#if studio.url && !hidden}
          <a href={studio.url} target="_blank" rel="noopener noreferrer">
            <img src={studio.logo} alt={studio.name} loading="eager" use:logoHeight />
          </a>
        {:else}
          <img src={studio.logo} alt={hidden ? '' : studio.name} loading="eager" use:logoHeight />
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#if studios.length > 0}
  <div class="strip" class:marquee class:is-ready={ready} role="group" aria-label={label}>
    <div
      class="track"
      class:paused
      use:autoscroll
      style="--max-h: {MAX.toFixed(1)}px; --logo-max-w: {MAX_W.toFixed(0)}px"
    >
      {@render logoSet(false)}
      {#if marquee}
        {@render logoSet(true)}
      {/if}
    </div>
    {#if marquee}
      <button
        type="button"
        class="pause-toggle"
        aria-pressed={paused}
        aria-label={paused ? pauseLabels.play : pauseLabels.pause}
        onclick={() => (paused = !paused)}
      >
        {paused ? '▶' : '⏸'}
      </button>
    {/if}
  </div>
{/if}

<style>
  /*
    Static / pre-hydration / reduced-motion default: a manual
    horizontal scroller with a thin scrollbar (the pre-existing
    homepage affordance). The marquee class swaps overflow to
    hidden and adds soft edge fades.
  */
  .strip {
    position: relative;
  }
  .track {
    display: flex;
    align-items: center;
    gap: 2.5rem;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 0.25rem;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in oklch, var(--text) 25%, transparent) transparent;
    /* Reserve the tallest possible logo's height so the row can't
       grow — and shift the page — as logos size in. */
    min-height: var(--max-h);
  }
  .track::-webkit-scrollbar {
    height: 3px;
  }
  .track::-webkit-scrollbar-thumb {
    background: color-mix(in oklch, var(--text) 25%, transparent);
    border-radius: 2px;
  }

  .set {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 2.5rem;
    flex: none;
  }
  .set li {
    margin: 0;
    flex: none;
    line-height: 0;
  }
  .set a {
    display: block;
    line-height: 0;
  }
  .set img {
    display: block;
    /* Sized by the equal-area action; the fallback matches a
       mid-aspect logo so pre-JS paint is close. object-fit +
       max-width contain the ultra-wide wordmarks. */
    height: var(--logo-h, calc(var(--max-h) * 0.64));
    width: auto;
    max-width: var(--logo-max-w, 180px);
    object-fit: contain;
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }
  .set a:hover img,
  .set a:focus-visible img {
    opacity: 1;
  }

  .marquee .track {
    overflow: hidden;
    padding-bottom: 0;
  }
  .marquee {
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
  }
  /*
    The two sets travel together by exactly the measured distance
    between them, then snap back — indistinguishable from an
    endless belt. Duration is distance ÷ PX_PER_SECOND (set by the
    action), so on-screen speed is constant on every device; the
    120s figure is an inert fallback for the pre-measurement beat.
  */
  .marquee .set {
    animation: studio-marquee var(--marquee-duration, 120s) linear infinite;
    animation-play-state: paused;
  }
  .marquee.is-ready .set {
    animation-play-state: running;
  }
  .marquee.is-ready .track.paused .set,
  .marquee.is-ready .track:hover .set {
    animation-play-state: paused;
  }
  @keyframes studio-marquee {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(calc(-1 * var(--travel, 0px)));
    }
  }

  .pause-toggle {
    position: absolute;
    right: 0;
    top: calc(100% + 0.35rem);
    border: 1px solid var(--rule);
    background: transparent;
    color: var(--text-muted);
    font-size: 0.55rem;
    line-height: 1;
    padding: 0.3rem 0.45rem;
    border-radius: 999px;
    cursor: pointer;
    transition:
      color 0.2s ease,
      border-color 0.2s ease;
  }
  .pause-toggle:hover {
    color: var(--text);
    border-color: var(--text-muted);
  }

  @media (prefers-reduced-motion: reduce) {
    .marquee .set {
      animation: none;
    }
  }
</style>
