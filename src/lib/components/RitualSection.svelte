<!--
  Ritual / "how a session flows" section — numbered steps with
  a mono ordinal, italic-serif title, and short body per step.
  Matches the homepage's `.ritual` design; exposed as a
  component so the therapy detail page renders the same pattern
  without duplicating markup + CSS.

  Presentational only — relies on `.flod` tokens.
-->
<script lang="ts">
  import type { HomeRitual } from '$lib/content';

  interface Props {
    ritual: HomeRitual;
  }

  let { ritual }: Props = $props();
</script>

{#if ritual && ritual.steps.length > 0}
  <section class="ritual">
    <div class="head">
      <p class="label">{ritual.label}</p>
      {#if ritual.subtitle}
        <h2>{ritual.subtitle}</h2>
      {/if}
    </div>
    <ol>
      {#each ritual.steps as step}
        <li>
          <span class="n">{step.n}</span>
          <div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </div>
        </li>
      {/each}
    </ol>
  </section>
{/if}

<style>
  .head {
    max-width: 54ch;
    margin-bottom: 2.5rem;
  }
  .label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--graphite-soft);
    margin: 0 0 1rem;
  }
  .head h2 {
    font-family: var(--font-serif);
    font-size: clamp(1.6rem, 3.5vw, 2.2rem);
    line-height: 1;
    letter-spacing: -0.02em;
    font-weight: 400;
    margin: 0;
  }

  ol {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0;
  }
  li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2rem;
    padding: 1.75rem 0;
    border-top: 1px solid var(--rule);
    align-items: baseline;
  }
  li:last-child {
    border-bottom: 1px solid var(--rule);
  }

  .n {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    letter-spacing: 0.14em;
    color: var(--violet);
  }
  h3 {
    font-family: var(--font-serif);
    font-size: clamp(1.25rem, 2.4vw, 1.6rem);
    font-weight: 500;
    font-style: italic;
    letter-spacing: -0.01em;
    margin: 0 0 0.5rem;
    color: var(--graphite);
  }
  p {
    font-size: 1.02rem;
    line-height: 1.6;
    margin: 0;
    max-width: 60ch;
    color: color-mix(in oklch, var(--graphite) 85%, transparent);
  }
</style>
