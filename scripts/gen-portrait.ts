/**
 * Build the keyed bio portrait.
 *
 *     pkgx pnpm portrait                    # key the portrait bio.portrait points at
 *     pkgx pnpm portrait --force            # ignore the content-hash gate
 *     pkgx pnpm portrait --source photo.jpg --out-dir /tmp/audit
 *                                           # key any photograph into a folder of its
 *                                           # own, with the cutout drawn over light,
 *                                           # mid and dark grounds, touching nothing here
 *
 * WHAT IT READS. `src/content/bio.da.json` → `portrait`, the photograph the editor
 * picked in the CMS (shared across locales), resolved under `static/`.
 *
 * WHAT IT WRITES. A transparent cutout of the figure as AVIF + WebP `srcset` widths
 * under `static/gen/portrait/`, and `src/lib/portrait-manifest.json`, which
 * `Portrait.svelte` reads. The page paints the cutout over a CSS ground the editor
 * chooses (`bio.portraitGround`), so nothing here knows what it will sit on.
 *
 * THE STEPS.
 *   1. MASTER. A source narrower than `UPSCALE_BELOW` is upscaled first: ESRGAN via
 *      UpscalerJS + `@tensorflow/tfjs-node` where that binding loads (linux/amd64),
 *      a sharp Lanczos resize elsewhere.
 *   2. CUT OUT. `scripts/matte.ts`: a matting network says what is figure, the
 *      known-backing keyer solves the edges, and the wall's cast shadow is kept as a
 *      shadow that falls on whatever ground the page paints.
 *   3. ENCODE at the widths the page asks for.
 *
 * GATED on a content hash of the photograph and of the scripts, so an ordinary build
 * does no image work. The generated files and the manifest are committed; a portrait
 * replaced through the CMS is keyed by the build that change triggers.
 *
 * NOTHING HERE FAILS THE BUILD ON AN EDITOR'S UPLOAD. A backing too uneven to key
 * falls back to the network's matte alone. If the network cannot be loaded, the
 * manifest says so and the page shows the photograph as it is, in the same frame.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { UnkeyableError } from './keyer.ts';
import { cutOut, cutOutByMatte, loadPrior } from './matte.ts';
import type { Cutout, Prior } from './matte.ts';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const BIO = resolve(root, 'src/content/bio.da.json');
const GEN_DIR = resolve(root, 'static/gen/portrait');
const GEN_URL = '/gen/portrait';
const MANIFEST = resolve(root, 'src/lib/portrait-manifest.json');

/** Candidate widths (px); only those ≤ the master width are emitted. */
const TARGET_WIDTHS = [480, 720, 960, 1280, 1600];
/** Sources narrower than this are upscaled to a master before keying. */
const UPSCALE_BELOW = 900;
/** Widest master kept. The page never draws the portrait wider than 800 CSS px. */
const MASTER_MAX = 1600;

export interface PortraitEntry {
  /** Content hash of the photograph and the scripts that keyed it. */
  hash: string;
  /** How the master was made. */
  quality: 'ai' | 'lanczos' | 'source';
  /** Present when the photograph was cut out. `method` says by which route. */
  cutout?: {
    method: Cutout['method'];
    width: number;
    height: number;
    avif: string;
    webp: string;
    fallback: string;
  };
  /** Present when it was not: the reason, for whoever reads the manifest. */
  uncut?: string;
}

