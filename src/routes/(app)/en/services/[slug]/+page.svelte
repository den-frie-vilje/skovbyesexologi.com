<!--
  English service detail page. Thin route wrapper — see the DA
  mirror at `routes/ydelser/[slug]/+page.svelte` for the primary
  commentary. Any change here should also land there.
-->
<script lang="ts">
  import { contentFor } from '$lib/content';
  import { SITE_URL } from '$lib/seo/structured-data';
  import ServicePage from '$lib/components/ServicePage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // See the DA mirror for commentary — the shared `(app)/+layout.svelte`
  // owns the header/contact/footer shell; this wrapper only emits
  // service-specific <svelte:head> + body via <ServicePage>.
  const bundle = $derived(contentFor(data.locale));
  const site = $derived(bundle.site);
  const home = $derived(bundle.home);
  const service = $derived(data.service);

  const canonicalUrl = $derived(`${SITE_URL}/en/services/${service.slug}`);
  const alternateDa = $derived(
    data.peer ? `${SITE_URL}/ydelser/${data.peer.slug}` : null
  );

  const pageTitle = $derived(`${service.title} · ${site.name}`);
  const pageDescription = $derived(service.blurb || site.tagline);
  // Per-service OG (EN variant) — see DA mirror for commentary.
  const ogImageUrl = $derived(`${SITE_URL}/img/og/${service.id}.en.jpg`);
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={pageDescription} />

  <link rel="canonical" href={canonicalUrl} />
  <link rel="alternate" hreflang="en" href={canonicalUrl} />
  {#if alternateDa}
    <link rel="alternate" hreflang="da" href={alternateDa} />
    <link rel="alternate" hreflang="x-default" href={alternateDa} />
  {/if}

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={site.name} />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={pageDescription} />
  <meta property="og:locale" content="en_US" />
  {#if alternateDa}
    <meta property="og:locale:alternate" content="da_DK" />
  {/if}
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={ogImageUrl} />
  <meta property="og:image:alt" content={service.title} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/jpeg" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={pageTitle} />
  <meta name="twitter:description" content={pageDescription} />
  <meta name="twitter:image" content={ogImageUrl} />
</svelte:head>

<ServicePage
  service={data.service}
  {bundle}
  backLabel="Home"
  backHref="/en"
  manifest={service.chapter === 'terapi' ? home.manifest : undefined}
  ritual={service.chapter === 'terapi' ? home.ritual : undefined}
  forPersonal={service.chapter === 'terapi' ? home.forPersonal : undefined}
/>
