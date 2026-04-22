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
  <!--
    Chartreuse dot AFTER the label — echoes the `.` at the end of
    "Skriv." in the contact heading. Baseline-aligned so it reads
    as a punctuation mark on the label, not a floating disc.

    Wrapped in a single inline container so the dot's
    `vertical-align: baseline` actually binds to the label's text
    baseline — on a flex layout, `vertical-align` is ignored, so
    the button itself is flex but its children share an inline
    formatting context inside `.cta-inner`.

    On hover the dot scales up to fill the whole button; the
    label is z-indexed above and shifts slightly to the right so
    its centre lands on the button's geometric centre once the
    dot is no longer visually taking space.
  -->
  <span class="cta-inner">
    <span class="cta-label">{cta.label}</span><span class="cta-dot" aria-hidden="true"></span>
  </span>
</a>

<style>
  .sticky-cta {
    /*
      Horizontal + vertical gutters are inherited from an
      ancestor (typically `.flod`), which lets each page type set
      its own content max-width via `--cta-h` — homepage uses the
      1320px frame, service detail pages use the 1100px article
      column. The fallback here matches the homepage frame so
      older callers without an explicit `--cta-h` still work.
    */
    --cta-h-default: max(1.25rem, calc((100vw - 1320px) / 2 + 1.25rem));
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
       while still centering the label vertically inside the box.
       `align-items: center` keeps the inline content (label + dot)
       vertically centred in the 3.3rem-tall button; the dot's
       baseline alignment to the label happens inside `.cta-inner`
       via `vertical-align`, not at the flex layer. */
    display: flex;
    align-items: center;
    justify-content: center;
    width: fit-content;
    margin-left: auto;
    margin-right: var(--cta-h, var(--cta-h-default));

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
    /* Horizontal padding matches the vertical (button is
       `--cta-h-box` tall; text is 1.15rem so implicit vertical
       pad is ~0.9em). Left padding is slightly more than right
       to optically balance the chartreuse dot's visual weight on
       the right edge — without it, the label reads as crowded
       toward the left. 0.25em extra roughly equals half the
       dot + its left margin. */
    padding: 0 0.9em 0 1.15em;

    font-family: var(--font-serif);
    font-size: 1.15rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    text-decoration: none;
    color: var(--bone);
    border: none;
    border-radius: 2px;
    background: var(--violet);
    box-shadow: 0 8px 20px -12px color-mix(in oklch, var(--violet) 60%, transparent);

    /*
      Clip the expanding chartreuse dot to the button's shape — on
      hover the dot scales up past the button's edges, and overflow
      clipping is what makes the "fill" look clean. `isolation`
      keeps the dot's stacking context local so its z-index doesn't
      leak out into the page.
    */
    overflow: hidden;
    isolation: isolate;

    transition: color 0.25s ease;
  }

  /* Inline wrapper — shared inline formatting context for the
     label + dot so `vertical-align: baseline` on the dot binds to
     the label's text baseline. Nothing layout-changing here;
     `.sticky-cta`'s flex alignment positions this wrapper as a
     unit inside the button. */
  .cta-inner {
    display: inline-block;
    line-height: 1;
    white-space: nowrap;
  }

  /* Chartreuse disk — sits on the label's text baseline like the
     `.` in `Skriv.`. `vertical-align: baseline` works here because
     both `.cta-label` and `.cta-dot` are inline-level inside
     `.cta-inner`. The dot's bottom edge aligns with the text
     baseline, so visually the disk sits just above the baseline —
     the same relationship a period has to its surrounding text.
     On hover it scales 60× from its own centre, filling the
     button with chartreuse. */
  .cta-dot {
    display: inline-block;
    width: 0.45em;
    height: 0.45em;
    margin-left: 0.22em;
    border-radius: 50%;
    background: var(--tangerine);
    vertical-align: baseline;
    z-index: 0;
    /* Optical correction — with pure `vertical-align: baseline`
       the dot's bottom edge sits exactly on the text baseline,
       which visually reads as "hovering" because the dot's small
       size makes it occupy the x-height band. Nudging half a
       pixel lower lets the dot read as resting on (and just
       barely past) the baseline, like a period's visual weight
       in a serif face. Browsers paint subpixel translates
       consistently on high-DPI displays; on 1× the value rounds
       to 1px without a layout shift. */
    position: relative;
    top: 0.5px;
    transform-origin: 50% 50%;
    /* Half the speed of a typical hover — 0.7s lets the fill
       feel like a deliberate reveal rather than a burst. */
    transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .cta-label {
    display: inline-block;
    position: relative;
    z-index: 1;
    transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  }
  /* On hover: shift the label right by half of (dot + margin) so
     its centre lands on the button's geometric centre. The dot
     has already scaled past visibility, so the label reads as
     centred against a uniform chartreuse fill. */
  .sticky-cta:hover .cta-label,
  .sticky-cta:active .cta-label {
    /* +(dot + dot-margin) / 2 = +(0.45 + 0.22) / 2 = +0.335em. */
    transform: translateX(0.335em);
  }

  /* Hover / click / focus-visible: dot expands to fill. The
     scale factor is generous (×60) so even wide buttons get
     fully covered — cheap compared to measuring the diagonal
     per instance. Text colour darkens so it stays legible on
     the chartreuse fill. */
  .sticky-cta:hover .cta-dot,
  .sticky-cta:active .cta-dot {
    transform: scale(60);
  }
  .sticky-cta:hover,
  .sticky-cta:active {
    color: var(--violet);
  }

  /*
    Secondary variant — same mechanic, but the base is transparent
    rather than filled violet. At rest: just the chartreuse dot
    next to violet text. On hover: dot expands, button "fills" to
    chartreuse.
  */
  .sticky-cta.secondary {
    background: transparent;
    color: var(--violet);
  }
  .sticky-cta.secondary:hover .cta-dot,
  .sticky-cta.secondary:active .cta-dot {
    transform: scale(60);
  }
  .sticky-cta.secondary:hover,
  .sticky-cta.secondary:active {
    color: var(--violet);
  }
</style>
