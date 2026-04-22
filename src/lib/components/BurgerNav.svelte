<!--
  Full-page burger navigation.

  Lives inside `<SiteHeader>`: a three-bar button on the right of
  the sticky top bar, and an overlay panel that fills the viewport
  when opened. The panel is rendered outside the flex layout via
  `position: fixed` so it can cover the page regardless of the
  header's own stacking context.

  Closing triggers: the × button in the overlay, the ESC key, a
  click on the backdrop, and clicking any nav link (so the menu
  dismisses as the destination page loads).

  Not a focus-trap yet — ESC + the generous tap targets + the
  `:focus-visible` outline from app.css carry a11y for now.
  A proper focus trap slots in when the menu gains more
  interactive content (e.g. a locale switcher with multiple
  selectable options).
-->
<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { tick } from 'svelte';
  import type { NavLink } from '$lib/content';

  interface Props {
    links: NavLink[];
    /** Localised aria-labels. Defaults are English. */
    openLabel?: string;
    closeLabel?: string;
    /** Localised heading announced to screen readers when the
     *  menu opens. Visually hidden. */
    menuLabel?: string;
  }

  let {
    links,
    openLabel = 'Open menu',
    closeLabel = 'Close menu',
    menuLabel = 'Primary navigation'
  }: Props = $props();

  let open = $state(false);
  let burgerBtn: HTMLButtonElement | null = $state(null);
  let closeBtn: HTMLButtonElement | null = $state(null);

  async function openMenu() {
    open = true;
    // After Svelte applies the DOM update + transition start,
    // move focus into the panel so ESC and Tab both behave
    // predictably from the get-go.
    await tick();
    closeBtn?.focus();
  }

  async function closeMenu() {
    if (!open) return;
    open = false;
    await tick();
    burgerBtn?.focus();
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      closeMenu();
    }
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<button
  class="burger"
  type="button"
  aria-label={openLabel}
  aria-expanded={open}
  aria-controls="burger-panel"
  bind:this={burgerBtn}
  onclick={openMenu}
>
  <span class="bars" aria-hidden="true">
    <span></span>
    <span></span>
    <span></span>
  </span>
</button>

