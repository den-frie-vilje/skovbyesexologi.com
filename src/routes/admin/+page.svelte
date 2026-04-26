<!--
  Sveltia CMS admin page.

  Renders as a plain host page for the Sveltia CMS bundle, which takes
  over <body> and mounts its own editor UI. Config is fetched from
  /admin/config.yml (served from static/admin/).

  Using a SvelteKit route instead of a standalone static/admin/index.html
  so that `/admin` and `/admin/` resolve consistently in both dev (vite
  doesn't auto-serve directory index files) and in production (any
  host/platform, no reliance on directory-index resolution).

  Bundle is self-hosted at /admin/sveltia-cms.js — the version is
  pinned via `package.json`'s devDependency on `@sveltia/cms`, and the
  prebuild script (`scripts/copy-sveltia.ts`) copies the file from
  `node_modules/@sveltia/cms/dist/sveltia-cms.js` into `static/admin/`
  before each `vite build`. Dependabot's weekly npm group surfaces
  upstream releases for review.

  Why self-hosted (was on unpkg): supply-chain hardening (C1). The
  unpkg `@0` tag floated to whatever Sveltia had latest, with no
  Subresource Integrity hash, making the admin loader vulnerable to
  any compromise of unpkg's CDN distribution path or to upstream
  publishing breakage. The bundle is now under our own control,
  served same-origin, version-pinned, and reviewable per upgrade.
-->
<svelte:head>
  <title>Skovbye Sexologi — Admin</title>
  <meta name="robots" content="noindex, nofollow" />
  <!--
    Sveltia's UMD bundle — deliberately NOT `type="module"`. The bundle
    ships as a classic script and warns at runtime if loaded as a module.
  -->
  <script src="/admin/sveltia-cms.js"></script>
</svelte:head>
