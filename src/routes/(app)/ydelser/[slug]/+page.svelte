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
  import { contentFor } from '$lib/content';
  import { buildServicePageSeo } from '$lib/seo/structured-data';
  import ServicePage from '$lib/components/ServicePage.svelte';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  /*
    Locale-resolved content bundle. The shared `(app)/+layout.svelte`
    also reads `data.locale` via `$page.data` to render the header,
    contact section, and footer — so we don't touch the shell here;
    this wrapper only owns the service-specific <svelte:head> and
    hands body props to <ServicePage>.
  */
  const bundle = $derived(contentFor(data.locale));
  const site = $derived(bundle.site);
  const bio = $derived(bundle.bio);
  const contact = $derived(bundle.contact);
  const service = $derived(data.service);

  /*
    Every `<svelte:head>` tag for this page — title, description,
    canonical, hreflang triad (DA self, EN peer or `/en` fallback,
    x-default = DA), OpenGraph, Twitter, JSON-LD (business + person
    + this Service + BreadcrumbList) — derives from one call. All
    locale-specific URL and string decisions live in
    `buildServicePageSeo`.
  */
  const seo = $derived(
    buildServicePageSeo({
      locale: 'da',
      site,
      bio,
      contact,
      service,
      peer: data.peer,
      homeLabel: 'Forsiden'
    })
  );
</script>

<SeoHead {seo} />

<!--
  The terapi detail page previously borrowed the homepage's manifest +
  ritual + forPersonal blocks (three stacked numbered lists) so it
  "didn't end abruptly after the bullets". With terapi now carrying its
  own prose `body`, those borrowed blocks were pure duplication of the
  homepage and the page's heaviest list-load — dropped. Re-add a prop
  here if a future terapi-chapter service wants one back.
-->
<ServicePage
  service={data.service}
  {bundle}
  backLabel="Forsiden"
  backHref="/"
/>