{#if open}
  <div
    class="backdrop"
    onclick={closeMenu}
    onkeydown={(e) => e.key === 'Enter' && closeMenu()}
    role="presentation"
    transition:fade={{ duration: 180 }}
  ></div>

  <aside
    id="burger-panel"
    class="panel"
    aria-label={menuLabel}
    transition:fly={{ y: -24, duration: 260, opacity: 0 }}
  >
    <button
      class="close"
      type="button"
      aria-label={closeLabel}
      bind:this={closeBtn}
      onclick={closeMenu}
    >
      <span aria-hidden="true">×</span>
    </button>

    <nav>
      <p class="nav-eyebrow">{menuLabel}</p>
      <ul>
        {#each links as link, i}
          <li style="--d: {i * 40}ms">
            <a href={link.href} onclick={closeMenu}>
              <!--
                Mono number prefix echoes each service's homepage
                section number (01, 02, 03, 04). Entries without a
                `num` (e.g. the trailing Contact link) render a
                placeholder so the serif label column still lines
                up across rows.
              -->
              <span class="n" aria-hidden="true">
                {#if link.num}{link.num}{:else}&nbsp;{/if}
              </span>
              <span class="l">{link.label}</span>
              <span class="arrow" aria-hidden="true">→</span>
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  </aside>
{/if}

<style>
  /* ============== BURGER BUTTON ============== */
  .burger {
    width: 44px;
    height: 44px;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--graphite);
  }
  .bars {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 22px;
  }
  .bars span {
    display: block;
    height: 1.5px;
    background: currentColor;
    border-radius: 1px;
    /* Middle bar is a touch shorter — small editorial nod,
       avoids the "three equal stacks" cliché. */
  }
  .bars span:nth-child(2) {
    width: 70%;
    margin-left: auto;
  }
  .burger:hover .bars span,
  .burger:focus-visible .bars span {
    background: var(--violet);
  }

  /* ============== BACKDROP ============== */
  .backdrop {
    position: fixed;
    inset: 0;
    /* Near-solid bone — the sticky CTA sits at z-index 50 and
       would otherwise show through a semi-transparent backdrop,
       competing with the menu list for attention. 98% opacity
       leaves a whisper of the stage visible at the edges while
       fully covering the CTA. No `backdrop-filter: blur()` per
       project guideline. */
    background: color-mix(in oklch, var(--bone) 98%, transparent);
    z-index: 100;
    cursor: pointer;
  }

  /* ============== PANEL ============== */
  .panel {
    position: fixed;
    inset: 0;
    z-index: 101;
    display: flex;
    flex-direction: column;
    padding: clamp(4rem, 10vh, 6rem) clamp(1.25rem, 5vw, 4rem);
    pointer-events: none; /* backdrop captures outside clicks */
    /*
      Reset `text-transform: uppercase` + `letter-spacing` inherited
      from `.top` — the burger panel is a descendant of the header
      in the DOM tree, so the uppercase styling leaks in and forces
      service titles into loud all-caps. Nav labels should read as
      proper serif titles.
    */
    text-transform: none;
    letter-spacing: normal;
    font-size: initial;
  }
  .panel > * {
    pointer-events: auto;
  }

  /*
    Close X sits at the exact same position as the hamburger
    button in `.top` — `top: 1rem; right: 1.25rem` matches
    `.top`'s padding. The replacement feels like the trigger
    toggles in place rather than the X appearing elsewhere on
    the page. Responsive right-offset tracks the header's
    media-query bump at ≥720px.
  */
  .close {
    position: absolute;
    top: 1rem;
    right: 1.25rem;
    width: 44px;
    height: 44px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: var(--font-serif);
    font-size: 2.2rem;
    line-height: 1;
    color: var(--graphite);
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s;
  }
  .close:hover,
  .close:focus-visible {
    color: var(--violet);
  }

  nav {
    margin-top: auto;
    margin-bottom: auto;
  }
  .nav-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    margin: 0 0 2rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.2em;
  }
  li {
    /* Staggered reveal when the menu opens — each link waits
       `--d` before animating in via the panel's `fly` transition.
       CSS-only stagger since the panel itself already animates,
       this layers a per-link delay on top. */
    animation: link-in 280ms ease both;
    animation-delay: var(--d, 0ms);
    opacity: 0;
  }
  @keyframes link-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /*
    Link row — mono number + serif label + arrow. Grid keeps the
    three parts aligned even as labels wrap at tighter widths.
    `fit-content(1fr)` on the label lets long service titles
    (e.g. "Seksuel sundhed i ældresektoren") claim horizontal
    room without pushing the arrow off-screen; the clamp on
    font-size is capped so even the 30+ character DA titles
    stay on a single line down to ~420px viewport widths.
  */
  li a {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 0.75em;
    color: var(--graphite);
    text-decoration: none;
    /*
      Generous vertical padding so each nav row is ≥44px tall
      (WCAG AA tap target) at every font-size in the clamp and
      so the rows read as a paced list rather than a tight
      paragraph. 0.55em top+bottom at the min font-size
      (1.35rem ≈ 21.6px) gives ~23.8px padding → ~70px row
      height, well above the 44px minimum.
    */
    padding: 0.55em 0;
    transition: color 0.15s;
  }
  .n {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    color: var(--violet);
    /* Fixed width so numbered rows (01 / 02 / …) and the
       unnumbered Contact row share a column alignment — without
       min-width, the `&nbsp;` placeholder collapses narrower
       than "01" and Kontakt's label slides left. */
    display: inline-block;
    min-width: 2.2ch;
    /* Small top nudge — the mono glyph's cap-height sits above
       the serif's baseline, so a touch of translateY drops it
       into the optical line of the serif label. */
    transform: translateY(-0.25em);
  }
  .l {
    font-family: var(--font-serif);
    font-size: clamp(1.35rem, 3.2vw, 2.15rem);
    line-height: 1.1;
    letter-spacing: -0.01em;
    /* Break compound words at narrow widths rather than overflow
       the panel. Danish compounds like "Intimitetskoordinering"
       can be long; browsers with `hyphens: auto` + `lang="da"`
       on <html> will break at etymological seams. */
    overflow-wrap: break-word;
    hyphens: auto;
  }
  .arrow {
    font-family: var(--font-mono);
    font-size: 1.25rem;
    line-height: 1;
    color: var(--graphite-soft);
    /* Arrow slides in from the left on hover/focus — same
       gesture as the back link's `← Forsiden`. */
    transform: translateX(-0.4em);
    opacity: 0;
    transition:
      transform 0.25s ease,
      opacity 0.25s ease,
      color 0.15s;
  }
  li a:hover .l,
  li a:focus-visible .l {
    color: var(--violet);
  }
  li a:hover .arrow,
  li a:focus-visible .arrow {
    transform: translateX(0);
    opacity: 1;
    color: var(--violet);
  }

  /* Match SiteHeader's ≥720px right-padding bump so the close
     X stays aligned with where the hamburger sits at that
     breakpoint (1rem → 2rem right). */
  @media (min-width: 720px) {
    .close {
      right: 2rem;
    }
  }

  /* Reduced motion — skip the per-link stagger + arrow slide,
     let the panel fade still happen but keep link content
     static and the arrow always visible. */
  @media (prefers-reduced-motion: reduce) {
    li {
      animation: none;
      opacity: 1;
    }
    .arrow {
      transform: none;
      opacity: 1;
      transition: none;
    }
  }
</style>
