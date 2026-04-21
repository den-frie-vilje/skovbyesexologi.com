<!--
  Sveltia CMS admin page.

  Renders as a plain host page for the Sveltia CMS bundle, which takes
  over <body> and mounts its own editor UI. Config is fetched from
  /admin/config.yml (served from static/admin/).

  Using a SvelteKit route instead of a standalone static/admin/index.html
  so that `/admin` and `/admin/` resolve consistently in both dev (vite
  doesn't auto-serve directory index files) and in production (any
  host/platform, no reliance on directory-index resolution).

  Pinned to @sveltia/cms@0 on unpkg — update the version string
  deliberately. Replace with a self-hosted bundle if the CDN is blocked
  or you want air-gapped editing.
-->
<svelte:head>
  <title>Skovbye Sexologi — Admin</title>
  <meta name="robots" content="noindex, nofollow" />
  <!--
    Sveltia's UMD bundle — deliberately NOT `type="module"`. The bundle
    ships as a classic script and warns at runtime if loaded as a module.
  -->
  <script src="https://unpkg.com/@sveltia/cms@0/dist/sveltia-cms.js"></script>
</svelte:head>
