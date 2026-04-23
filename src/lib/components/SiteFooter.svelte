<!--
  Site-wide footer strip — copyright + CVR line. Shown on every page
  (home + service detail pages). Markup + style live here rather
  than being duplicated per route.

  Expects to be mounted as a sibling of `<main>` inside a `.app-shell`
  root so design tokens (`--surface`, `--font-mono`) resolve. Kept
  outside `<main>` intentionally: this is the page footer landmark,
  not part of the primary content.
-->
<script lang="ts">
  interface Props {
    /** Rendered copyright string — already expanded from the
     *  template `{year} {name} · CVR {cvr}` by the caller, so this
     *  component stays presentational. */
    text: string;
  }

  let { text }: Props = $props();
</script>

<footer class="foot">
  <p>{text}</p>
</footer>

<style>
  .foot {
    /* Deep fern — a darker floor below the .contact sage. Kept as its
       own explicit value rather than deriving from var(--accent) so the
       typography accent can be a lighter, more-obviously-green sage
       without darkening the .foot strip. */
    background: oklch(0.2 0.06 152);
    /* 65% bone — 4.5:1 on the deep-fern bg, meeting WCAG AA for
       small text. Was 45% (4.06:1) before the a11y pass. */
    color: color-mix(in oklch, var(--surface) 65%, transparent);
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

  @media (min-width: 720px) {
    .foot p {
      padding-left: 2rem;
      padding-right: 2rem;
    }
  }
  @media (min-width: 1024px) {
    .foot p {
      padding-left: 3rem;
      padding-right: 3rem;
    }
  }
</style>
