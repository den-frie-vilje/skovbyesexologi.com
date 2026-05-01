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
    Phase 2 / H3 — Content Security Policy for /admin.
    Locks the editor down to only the origins Sveltia actually
    needs. Meta-tag CSP rather than HTTP header so the policy
    is co-located with the page that loads Sveltia (same git
    file, same review path) — survives any nginx/Caddy refactor.

    Allowed:
      default-src 'self'           — fall back to same-origin only
      script-src 'self'            — only /admin/sveltia-cms.js
                                     (self-hosted) and any other
                                     same-origin script. NO inline
                                     scripts and NO 'unsafe-eval'.
      style-src                    — same-origin + Google Fonts CSS
                                     ('unsafe-inline' is needed
                                     because Sveltia injects styles
                                     dynamically at runtime; meta CSP
                                     can't use a nonce).
      img-src                      — same-origin, data:, blob: (for
                                     editor image previews), and
                                     GitHub avatar/usercontent hosts.
      font-src                     — same-origin + data: (for
                                     embedded font glyphs) +
                                     fonts.gstatic.com.
      connect-src                  — same-origin (for /auth/* OAuth
                                     proxy, /admin/config.yml, and
                                     fetches to the static tree) +
                                     api.github.com (Sveltia's API
                                     target), github.com (OAuth
                                     redirects), and the
                                     usercontent hosts (avatars,
                                     possibly raw asset reads).
      worker-src 'self' blob:      — Sveltia may spawn workers from
                                     blob URLs.
      base-uri 'self'              — block <base href> tag injection
                                     attacks from rewriting all
                                     relative URLs.

    Blocked by absence:
      object-src                   — covered by default-src 'self'
                                     and we never embed plugins.
      frame-ancestors              — meta-tag CSP can't enforce this
                                     (browsers ignore it from meta);
                                     add via the per-site Caddyfile
                                     if frame-busting matters later.

    To diagnose violations: open /admin in DevTools console — any
    blocked resource shows a "Refused to load …" error pointing
    at the directive that blocked it. Add the host to that
    directive's allowlist and re-deploy.
  -->
  <meta
    http-equiv="content-security-policy"
    content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.githubusercontent.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.github.com https://github.com https://avatars.githubusercontent.com https://*.githubusercontent.com; worker-src 'self' blob:; base-uri 'self';"
  />
  <!--
    Sveltia's UMD bundle — deliberately NOT `type="module"`. The bundle
    ships as a classic script and warns at runtime if loaded as a module.
  -->
  <script src="/admin/sveltia-cms.js"></script>

  <!--
    Floating "Publicér" button injected into Sveltia's toolbar.
    See static/admin/publish-fab.js for the rationale (auth-aware,
    anchored to Sveltia's primary `[role="toolbar"]` so it tracks
    the toolbar's actual position when the announcement banner
    toggles, hidden on the pre-auth screen). Same-origin script,
    allowed by the CSP above's `script-src 'self'` directive.
  -->
  <script src="/admin/publish-fab.js" defer></script>
</svelte:head>
