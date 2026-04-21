<!--
  Redirect shim for /da/<rest> → /<rest>. The load function in
  +page.ts throws a 301; this markup only serves as the meta-refresh
  fallback baked by adapter-static.
-->
<script lang="ts">
  import { page } from '$app/state';
  const target = $derived(page.params.rest ? `/${page.params.rest}` : '/');
</script>

<svelte:head>
  <title>Redirecting…</title>
  <meta name="robots" content="noindex" />
  <meta http-equiv="refresh" content="0; url={target}" />
  <link rel="canonical" href={target} />
</svelte:head>

<p>Omdirigerer <a href={target}>{target}</a>…</p>
