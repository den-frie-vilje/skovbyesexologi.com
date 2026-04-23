/**
 * Pose icon generator.
 *
 * Reads the pose palette from `src/lib/stage/poses.ts` and emits a tiny SVG
 * thumbnail for each entry under `static/admin/pose-icons/<element>/<name>.svg`,
 * plus an `_overview.html` gallery that lays out all three palettes in a grid.
 *
 * Run manually after editing `poses.ts`:
 *
 *     pkgx pnpm icons
 *
 * Commit the regenerated SVGs alongside the palette change so the Sveltia
 * picker stays in sync with the code. This is on-demand by design — we do
 * NOT wire it into prebuild, so palette experimentation during development
 * doesn't thrash the committed assets.
 *
 * Runs natively on Node >= 23 (type stripping is built-in); no tsx or
 * ts-node needed.
 */

import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bubblePoses, dropsPoses, gemPoses, type Pose } from '../src/lib/stage/poses.ts';

// ---- layout ----

const SVG_W = 80;
const SVG_H = 50;
const PAD = 0.5;

// Text column reference — shows where prose would flow on the page.
// Editors glance at the dot's position relative to this column.
const COL = { x: 28, y: 12, w: 24, h: 26 };

// ---- palette colours ----

const colors = {
  bg:       '#f3ede2', // paper
  bgStroke: '#d0cab8',
  col:      '#e4dec9', // text column hint
  label:    '#766e5a',
  bubble:        { fill: '#c5c9d0', stroke: '#8f949d' },
  bubbleEdge:    '#8f949d',
  drops:         { fill: '#e0b359', stroke: '#a8842c' },
  gem:           { fill: '#7a5a8e', stroke: '#4d3659' }
};

// ---- coordinate helpers ----

// NDC (+y up, -1..1) → SVG (+y down, 0..SVG_*)
function ndcToSvg(x: number, y: number): { px: number; py: number } {
  return {
    px: ((x + 1) / 2) * SVG_W,
    py: ((1 - y) / 2) * SVG_H
  };
}

// Calibration: scale=1.0 element renders at ~22% of viewport width —
// close enough to the perceived size of the mercury orb at scale 1 on
// the live site that editors can read relative sizes at a glance.
// Offstage poses (scale=0.01) render invisibly small (or are fully clipped
// because the center is outside the viewport rect). That's exactly the
// visual meaning we want to convey.
function scaleToRadius(s: number): number {
  return 0.22 * (SVG_W / 2) * s;
}

const n = (v: number) => v.toFixed(2);

// ---- shape renderers ----

function baseBg(): string {
  return (
    `<rect x="${PAD}" y="${PAD}" width="${SVG_W - 2 * PAD}" height="${SVG_H - 2 * PAD}" ` +
    `fill="${colors.bg}" stroke="${colors.bgStroke}" stroke-width="0.5" rx="2"/>` +
    `<rect x="${COL.x}" y="${COL.y}" width="${COL.w}" height="${COL.h}" ` +
    `fill="${colors.col}" rx="1"/>`
  );
}

function renderBubble(pose: Pose): string {
  const { px, py } = ndcToSvg(pose.x, pose.y);
  const r = scaleToRadius(pose.scale);
  return (
    `<circle cx="${n(px)}" cy="${n(py)}" r="${n(r)}" ` +
    `fill="${colors.bubble.fill}" stroke="${colors.bubble.stroke}" stroke-width="0.5"/>`
  );
}

// Cluster of three offset circles — hints at the MarchingCubes metaballs.
function renderDrops(pose: Pose): string {
  const { px, py } = ndcToSvg(pose.x, pose.y);
  const r = scaleToRadius(pose.scale);
  const d = r * 0.45;
  const c = (cx: number, cy: number, cr: number) =>
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(cr)}"/>`;
  return (
    `<g fill="${colors.drops.fill}" stroke="${colors.drops.stroke}" stroke-width="0.4">` +
    c(px - d, py + d * 0.3, r * 0.7) +
    c(px + d * 0.5, py - d * 0.4, r * 0.8) +
    c(px + d * 0.2, py + d * 0.6, r * 0.6) +
    `</g>`
  );
}

// Diamond for the faceted icosahedral gem.
function renderGem(pose: Pose): string {
  const { px, py } = ndcToSvg(pose.x, pose.y);
  const r = scaleToRadius(pose.scale);
  const pts = [
    [px, py - r],
    [px + r, py],
    [px, py + r],
    [px - r, py]
  ]
    .map(([x, y]) => `${n(x)},${n(y)}`)
    .join(' ');
  return (
    `<polygon points="${pts}" ` +
    `fill="${colors.gem.fill}" stroke="${colors.gem.stroke}" stroke-width="0.5"/>`
  );
}

