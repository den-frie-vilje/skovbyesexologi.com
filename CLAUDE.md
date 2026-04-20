# Skovbye Sexologi — Project Guidelines

Editorial website for Signe Skovbye: psychomotor therapist, clinical sexologist,
intimacy coordinator. Static SvelteKit build, Danish-first, self-hostable.

See [AGENTS.md](AGENTS.md) for the deep reference (Three.js stage architecture,
palette conventions, perf lessons, roadmap).

## Current Phase

**Phase 2 — the "Flod" direction is the site.** The editorial / techno sketches
have been removed. The homepage at `/` is the Flod design: a single
scrolling document, two chapters (Terapi → Konsulentydelser), with a
scroll-choreographed WebGL stage.

Next up:

- Content migration from `src/lib/content.ts` (TS object) to
  `src/content/{da,en}/…` (MDX / JSON frontmatter)
- Sveltia CMS wired at `/admin`, git-committed edits
- Bilingual routing (DA default, EN at `/en/…`), `hreflang`
- JSON-LD schema (LocalBusiness + Person + Service), sitemap, proper OG
  images per service
- Per-service detail pages
- Accessibility audit + `prefers-reduced-motion` fallback for the WebGL stage

## Quick Reference

- All commands run via `pkgx` — never install Node/pnpm/etc. globally
  ```sh
  pkgx pnpm install
  pkgx pnpm dev      # vite on :5173, host 0.0.0.0
  pkgx pnpm build    # static → build/
  pkgx pnpm check    # svelte-check + tsc
  ```
- **Svelte 5 runes only** (`$props()`, `$state()`, `$derived()`) — no `export let`, no `$:`
- **Tailwind v4** — design tokens in `@theme` block in `src/app.css`
- **Static build** via `@sveltejs/adapter-static`; every route prerendered
  (root `+layout.ts` sets `prerender = true`)
- Content lives in `src/lib/content.ts` as a typed `site` object (Danish copy,
  originally scraped from the live Wix site).

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
