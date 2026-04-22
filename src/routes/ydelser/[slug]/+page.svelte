<!--
  Danish service detail page. Thin route wrapper — the actual
  layout lives in `<ServicePage>`; this file only handles:

    • resolving the locale content bundle
    • emitting <svelte:head>: title, description, canonical,
      hreflang self + EN peer, OpenGraph + Twitter
    • passing everything down into ServicePage

  The EN mirror under `/en/services/[slug]` is structurally
  identical; any change here should be mirrored there.
-->
<script lang="ts">
  import { contentFor, renderFooterCopyright } from '$lib/content';
  import { SITE_URL } from '$lib/seo/structured-data';
  import ServicePage from '$lib/components/ServicePage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const bundle = $derived(contentFor(data.locale));
  const site = $derived(bundle.site);
  const contact = $derived(bundle.contact);
  const home = $derived(bundle.home);
  const service = $derived(data.service);

  const canonicalUrl = $derived(`${SITE_URL}/ydelser/${service.slug}`);
  const alternateEn = $derived(
    data.peer ? `${SITE_URL}/en/services/${data.peer.slug}` : null
  );

  const pageTitle = $derived(`${service.title} · ${site.name}`);
  // Meta description caps near ~160 chars — blurbs are typically
  // already concise. Fall back to the tagline if a service's
  // blurb is ever missing.
  const pageDescription = $derived(service.blurb || site.tagline);

  // Homepage og:image is the fallback until per-service OG renders
  // land (OG_SLUGS expansion in scripts/gen-og-images.ts).
  const ogImageUrl = `${SITE_URL}/img/og/home.da.png`;

  const footerCopyright = $derived(renderFooterCopyright(site, contact));
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={pageDescription} />

  <!-- Canonical + hreflang -->
  <link rel="canonical" href={canonicalUrl} />
  <link rel="alternate" hreflang="da" href={canonicalUrl} />
  {#if alternateEn}
    <link rel="alternate" hreflang="en" href={alternateEn} />
  {/if}
  <link rel="alternate" hreflang="x-default" href={canonicalUrl} />

  <!-- OpenGraph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={site.name} />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={pageDescription} />
  <meta property="og:locale" content="da_DK" />
  {#if alternateEn}
    <meta property="og:locale:alternate" content="en_US" />
  {/if}
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={ogImageUrl} />
  <meta property="og:image:alt" content={service.title} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={pageTitle} />
  <meta name="twitter:description" content={pageDescription} />
  <meta name="twitter:image" content={ogImageUrl} />
</svelte:head>

<ServicePage
  locale={data.locale}
  service={data.service}
  {bundle}
  {footerCopyright}
  backLabel="Forsiden"
  backHref="/"
/>