type Element = 'bubble' | 'drops' | 'gem';

const renderers: Record<Element, (p: Pose) => string> = {
  bubble: renderBubble,
  drops: renderDrops,
  gem: renderGem
};

function buildSvg(element: Element, name: string, pose: Pose): string {
  // ClipPath mirrors the viewport rect so elements that straddle or sit
  // fully outside the edge are visually cropped — same behaviour as the
  // live WebGL stage. SVGs are label-less: the consuming UI (Sveltia
  // picker, overview.html) adds its own caption chrome.
  const clipId = `vp-${element}-${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_W} ${SVG_H}" ` +
    `width="${SVG_W}" height="${SVG_H}">` +
    `<defs><clipPath id="${clipId}">` +
    `<rect x="${PAD}" y="${PAD}" width="${SVG_W - 2 * PAD}" height="${SVG_H - 2 * PAD}" rx="2"/>` +
    `</clipPath></defs>` +
    baseBg() +
    `<g clip-path="url(#${clipId})">${renderers[element](pose)}</g>` +
    `</svg>\n`
  );
}

// ---- filesystem output ----

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const outRoot = resolve(rootDir, 'static', 'admin', 'pose-icons');

type Palette = { element: Element; poses: Record<string, Pose>; title: string };
const palettes: Palette[] = [
  { element: 'bubble', poses: bubblePoses, title: 'Bubble (mercury orb)' },
  { element: 'drops',  poses: dropsPoses,  title: 'Drops (gold metaballs)' },
  { element: 'gem',    poses: gemPoses,    title: 'Gem (faceted icosahedron)' }
];

// Nuke and recreate the output tree so deleted poses don't leave stale
// files on disk.
rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

for (const { element, poses } of palettes) {
  const dir = resolve(outRoot, element);
  mkdirSync(dir, { recursive: true });
  for (const [name, pose] of Object.entries(poses)) {
    writeFileSync(resolve(dir, `${name}.svg`), buildSvg(element, name, pose));
  }
}

// ---- overview HTML ----

function buildOverview(): string {
  const sections = palettes
    .map(({ element, poses, title }) => {
      const cells = Object.entries(poses)
        .map(
          ([name]) =>
            `  <figure class="cell"><img src="${element}/${name}.svg" alt="${name}"><figcaption>${name}</figcaption></figure>`
        )
        .join('\n');
      return `<section>
  <h2>${title} — ${Object.keys(poses).length} poses</h2>
  <div class="grid">
${cells}
  </div>
</section>`;
    })
    .join('\n\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Stage pose palette — overview</title>
<style>
  :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
  body { margin: 2rem; background: #fafaf5; color: #2c2a22; max-width: 1100px; }
  h1 { font-weight: 500; font-size: 1.4rem; margin: 0 0 0.4rem; }
  .lede { color: #776f5c; margin: 0 0 2rem; font-size: 0.9rem; line-height: 1.55; max-width: 48rem; }
  h2 { font-weight: 500; font-size: 1rem; margin: 2.2rem 0 0.8rem; color: #4a4638; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.8rem; }
  .cell { margin: 0; }
  .cell img { display: block; width: 100%; height: auto; border-radius: 4px; }
  .cell figcaption { font-family: ui-monospace, monospace; font-size: 0.7rem; color: #675f4c; text-align: center; margin-top: 0.25rem; }
  code { font-family: ui-monospace, monospace; background: #efe9d6; padding: 0.1em 0.35em; border-radius: 3px; font-size: 0.88em; }
</style>
</head>
<body>
<h1>Stage pose palette</h1>
<p class="lede">
  Generated from <code>src/lib/stage/poses.ts</code>. Regenerate with
  <code>pkgx pnpm icons</code> after editing the palette. Each thumbnail
  shows the approximate position and size of the WebGL element within
  the viewport; the pale column is a text-column hint for eye-anchoring.
</p>

${sections}

</body>
</html>
`;
}

writeFileSync(resolve(outRoot, '_overview.html'), buildOverview());

// ---- report ----

const counts = palettes.map((p) => `${p.element}: ${Object.keys(p.poses).length}`).join(' · ');
console.log(`pose icons generated → static/admin/pose-icons/  (${counts})`);
console.log(`overview → static/admin/pose-icons/_overview.html`);
