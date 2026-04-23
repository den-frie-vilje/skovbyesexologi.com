<!--
  Single-source renderer for a page's `<svelte:head>` SEO payload.
  Pure rendering — no logic, no derivations. The shape it accepts
  (`PageSeo`) is built by `$lib/seo/structured-data` (see
  `buildHomePageSeo` / `buildServicePageSeo` there), which is where
  every locale- and page-specific string decision lives.

  Tag order is fixed and intentional:
    1. <title> + description / author / theme-color
    2. Canonical + hreflang triad (da, en, x-default)
    3. OpenGraph
    4. Twitter / X
    5. JSON-LD (@graph)

  Some crawlers are mildly order-sensitive; keep this order stable
  across refactors. If anything needs to change, update the "before"
  snapshot in the review and re-verify byte-parity.
-->
<script lang="ts">
  import type { PageSeo } from '$lib/seo/structured-data';

  interface Props {
    seo: PageSeo;
  }

  let { seo }: Props = $props();
</script>

<svelte:head>
  <title>{seo.title}</title>
  <meta name="description" content={seo.description} />
  <meta name="author" content={seo.author} />
  <meta name="theme-color" content={seo.themeColor} />

  <!-- Canonical + hreflang (always da → en → x-default). -->
  <link rel="canonical" href={seo.canonical} />
  <link rel="alternate" hreflang="da" href={seo.alternates.da} />
  <link rel="alternate" hreflang="en" href={seo.alternates.en} />
  <link rel="alternate" hreflang="x-default" href={seo.alternates.xDefault} />

  <!-- Open Graph — Facebook, LinkedIn, generic link previews. -->
  <meta property="og:site_name" content={seo.og.siteName} />
  <meta property="og:title" content={seo.og.title} />
  <meta property="og:description" content={seo.og.description} />
  <meta property="og:type" content={seo.og.type} />
  <meta property="og:locale" content={seo.og.locale} />
  <meta property="og:locale:alternate" content={seo.og.localeAlternate} />
  <meta property="og:url" content={seo.og.url} />
  <meta property="og:image" content={seo.og.image.url} />
  <meta property="og:image:alt" content={seo.og.image.alt} />
  <meta property="og:image:width" content={String(seo.og.image.width)} />
  <meta property="og:image:height" content={String(seo.og.image.height)} />
  <meta property="og:image:type" content={seo.og.image.type} />

  <!-- Twitter / X — uses its own meta namespace. -->
  <meta name="twitter:card" content={seo.twitter.card} />
  <meta name="twitter:title" content={seo.twitter.title} />
  <meta name="twitter:description" content={seo.twitter.description} />
  <meta name="twitter:image" content={seo.twitter.image} />

  <!--
    Schema.org structured data — @graph already serialised by the
    builder, emitted as one <script type="application/ld+json"> tag.
    See https://search.google.com/test/rich-results.
  -->
  {@html `<script type="application/ld+json">${seo.jsonLd}</script>`}
</svelte:head>
