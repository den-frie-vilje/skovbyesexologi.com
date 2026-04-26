# Skovbye Sexologi — Project Guidelines

Editorial website for Signe Skovbye: psychomotor therapist, clinical sexologist,
intimacy coordinator. Static SvelteKit build, Danish-first, self-hostable.

See [AGENTS.md](AGENTS.md) for the deep reference (Three.js stage architecture,
palette conventions, perf lessons, roadmap).

## Current state

The "Flod" homepage at `/` is the site: one scrolling document, two
chapters (Terapi → Konsulentydelser), scroll-choreographed Three.js
stage. Bilingual: DA at `/`, EN at `/en/...`. Per-service detail
pages live at `/ydelser/[slug]` (DA) and `/en/services/[slug]` (EN).
Sveltia CMS at `/admin` writes back to the repo via the GitHub
backend (self-hosted bundle, CSP-locked). Production deploys via the
nas-sites HMAC-webhook pipeline with a reviewer-gated workflow.

What's still open: JSON-LD structured data (LocalBusiness + Person +
Service + Review), accessibility audit + `prefers-reduced-motion`
fallback for the WebGL stage, possible booking integration. See
[AGENTS.md](AGENTS.md) for the full state breakdown.

## Quick Reference

- All commands run via `pkgx` — never install Node/pnpm/etc. globally
  ```sh
  pkgx pnpm install
  pkgx pnpm dev      # vite on :5173, host 0.0.0.0
  pkgx pnpm build    # static → build/
  pkgx pnpm check    # svelte-check + tsc
  pkgx pnpm icons    # regenerate pose SVG thumbnails (after editing poses.ts)
  ```
- **Admin UI**: Sveltia CMS at `/admin`, GitHub backend, version-pinned
  bundle self-hosted at `/admin/sveltia-cms.js` (the unpkg CDN load
  was retired in Phase 2 / C1; bundle is copied from
  `node_modules/@sveltia/cms` by the `prebuild` script). The stage
  pose `options:` arrays under `home.sections.stage` must stay in
  sync with `src/lib/stage/poses.ts` (manual upkeep until a custom
  `pose-select` widget lands). `/admin` ships a meta-tag CSP locked
  to same-origin + GitHub hosts.
- **Svelte 5 runes only** (`$props()`, `$state()`, `$derived()`) — no `export let`, no `$:`
- **Tailwind v4** — design tokens in `@theme` block in `src/app.css`
- **Static build** via `@sveltejs/adapter-static`; every route prerendered
  (root `+layout.ts` sets `prerender = true`); SPA fallback to
  `/200.html` for the runtime-only `/publish` route.
- Content lives in `src/content/{da,en}/*.json` + `src/content/services/{da,en}/*.json`,
  loaded via `$lib/content`'s `contentFor(locale)` and
  `loadService(slug, locale)`.

## Three.js Stage in 60 Seconds

`src/lib/components/FlodStage.svelte` is a fixed full-viewport canvas
(`z-index: -1`, `isolation: isolate` on `.flod` contains it). It renders:

- a large iridescent **mercury orb** (displaced sphere, `MeshPhysicalMaterial`
  with iridescence in therapy, pure chrome in consultancy)
- a **gold metaball cluster** (`MarchingCubes` @ resolution 48)
- a **faceted gem** (low-poly icosahedron, flat-shaded, opaque chrome —
  NEVER re-enable `transmission > 0`, see perf notes)

Positions/scales are driven by a `stageAnchors` array in `routes/+page.svelte`.
Each section selector has `{ main, drip1, drip2, intensity }` NDC targets.
The tick double-lerps toward the visibility-weighted blend of nearby
anchors — smooth no matter how fast you scroll.

**Chapter transition**: the page tracks a continuous `chapterMode` (0 in
Terapi, 1 in Konsulentydelser). The stage cross-fades materials, env maps,
and iridescence along that value. This is wired up through a **global
`THREE.ShaderChunk` patch** applied once at mount — don't try to do it
per-material with `onBeforeCompile` alone (the `#include` directives
haven't resolved yet at that point, so regex matches return zero).

## Hard-Won Lessons (do not relearn these)

- **WebGL canvas does not participate in CSS `mix-blend-mode`** compositing.
  Text over the stage must use plain colour — no "dynamic inversion" effect
  is achievable without moving off WebGL.
- **Never `backdrop-filter: blur()` on sticky elements** here. It kills
  scroll perf in Safari, compounding badly with the WebGL canvas.
- **Never set `transmission > 0`** on a `MeshPhysicalMaterial` unless you
  actually need refraction. It adds a second scene render pass every frame.
- **`scene.environment` is not enough for env-map crossfades.** Each material
  needs its own explicit `envMap` so we can swap per-chapter independently.
- **Cap `renderer.setPixelRatio` at 1.5.** Retina phones at 3× quadruple the
  GPU work for no visible gain on metal/iridescent materials.
- **iOS Safari `resize` event fires on URL-bar toggle.** Only resize the
  renderer when width actually changes, or the stage squeezes mid-scroll.
- **Screenshot verification is unreliable for scroll-driven WebGL state.**
  Trust the user's eye over your own analysis of screenshots.

## Svelte MCP Tools

Configured in `.mcp.json` (active when Claude is launched with CWD at this
repo). Use them when writing Svelte:

1. **list-sections** — discover doc sections (use FIRST)
2. **get-documentation** — fetch full docs
3. **svelte-autofixer** — check Svelte code before finalising
4. **playground-link** — only after user confirms; never when writing to
   project files

## Tooling Note

Node 25 is the floor. Both `pkgx.yml` (`nodejs.org: ~25`) and
`package.json` (`engines.node: ~25`) agree. Node 25 strips TypeScript
types natively, which lets us run `scripts/*.ts` directly without tsx.
