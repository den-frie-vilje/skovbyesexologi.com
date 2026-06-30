<!--
  English service detail page. Thin route wrapper — see the DA
  mirror at `routes/ydelser/[slug]/+page.svelte` for the primary
  commentary. Any change here should also land there.
-->
<script lang="ts">
  import { contentFor } from '$lib/content';
  import { buildServicePageSeo } from '$lib/seo/structured-data';
  import ServicePage from '$lib/components/ServicePage.svelte';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // See the DA mirror for commentary — the shared `(app)/+layout.svelte`
  // owns the header/contact/footer shell; this wrapper only emits
  // service-specific <svelte:head> + body via <ServicePage>.
  const bundle = $derived(contentFor(data.locale));
  const site = $derived(bundle.site);
  const bio = $derived(bundle.bio);
  const contact = $derived(bundle.contact);
  const service = $derived(data.service);

  // EN mirror of DA's SEO head — see DA wrapper for commentary.
  const seo = $derived(
    buildServicePageSeo({
      locale: 'en',
      site,
      bio,
      contact,
      service,
      peer: data.peer,
      homeLabel: 'Home'
    })
  );
</script>

<SeoHead {seo} />

<!--
  See the DA mirror for the rationale: terapi's borrowed homepage
  blocks (manifest + ritual + forPersonal) are dropped now that the
  service carries its own prose `body`.
-->
<ServicePage
  service={data.service}
  {bundle}
  backLabel="Home"
  backHref="/en"
/>
