# Skovbye Sexologi — Agent Guide

Editorial website for Signe Skovbye — psychomotor therapist, clinical
sexologist, intimacy coordinator. Static SvelteKit site, Danish-first,
self-hostable, git-controlled.

This file is the deep reference. [CLAUDE.md](CLAUDE.md) is the quick start.

## Status

The "Flod" visual system is the site. The root `/` route is the Flod
page; the earlier `/editorial` and `/techno` preview sketches have
been deleted. Content lives in `src/content/{da,en}/...` JSON files
edited via the Sveltia admin at `/admin`. Production deploys via the
nas-sites infrastructure (HMAC webhook → Synology NAS) with a
reviewer-gated GitHub Actions pipeline.

### Done so far

- ✅ Flod design — homepage, two chapters (Terapi → Konsulentydelser),
  scroll-choreographed Three.js stage
- ✅ Sveltia CMS at `/admin` — GitHub backend + self-hosted OAuth
  proxy + path-pinned npm bundle (no third-party CDN)
- ✅ Content model migration — `src/content/{site,contact,bio,home}.{da,en}.json`
  + per-service files under `src/content/services/{da,en}/...`
  (`src/lib/content.ts` is no longer imported anywhere)
- ✅ Bilingual routing — `[[lang=locale]]` param matcher; DA at `/`,
  EN at `/en/...`; `hreflang` links
- ✅ Per-service detail pages — DA at `/ydelser/[slug]`, EN at
  `/en/services/[slug]`
- ✅ Per-service OG images — runtime-generated via `og/[[lang=locale]]/[slug]`
- ✅ Production deploy pipeline — GitHub Actions → HMAC webhook →
  NAS, with a `production-gate` reviewer environment + path-scoped
  signed-commit verification gate (Phase 3)
- ✅ Admin Content-Security-Policy locking down `/admin`'s allowed
  origins (Phase 2 / H3)

### Open

- [ ] **JSON-LD structured data** — `LocalBusiness`, `Person`,
  `Service` (per service), `Review` (testimonials). `sitemap.xml`
  and `robots.txt` if not yet emitted.
- [ ] **Accessibility audit** — `prefers-reduced-motion` full
  fallback for the WebGL stage (static hero image + skipped canvas
  mount), visible focus states, ARIA on the chapter transition,
  keyboard navigation review.
- [ ] **Booking integration** — currently `mailto:` only; consider
  Calendly/Simply.coach embed if/when warranted.
- [ ] **Site security hardening (in progress)** — the rest of the
  post-security-review plan: HMAC + ts freshness check (Phase 4),
  digest-pin all base images (Phase 5), gitleaks instead of regex
  scan (Phase 6), `type=gha` build cache (Phase 7),
  `STRIP_EDITOR=true` build arg to remove `/admin` + `/publish`
  from the production image (Phase 8).

### Intentionally out of scope for now