const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const opt = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const SOURCE = opt('--source');
const OUT_DIR = opt('--out-dir');
if (!!SOURCE !== !!OUT_DIR) {
  console.error('portrait: --source and --out-dir go together.');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// The upscaler. Optional by construction: tfjs-node has no binding on macOS.
// ---------------------------------------------------------------------------

/** tfjs-node 4.x calls `util.is*` helpers that Node 24 removed. */
function restoreLegacyUtil() {
  const u = require('node:util') as Record<string, unknown>;
  const shim: Record<string, (v: unknown) => boolean> = {
    isArray: Array.isArray,
    isBoolean: (v) => typeof v === 'boolean',
    isBuffer: (v) => Buffer.isBuffer(v),
    isDate: (v) => v instanceof Date,
    isError: (v) => v instanceof Error,
    isFunction: (v) => typeof v === 'function',
    isNull: (v) => v === null,
    isNullOrUndefined: (v) => v == null,
    isNumber: (v) => typeof v === 'number',
    isObject: (v) => v !== null && typeof v === 'object',
    isPrimitive: (v) => v === null || (typeof v !== 'object' && typeof v !== 'function'),
    isRegExp: (v) => v instanceof RegExp,
    isString: (v) => typeof v === 'string',
    isSymbol: (v) => typeof v === 'symbol',
    isUndefined: (v) => v === undefined
  };
  for (const [k, fn] of Object.entries(shim)) if (typeof u[k] !== 'function') u[k] = fn;
}

type Upscale = (png: Buffer) => Promise<Buffer>;

function loadAiUpscaler(): Upscale | null {
  try {
    restoreLegacyUtil();
    const tf = require('@tensorflow/tfjs-node');
    const Upscaler = require('upscaler/node');
    const m = require('@upscalerjs/esrgan-thick/4x');
    const upscaler = new Upscaler({ model: m.default ?? m });
    return async (png) => {
      const image = tf.node.decodeImage(png, 3);
      // Patches keep peak memory flat; the padding hides the seams between them.
      const out = await upscaler.upscale(image, { patchSize: 128, padding: 8 });
      const encoded = Buffer.from(await tf.node.encodePng(out));
      image.dispose();
      out.dispose();
      return encoded;
    };
  } catch {
    return null;
  }
}

async function makeMaster(
  srcPath: string,
  ai: Upscale | null
): Promise<{ png: Buffer; quality: PortraitEntry['quality'] }> {
  const upright = await sharp(srcPath).rotate().png().toBuffer();
  const { width = 0 } = await sharp(upright).metadata();
  if (width >= UPSCALE_BELOW) {
    const png = await sharp(upright)
      .resize({ width: Math.min(width, MASTER_MAX), kernel: 'lanczos3' })
      .png()
      .toBuffer();
    return { png, quality: 'source' };
  }
  if (ai) {
    try {
      const big = await ai(upright);
      const png = await sharp(big)
        .resize({ width: MASTER_MAX, kernel: 'lanczos3', withoutEnlargement: true })
        .png()
        .toBuffer();
      return { png, quality: 'ai' };
    } catch (e) {
      console.warn(
        `portrait: AI upscale failed (${(e as Error).message.split('\n')[0]}); Lanczos instead`
      );
    }
  }
  const png = await sharp(upright)
    .resize({ width: Math.min(width * 2, MASTER_MAX), kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6 })
    .png()
    .toBuffer();
  return { png, quality: 'lanczos' };
}

// ---------------------------------------------------------------------------
// Cut out, by the best route this photograph allows.
// ---------------------------------------------------------------------------

async function cut(masterPng: Buffer, prior: Prior): Promise<Cutout> {
  const { data, info } = await sharp(masterPng)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgb = new Uint8Array(data.buffer, data.byteOffset, data.length);
  const matte = await prior(rgb, info.width, info.height);
  try {
    return cutOut(rgb, info.width, info.height, matte);
  } catch (e) {
    if (!(e instanceof UnkeyableError)) throw e;
    console.warn(
      `portrait: the backing cannot be keyed (${e.message.split('. ')[0]}). Using the matte alone.`
    );
    return cutOutByMatte(rgb, info.width, info.height, matte);
  }
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const describe = (c: Cutout, quality: string) =>
  `${quality} master ${c.width}×${c.height}, ${c.method}: figure ${pct(c.figure)} of the frame, shadow ${pct(c.shadow)}`;

/** The cutout over flat test grounds, for a person to look at. */
async function drawOver(c: Cutout, dir: string) {
  const layer = await sharp(c.rgba, { raw: { width: c.width, height: c.height, channels: 4 } })
    .png()
    .toBuffer();
  await sharp(layer).toFile(resolve(dir, 'cutout.png'));
  const grounds: Record<string, [string, string]> = {
    light: ['#dfe6ee', '#eef5b0'],
    mid: ['#d98a7a', '#e9c9a4'],
    dark: ['#16243d', '#2f5a45']
  };
  for (const [name, [from, to]] of Object.entries(grounds)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
    await sharp(Buffer.from(svg))
      .composite([{ input: layer }])
      .png()
      .toFile(resolve(dir, `on-${name}.png`));
  }
}

// ---------------------------------------------------------------------------
// Audit run: any photograph, into a folder of its own.
// ---------------------------------------------------------------------------

if (SOURCE && OUT_DIR) {
  mkdirSync(OUT_DIR, { recursive: true });
  const master = await makeMaster(resolve(SOURCE), loadAiUpscaler());
  const c = await cut(master.png, await loadPrior());
  await drawOver(c, OUT_DIR);
  console.log(
    `portrait: ${SOURCE}\n          ${describe(c, master.quality)}\n          written to ${OUT_DIR}`
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------

const bio = JSON.parse(readFileSync(BIO, 'utf8')) as { portrait?: string };
const src = bio.portrait;
const manifest: Record<string, PortraitEntry> = {};
const previous: Record<string, PortraitEntry> = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
  : {};

const write = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

if (!src) {
  write();
  console.log('portrait: bio.portrait is empty, nothing to key.');
  process.exit(0);
}
const srcPath = resolve(root, 'static', src.replace(/^\//, ''));
if (!existsSync(srcPath)) {
  write();
  console.warn(`portrait: ${src} is not under static/, nothing to key.`);
  process.exit(0);
}

const hash = createHash('sha256')
  .update(readFileSync(srcPath))
  .update(readFileSync(resolve(here, 'keyer.ts')))
  .update(readFileSync(resolve(here, 'matte.ts')))
  .update(readFileSync(resolve(here, 'gen-portrait.ts')))
  .digest('hex')
  .slice(0, 12);

const filesExist = (e: PortraitEntry) =>
  !e.cutout ||
  [...e.cutout.avif.split(', '), ...e.cutout.webp.split(', ')]
    .map((s) => s.split(' ')[0])
    .concat(e.cutout.fallback)
    .every((url) => existsSync(resolve(root, 'static', url.replace(/^\//, ''))));

const ai = loadAiUpscaler();
const before = previous[src];
// A Lanczos master is redone on the first machine that can do better.
const upgradable = before?.quality === 'lanczos' && !!ai;
if (!FORCE && before && before.hash === hash && filesExist(before) && !upgradable) {
  manifest[src] = before;
  write();
  console.log(`portrait: ${src} unchanged.`);
  process.exit(0);
}

console.log(`portrait: cutting out ${src} (${ai ? 'ESRGAN 4×' : 'Lanczos'} upscaler)`);
const master = await makeMaster(srcPath, ai);

rmSync(GEN_DIR, { recursive: true, force: true });
mkdirSync(GEN_DIR, { recursive: true });

let prior: Prior;
try {
  prior = await loadPrior();
} catch (e) {
  const why = (e as Error).message.split('\n')[0];
  manifest[src] = {
    hash,
    quality: master.quality,
    uncut: `The matting network could not be loaded: ${why}`
  };
  write();
  console.warn(
    `portrait: the matting network could not be loaded, so ${src} is shown as it is.\n          ${why}`
  );
  process.exit(0);
}
const c = await cut(master.png, prior);

const base = sharp(c.rgba, { raw: { width: c.width, height: c.height, channels: 4 } });
const widths = [...new Set([...TARGET_WIDTHS.filter((w) => w <= c.width), c.width])].sort(
  (a, b) => a - b
);
const name = `portrait-${hash}`;
for (const w of widths) {
  const sized = base.clone().resize({ width: w, kernel: 'lanczos3' });
  await sized
    .clone()
    .avif({ quality: 62, effort: 5 })
    .toFile(resolve(GEN_DIR, `${name}-${w}.avif`));
  await sized
    .clone()
    .webp({ quality: 86, alphaQuality: 100, effort: 5 })
    .toFile(resolve(GEN_DIR, `${name}-${w}.webp`));
}
const maxW = widths[widths.length - 1];
manifest[src] = {
  hash,
  quality: master.quality,
  cutout: {
    method: c.method,
    width: maxW,
    height: Math.round((maxW * c.height) / c.width),
    avif: widths.map((w) => `${GEN_URL}/${name}-${w}.avif ${w}w`).join(', '),
    webp: widths.map((w) => `${GEN_URL}/${name}-${w}.webp ${w}w`).join(', '),
    fallback: `${GEN_URL}/${name}-${widths[Math.min(1, widths.length - 1)]}.webp`
  }
};
write();

console.log(`portrait: ${describe(c, master.quality)} → ${widths.length} widths`);
