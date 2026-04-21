<!--
  Redirect shim for /da → /. The load function in +page.ts throws a
  301, so this markup only renders as the meta-refresh fallback HTML
  that adapter-static writes for static hosts that don't honour
  Location headers (the `prerender = true` bakes it into the build).
-->
<svelte:head>
  <title>Redirecting…</title>
  <meta name="robots" content="noindex" />
  <meta http-equiv="refresh" content="0; url=/" />
  <link rel="canonical" href="/" />
</svelte:head>

<p>Omdirigerer <a href="/">til forsiden</a>…</p>
