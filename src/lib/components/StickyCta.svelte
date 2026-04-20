<!--
  Sticky call-to-action button.

  Place this component as the FIRST CHILD of a section group wrapper
  (typically a `.chapter-wrap` div). Behavior:

    1. At page load / scrolling into the wrap, the button pins near the
       viewport bottom-right. Its natural position is at the top of the
       wrap; `position: sticky; top: calc(100dvh - …)` clamps the top
       to a fixed distance from the viewport bottom, holding the button
       there while the wrap is being scrolled.

    2. When the wrap's bottom edge approaches the pinned position
       (within var(--cta-v) of the button), the sticky clamp releases
       because the element can't stay below its own containing block's
       end. The button then scrolls up with the wrap naturally — no
       fade, no fixed positioning, no JS state.

    3. `position: sticky` with `top: …` (not `bottom: …`) is the correct
       direction here. Sticky-bottom only engages when an element enters
       the viewport from below during downward scroll; we want the
       button visible from the moment the wrap begins, which requires
       sticky-top with a threshold near the viewport bottom.

  Right-alignment via `margin-left: auto` on a `fit-content`-width
  element. Horizontal gutter matches pronouns-text-to-left-edge on wide
  screens (max-width 1320px sections + 1.25rem padding).

  The button reserves a fixed height (`--cta-h-box`) so a matching
  negative `margin-bottom` can cancel its own vertical footprint in the
  flow — the next section (hero, etc.) starts where it would have
  without the sticky button at the top of the wrap.
-->
<script lang="ts">
  import type { ServiceCTA } from '$lib/content';

  let { cta }: { cta: ServiceCTA } = $props();
</script>

<a
  class="sticky-cta"
  class:secondary={cta.kind === 'secondary'}
  href={cta.href}
  aria-label={cta.label}
>
  {cta.label}
</a>

<style>
  .sticky-cta {
    /* Horizontal gutter: matches pronouns-text-to-left-edge on wide
       screens (max(1.25rem, (100vw - 1320px)/2 + 1.25rem)). */
    --cta-h: max(1.25rem, calc((100vw - 1320px) / 2 + 1.25rem));
    /* Vertical gutter: inherited from an ancestor (.flod defines it).
       Also acts as the padding-bottom on .chapter-wrap, so the CTA's
       sticky release happens at the same distance from the chapter
       divider as it has from the viewport bottom while pinned. */
    /* Fixed button height so sticky-top math and the flow-canceling
       negative margin-bottom agree exactly. */
    --cta-h-box: 3.3rem;

    position: sticky;
    /* Pin the button's top to `100dvh - height - gutter` so its bottom
       edge sits at var(--cta-v) from the viewport bottom while stuck.
       100dvh (dynamic viewport) plays nice with the iOS URL-bar toggle.
       Fallback to 100vh on browsers without dvh. */
    top: calc(100vh - var(--cta-h-box) - var(--cta-v));
    top: calc(100dvh - var(--cta-h-box) - var(--cta-v));
    z-index: 50;

    /* Right-aligned in the containing block via auto-left margin. Using
       block-level `flex` (not `inline-flex`) so the auto margin works
       while still centering the label vertically inside the box. */
    display: flex;
    align-items: center;
    width: fit-content;
    margin-left: auto;
    margin-right: var(--cta-h);

    /* Fixed height so sticky-top math + the containment check agree.
       We deliberately do NOT use `margin-bottom: -height` here — a
       negative margin would collapse the button's margin-box to zero,
       and sticky's containment rule uses the margin-box, not the
       border-box. With a zero margin-box, the CTA would never be
       pushed up by its wrapper's ending, and the padding-bottom
       trick on .chapter-wrap couldn't move the release point.
       Instead, the wrap's FIRST SECTION gets a matching negative
       margin-top (see +page.svelte) to cancel the button's vertical
       footprint in flow without affecting the CTA's own geometry. */
    height: var(--cta-h-box);
    padding: 0 1.9em;

    font-family: var(--font-serif);
    font-size: 1.15rem;
    letter-spacing: 0.02em;
    text-decoration: none;
    /* Default fill: deep fern green (shared with .foot footer bg). */
    background: var(--violet);
    color: var(--bone);
    border: 1px solid var(--violet);
    border-radius: 2px;
    box-shadow: 0 8px 20px -12px color-mix(in oklch, var(--violet) 60%, transparent);

    transition:
      background 0.2s ease,
      color 0.2s ease,
      border-color 0.2s ease;
  }

  /* Hover + active: neon tangerine accent, dark text. */
  .sticky-cta:hover,
  .sticky-cta:active {
    background: var(--tangerine);
    color: var(--violet);
    border-color: var(--tangerine);
  }

  .sticky-cta.secondary {
    background: transparent;
    color: var(--violet);
  }
  .sticky-cta.secondary:hover,
  .sticky-cta.secondary:active {
    background: var(--tangerine);
    color: var(--violet);
    border-color: var(--tangerine);
  }
</style>
