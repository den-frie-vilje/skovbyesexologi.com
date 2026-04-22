<!--
  Manifest section — numbered rows with serif prose where the
  keyword is italicised + highlighter-barred in chartreuse (echo
  of the hero's `<em>burde</em>` treatment). Same mechanism the
  homepage uses; this component lets other pages render the
  same content with a slightly quieter type scale.

  Presentational only — relies on `.flod` palette tokens from
  the page root (`--font-serif`, `--font-mono`, `--graphite`,
  `--rule`, `--tangerine`).

  The `scale` prop switches between the homepage's bold
  multi-line display treatment and a detail-page prose scale.
  Default is 'detail' since the homepage isn't currently a
  consumer (it uses its own inline render pre-dating this
  component).
-->
<script lang="ts">
  import type { HomeManifest } from '$lib/content';

  interface Props {
    manifest: HomeManifest;
    /** 'detail' → tighter serif for the service detail pages;
     *  'display' → big multi-line serif matching the homepage
     *  manifest section. */
    scale?: 'detail' | 'display';
  }

  let { manifest, scale = 'detail' }: Props = $props();
</script>

{#if manifest && manifest.items.length > 0}
  <section class="manifest" data-scale={scale}>
    <p class="label">{manifest.label}</p>
    <ul>
      {#each manifest.items as m, i}
        <li>
          <span class="num">{String(i + 1).padStart(2, '0')}</span>
          <p>
            {#each m.text.split(m.word) as part, j}
              {part}{#if j < m.text.split(m.word).length - 1}<em>{m.word}</em>{/if}
            {/each}
          </p>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    margin: 0 0 2rem;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0;
  }
  li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 1.5rem;
    padding: 1.5rem 0;
    border-bottom: 1px solid var(--rule);
  }
  li:first-child {
    border-top: 1px solid var(--rule);
  }

  .num {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    letter-spacing: 0.14em;
    color: var(--violet);
    padding-top: 0.4em;
  }

  p {
    font-family: var(--font-serif);
    line-height: 1.2;
    letter-spacing: -0.01em;
    font-weight: 400;
    margin: 0;
    color: var(--graphite);
  }

  /* Chartreuse highlighter under the italicised keyword —
     same gesture as the hero's em treatment, scaled with the
     surrounding text via `em`-relative padding on the bar. */
  em {
    font-style: italic;
    font-weight: 500;
    background: linear-gradient(
      180deg,
      transparent 68%,
      color-mix(in oklch, var(--tangerine) 55%, transparent) 68%
    );
    padding: 0 0.04em;
  }

  /* ====== SCALE VARIANTS ====== */
  /* Detail page: a prose-scale treatment; quieter than the
     homepage display but still serif + highlighter on the word. */
  [data-scale='detail'] p {
    font-size: clamp(1.1rem, 2vw, 1.5rem);
    max-width: 44ch;
  }
  /* Display: the homepage's large-serif manifesto treatment. */
  [data-scale='display'] p {
    font-size: clamp(1.5rem, 4.5vw, 3rem);
    max-width: 26ch;
  }
</style>
