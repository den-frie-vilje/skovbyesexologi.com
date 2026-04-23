<!--
  Generic numbered reasons list — "come by if you…", "write to
  me if you…", etc. Label on top, items rendered with a mono
  01..N prefix and serif body.

  Design mirrors the homepage's `.for-personal` / `.for-work`
  pattern so the therapy detail page can use the same component
  without new styles.

  Presentational only — relies on `.app-shell` tokens from the page
  root.
-->
<script lang="ts">
  import type { HomeList } from '$lib/content';

  interface Props {
    list: HomeList;
  }

  let { list }: Props = $props();
</script>

{#if list && list.items.length > 0}
  <section class="numbered">
    <p class="label">{list.label}</p>
    <ul>
      {#each list.items as item, i}
        <li>
          <span class="n">{String(i + 1).padStart(2, '0')}</span>
          <span>{item}</span>
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
    color: var(--text-muted);
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
    grid-template-columns: auto 1fr;
    gap: 1.5rem;
    padding: 1.25rem 0;
    border-top: 1px solid var(--rule);
    font-family: var(--font-serif);
    font-size: clamp(1.15rem, 2.4vw, 1.6rem);
    line-height: 1.3;
    align-items: baseline;
  }
  li:last-child {
    border-bottom: 1px solid var(--rule);
  }

  .n {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    letter-spacing: 0.14em;
    color: var(--accent);
  }
</style>