- Live chat / AI assistant
- Blog / articles
- Client portal / intake forms (those live in Signe's existing booking tool)

## Build & Test

All commands require `pkgx` prefix — Node/pnpm are managed via pkgx, never
installed globally.

```sh
pkgx pnpm install     # install deps
pkgx pnpm dev         # vite dev server on :5173, host 0.0.0.0
pkgx pnpm build       # static build → build/
pkgx pnpm check       # svelte-check + tsc — run BEFORE every push
```

**Pre-push routine**: `pkgx pnpm check` before `git push`. Vite's
`pnpm build` does NOT run svelte-check; the CI Docker build does
(via `RUN pkgx pnpm check` in `deploy/Dockerfile`'s builder stage).
A type-only or attribute-typed error you didn't catch locally surfaces
as a failed CI build a minute or two after the push. Cheap to prevent.

`pkgx.yml` declares the toolchain: `nodejs.org: ~25`, `pnpm.io: ~10`.
`package.json` `engines` agrees. Node 25 is required — we lean on its
native TypeScript support for `scripts/*.ts` (no tsx/ts-node needed).

## Architecture

- **Svelte 5** with runes (`$props()`, `$state()`, `$derived()`). Never
  use `export let`, `$:`, or stores unless there's no rune equivalent.
- **SvelteKit 2** with `adapter-static`, `strict: true`. Root `+layout.ts`
  sets `prerender = true` so every route is a static HTML file.
- **Tailwind CSS v4** via `@tailwindcss/vite`. Tokens live in the `@theme`
  block of `src/app.css`; pages reference them via CSS custom properties
  (`var(--color-ink)`, etc.).
- **Typography** loaded in `src/app.html`: Fraunces, Inter, Space Grotesk,
  JetBrains Mono, Instrument Serif, DM Sans. The Flod page uses Instrument
  Serif + Fraunces + DM Sans.
- **Content** lives in `src/content/{site,contact,bio,home}.{da,en}.json`
  + `src/content/services/{da,en}/*.json` per service. Loaded via
  `src/lib/content/` (a `$lib/content` import resolves there) which
  exposes `contentFor(locale)` and `loadService(slug, locale)` plus
  the typed shapes (`Locale`, `Contact`, `Testimonial`, etc.).

## Repo Layout

```
src/
  app.html                       Font imports, base head
  app.css                        @theme tokens + base resets
  content/                       JSON-per-collection content tree
    {site,contact,bio,home}.{da,en}.json
    services/{da,en}/{terapi,intimacy-coordination,aeldrepleje,undervisning}.json
  lib/
    content/index.ts             Loaders + types — `$lib/content` resolves here
    components/
      FlodStage.svelte           Three.js stage
      SiteFooter.svelte          Footer with build-marker linking the deployed commit
    three/
      warmEnv.ts                 4 equirectangular env-map painters
  routes/
    +layout.svelte               Root shell
    +layout.ts                   prerender = true
    (app)/[[lang=locale]]/+page.svelte    Homepage — the Flod page (DA + EN)
    (app)/ydelser/[slug]/+page.svelte     Service detail — DA
    (app)/en/services/[slug]/+page.svelte Service detail — EN
    admin/+page.svelte           Sveltia CMS host (CSP-locked)
    publish/+page.svelte         Signe's "publish to production" button (staging→main merge)
    og/[[lang=locale]]/[slug]/   Per-service OG image generator
static/
  admin/
    config.yml                   Sveltia config
    sveltia-cms.js               Self-hosted bundle (gitignored, copied at build time)
  favicon.svg
  img/signe.jpg                  Portrait (from live Wix site)
```

## The Flod Page (root `/`)

### Section sequence

Single scrolling document, two chapters:

```
hero → name-section
  │
  ├─ CHAPTER I · Terapi
  │    manifest → ritual → service-terapi → for-personal
  │
  ├─ CHAPTER II · Konsulentydelser    (warm paper bg takes over from here)
  │    service-intimacy (with embedded quote+testimonial)
  │    → service-elderly → service-teaching → for-work
  │
  └─ bio → contact → foot
```

### Chapter state

`routes/+page.svelte` tracks `chapterMode = $state(0)` continuously:

- Scroll listener measures the `.chapter-konsulent` divider's top position
  relative to `.flod`.
- `chapterMode` lerps smoothly from `0` (Terapi) to `1` (Konsulentydelser)
  as the divider crosses from 75% viewport down to 15%.
- Sets a `--konsulent-y` custom property on `.flod` = the divider's pixel
  offset. `.flod`'s background is a `linear-gradient` with hard-stops at
  `--konsulent-y`, so the warm paper bg appears to scroll up from the
  divider naturally.
- `chapterMode` is passed as a prop to `FlodStage`, which lerps materials,
  colours, and env-map crossfade along the same value.

### Three.js stage

`src/lib/components/FlodStage.svelte` — fixed full-viewport canvas at
`z-index: -1` inside the `.flod { isolation: isolate }` stacking context
(so it paints between `.flod`'s bg gradient and the in-flow sections).

Three active elements:

1. **mainMesh** — displaced `SphereGeometry(1, 128, 96)`,
   `MeshPhysicalMaterial`. Iridescent mercury in Terapi; pure chrome
   (no iridescence, cooler tint) in Konsulentydelser.
2. **fluidGold** — `MarchingCubes(48, goldMat, true, false, 20000)`,
   7 metaballs (one with fall-bias for "drip"). Filament F0 gold
   `rgb(1.0, 0.86, 0.57)` in Terapi; cooler chrome in Konsulentydelser.
   Orbit radius multiplier ramps from `0.7` (merged cluster) to `2.5`
   (dispersed) in a narrow `0.34 → 0.4` scale window — so balls stay
   merged except at the gold's featured anchors.
3. **drip2 (gem)** — low-poly `IcosahedronGeometry(0.26, 0)` with
   `flatShading: true`, faceted. Dark amethyst + pink sheen in Terapi;
   faceted chrome in Konsulentydelser. **Opaque — never transmission > 0.**

### Scroll anchoring — two-layer model

**Layer 1: named pose palette** — `src/lib/stage/poses.ts` exports three
records (`mainPoses`, `goldPoses`, `gemPoses`) mapping pose names to
`{ x, y, scale }` NDC coordinates. Raw numbers live here and here only.
Poses are named by *position* (`heroRight`, `cornerBR`, `topLeftSm`), not
narrative role, so they stay reusable across new sections.

**Layer 2: section registry** — `src/content/da/home.json` lists each
homepage section with an `id` and a `stage: { main, gold, gem, intensity }`
of pose names. Editors (Sveltia) choose from the palette; never type raw
NDC. The `offstage` pose uses `scale: 0.01`, guaranteeing the perf skip.

**Resolution** — `resolveAnchor(section)` in `poses.ts` turns a
`SectionStage` into the runtime shape FlodStage consumes:

```ts
{
  selector: '[data-stage-anchor="<id>"]',
  main:  Pose,   // from mainPoses[section.stage.main]
  drip1: Pose,   // from goldPoses[section.stage.gold]
  drip2: Pose,   // from gemPoses[section.stage.gem]
  intensity: number
}
```

Section roots in `+page.svelte` carry `data-stage-anchor="<id>"` so the
stage queries by stable identity, not positional CSS selectors.

Each frame the stage:
1. Reads each section's visibility ratio (bounding rect overlap with viewport)
2. Cubic-eases weights, blends weighted target for main/drip1/drip2/intensity
3. Double-lerps (`k1 = 0.012, k2 = 0.015`) toward the blended target for
   critically-damped easing
4. Per-element work is skipped when `scale ≤ 0.02` (offscreen-small)

### Pose icons

Each pose has an SVG thumbnail committed under
`static/admin/pose-icons/<element>/<name>.svg`, plus an `_overview.html`
gallery for visual review. The Sveltia pose-picker widget (Phase 2 item)
will render these in a click-grid.

Icons are generated from `poses.ts` by `scripts/gen-pose-icons.ts`.
**Regenerate after every palette edit**:

```sh
pkgx pnpm icons
```

Commit the regenerated SVGs in the same change as the palette edit —
code and CMS assets stay in sync only if the regeneration is disciplined.
The script is run on-demand (not as a prebuild hook) so palette
experimentation during development doesn't thrash committed assets.

### Environment maps — the critical pattern

Four painter functions in `src/lib/three/warmEnv.ts` paint equirectangular
canvases that `PMREMGenerator` converts to cube env maps:

- `createWarmEnvTexture` — pink/cream studio, warm, used by main orb in Terapi
- `createGoldEnvTexture` — dark floor / amber softbox, used by gold in Terapi
- `createGemEnvTexture` — pink bloom, used by gem in Terapi
- `createChromeEnvTexture` — cool blue only (no pink/warm softboxes), used
  by ALL three materials in Konsulentydelser

The chapter crossfade samples BOTH env maps and mixes. Because each material
has its own "therapy" env, they can't share a single `scene.environment` —
each material needs explicit `envMap` and an independent second env to mix
toward.

### The shader patch — essential, do not refactor away

```ts
// Patch envmap_physical_pars_fragment ONCE globally before materials compile
if (!chunkHolder[chunkPatchFlag]) {
  const original = THREE.ShaderChunk.envmap_physical_pars_fragment;
  THREE.ShaderChunk.envmap_physical_pars_fragment = original
    .replace(/.../, `vec4 envMapColor = mix(textureCubeUV(envMap,…), textureCubeUV(uEnvMapB,…), uEnvMix);`)
    .replace(/.../, `…`);
  chunkHolder[chunkPatchFlag] = true;
}
```

Then `enableEnvCrossfade(mat, envB)` attaches `uEnvMapB` + `uEnvMix` uniforms
per material via `onBeforeCompile`.

**Why not just do it in `onBeforeCompile`?** Because `shader.fragmentShader`
at that callback still has `#include <envmap_physical_pars_fragment>`
un-resolved. Regex replaces against the include directive match zero
occurrences. Patching the chunk source globally before any material compiles
is the only working approach. This was learned the hard way — keep the
approach.

### Per-frame chapter blend

The tick runs an `effectiveChapter` that biases toward konsulent while
the user is actively scrolling in Terapi (`scrollActivity` ramp, 90ms window),
so scroll-down gives a "taste" of the next chapter rather than a flat
overlay. Asymmetric lerp: 0.08 climbing, 0.03 returning.

### Perf rules (non-negotiable)

- `renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio))`
- `renderer.compile(scene, camera)` before the first tick — preloads every
  shader variant so there's no first-use compile hitch
- Single `renderer.render(scene, camera)` per frame. No post-processing,
  no bloom, no second pass
- Gem material: **no `transmission`, no `thickness`, no `DoubleSide`.**
  Enabling transmission adds a full scene render pass into a transmission
  target every frame. It compounds brutally with Safari's sticky
  compositing
- Resize handler: **width-only.** iOS Safari fires resize on URL-bar
  show/hide and would otherwise squeeze the viewport mid-scroll
- Skip `displaceMain` / `updateFluidGold` / `positionGem` on any frame
  where the element's `live.scale ≤ 0.02`. Saves significant CPU when only
  one or two of three elements are featured
- Never `backdrop-filter: blur()` on sticky elements. Replace with
  opaque `var(--bone)` fill
- Hardware-accel hints on the canvas element:
  ```css
  transform: translateZ(0); backface-visibility: hidden;
  ```
  to prevent Safari flashing the element bg white during scroll

## Palette Conventions

Defined as scoped custom properties on `.flod`:

```css
--bone:         oklch(0.96 0.009 215)   /* cool paper — Terapi bg */
--bone-warm:    oklch(0.94 0.03 72)     /* warm paper — Konsulent bg */
--bone-2:       oklch(0.93 0.012 210)
--graphite:     oklch(0.17 0.012 240)   /* primary text */
--graphite-soft: 70% mix of graphite + transparent
--tangerine:    oklch(0.94 0.26 120)    /* chartreuse highlighter */
--violet:       oklch(0.36 0.14 150)    /* dark moss green — repurposed name */
--rose-deep:    oklch(0.48 0.14 20)
--mercury:      oklch(0.78 0.015 220)
--rule:         18% mix of graphite + transparent
```

`--violet` is a misnomer kept for diff continuity — it's actually dark moss
green (the purple→green pivot happened mid-design). Don't rename without
updating every reference.

The contact footer uses `oklch(0.48 0.09 152)` (muted sage) as a warm green
companion to the cool bone above.

## Content Model (today → tomorrow)

**Today** — `src/lib/content.ts` exports a frozen `site` object:

```ts
export const site = {
  lang: 'da',
  name, tagline, leadIn,
  contact: { email, phone, address, cvr, hours, responseTime },
  services: [ { slug, number, title, kicker, blurb, bullets, supports?, testimonial? }, … ],
  bio: { heading, pronouns, body: string[] },
  pillQuote,
  nav: [ { label, href }, … ]
} as const;
```

Each section in `routes/+page.svelte` reads a slice and composes its own
layout — services are intentionally NOT rendered by one shared
`<ServiceCard>`: each has a bespoke layout in the Flod editorial rhythm.

**Tomorrow (Phase 2)** — collections under `src/content/{da,en}/`:

```
src/content/
  da/
    site.json               name, tagline, leadIn
    contact.json
    bio.md                  frontmatter + MDX body
    services/
      terapi.md             frontmatter: slug, number, title, kicker, bullets; body: blurb
      intimacy-coordination.md
      aeldrepleje.md
      undervisning.md
    testimonials.json       [{ service, quote, source }]
  en/
    … same structure, English translation
```

Loaded through a typed loader in `src/lib/content/` that reads file imports
(Vite's `import.meta.glob`) at build time. Zero client-side content requests.

Sveltia config: `admin/config.yml` pointing at the same folders, git
backend (GitHub or the self-hosted GitLab instance), DA + EN locale pickers.

## Hard-Won Lessons

- **WebGL canvas ignores `mix-blend-mode`.** Text rendered over the stage
  must use plain colour. Multiple attempts (removing z-index, overflow clip,
  isolation, inline-block) confirmed this — it's a compositing-model limit.
- **Screenshot verification is unreliable** for scroll-driven WebGL state
  changes. Trust the user's eye; don't argue with them about what's
  rendering based on your own screenshot reading.
- **Duotone shader over the canvas** (to tint the whole scene per chapter)
  caused iOS Safari white flash during scroll because transparent pixels
  were getting filled with cream RGB. Dropped it entirely in favour of
  material-level chapter crossfade.
- **Clearcoat over metallic gold** made the gold look like wax. Removed
  clearcoat, used Filament F0, added dark-floor env. The valleys in the
  reflection are what read as "polished metal".
- **Transmission at 0.001** (to "keep the shader path compiled") is never
  worth it — the runtime cost of the transmission pass is enormous compared
  to a one-time compile hitch.
- **`onBeforeCompile` regex on `#include` shader text** matches zero times.
  Patch `THREE.ShaderChunk` instead, once, before materials compile.
- **Orbs lerping from origin on page load** looks janky. Initialise
  `liveMain/liveDrip1/liveDrip2` from the first anchor's values at mount.
- **iOS Safari URL-bar toggles fire `resize`.** Width-only resize gating
  is essential, or the 3D viewport squeezes every time the user scrolls.
- **`backdrop-filter: blur()` on a sticky header** is the single worst
  Safari scroll-perf trap in this codebase. Never re-introduce.

## Code Style

- TypeScript everywhere — `.ts` config files, `lang="ts"` in Svelte
- Tailwind utility classes inline where they make sense; scoped `<style>`
  for page-level specifics until a shared component system emerges
- Design tokens via CSS custom properties (`var(--color-ink)`)
- Comments in code explain **why**, not what. Especially on the shader
  patches, visibility gates, and chapter-lerp logic — these bits look
  strange without context and have genuine reasons

## Conventions

- Use the **Svelte MCP server** (configured in `.mcp.json`):
  `list-sections` → `get-documentation` → `svelte-autofixer` before
  finalising any Svelte code
- Never install binaries globally — always via pkgx (`pkgx pnpm …`,
  `pkgx node …`)
- Record design / architectural decisions in `./docs` (create as needed)
- Don't mention Claude or AI-authored changes in commit messages or UI
  copy unless the user asks — Signe's voice only
- Danish is the primary locale. English translations land in `src/content/en/…`
  in Phase 2; don't invent EN strings ad-hoc in components
