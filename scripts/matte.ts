/**
 * A portrait cutout that is right on any ground, from a photograph against a wall.
 *
 * Two instruments, each used for what it can measure.
 *
 * A MATTING NETWORK (BEN2, MIT licence, run locally through ONNX Runtime) answers the
 * question no colour measurement can: which pixels are the person. A cast shadow on
 * the wall, the wall seen between an arm and the body, a white shirt, a fingernail the
 * colour of the backdrop: all of these are ambiguous in colour and obvious in meaning.
 *
 * A KNOWN-BACKING KEYER (`keyer.ts`) answers what a network at 1024 px cannot: the
 * exact coverage and the figure's own colour through a soft edge, solved against the
 * measured backing (Smith & Blinn 1996). Hair over an even wall is where that
 * arithmetic beats a learned matte.
 *
 * They are fused through a CLEAN PLATE: the wall as it would look with the person
 * taken away, shadow and all. Where the network is sure there is only wall, the plate
 * is the photograph. Behind and around the figure it is that same shadow carried
 * inward, because a cast shadow is smooth and the figure's edge is not. Then:
 *
 *   FIGURE  where the wall is evenly lit, the keyer's own coverage and colour,
 *           untouched. Where a shadow lies behind the edge, coverage is solved again
 *           against the shadowed plate, so the shadow is not mistaken for figure.
 *   SHADOW  the plate's darkening, as the least coverage that explains it, tinted by
 *           whatever the wall lost. Over white it reproduces the photograph; over any
 *           other ground it darkens and tints that ground the way the wall was.
 *
 * One image carries both, figure over shadow, so the page needs a single layer.
 *
 * Where the backing is too uneven to key, `cutOutByMatte` falls back to the network's
 * matte alone, with the foreground colour estimated by blur fusion (Forte & Pitié,
 * "Approximate Fast Foreground Colour Estimation", ICIP 2021).
 *
 * No I/O beyond the model download and no policy. The caller reads the photograph,
 * decides what to write and what to do when a step refuses.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gauss, key, maxFilter } from './keyer.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The network, pinned to a revision so a build is reproducible. fp16 weights, 219 MB,
 * fetched once into `node_modules/.cache`. Measured on 2 vCPU: 24 s and 2.9 GB peak,
 * inside what a standard GitHub-hosted runner offers.
 */
export const PRIOR_MODEL = {
  id: 'onnx-community/BEN2-ONNX',
  revision: 'c552aa82688edce09f0ac9d2e31ad53d9d629010',
  dtype: 'fp16'
} as const;

export const FUSION = {
  /**
   * A pixel is backing-like when it kept at least this much of the backing's level
   * (a ramp) and its colour is no further than `chroma` from a pure darkening of the
   * backing. sRGB levels throughout: that is the space a browser composites in.
   */
  keptLo: 0.15,
  keptHi: 0.22,
  /** A shadow beside hair and skin carries their bounce, so not zero; skin starts near 0.2. */
  chromaLo: 0.13,
  chromaHi: 0.19,
  /** Confidence above which, this far inside the figure, the photograph is simply kept. */
  core: 0.98,
  /** That distance, as a fraction of frame width. */
  coreInset: 1 / 250,
  /**
   * How far from anything the network finds figure-like a pixel must be before it is
   * taken as plain wall, as a fraction of frame width. Wide enough to hold a stray
   * strand of hair the network missed, so the keyer still gets to solve it.
   */
  halo: 1 / 120,
  /** Network confidence below which a pixel, that far out, is wall. */
  wall: 0.05,
  /** An enclosed patch of backing is wall when the network's mean confidence over it is below this. */
  patch: 0.7,
  /** Shadow depth (0 = none, 1 = black) over which the figure is re-solved against the plate. */
  shadedLo: 0.02,
  shadedHi: 0.08,
  /** Darkening below this is the backing's own grain and is not drawn. */
  floor: 0.03
};

export interface Cutout {
  /** Straight-alpha RGBA, `width * height * 4`. */
  rgba: Buffer;
  width: number;
  height: number;
  /** How the cutout was made: fused with the keyer, or from the network's matte alone. */
  method: 'fused' | 'matte';
  /** Fractions of the frame, for the log line. */
  figure: number;
  shadow: number;
}

/** A function from an RGB frame to the network's confidence that each pixel is figure, 0-1. */
export type Prior = (rgb: Uint8Array, w: number, h: number) => Promise<Float32Array>;

interface SegmenterOutput {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
}

/** Load the network. Rejects when the package or the weights cannot be had. */
export async function loadPrior(): Promise<Prior> {
  const { pipeline, RawImage, env } = await import('@huggingface/transformers');
  env.cacheDir = resolve(root, 'node_modules/.cache/matte-models');
  const segment = await pipeline('background-removal', PRIOR_MODEL.id, {
    revision: PRIOR_MODEL.revision,
    dtype: PRIOR_MODEL.dtype
  });
  return async (rgb, w, h) => {
    const result = (await segment(new RawImage(Uint8ClampedArray.from(rgb), w, h, 3))) as unknown;
    const out = (Array.isArray(result) ? result[0] : result) as SegmenterOutput;
    if (out.width !== w || out.height !== h) {
      throw new Error(`matte: the network returned ${out.width}×${out.height} for a ${w}×${h} frame`);
    }
    const matte = new Float32Array(w * h);
    const step = out.channels;
    for (let i = 0; i < w * h; i++) matte[i] = out.data[i * step + step - 1] / 255;
    return matte;
  };
}

const smoothstep = (lo: number, hi: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

/** Where the network is sure, and far enough inside the figure for that to be safe. */
function coreOf(matte: Float32Array, w: number, h: number): Uint8Array {
  const n = w * h;
  const doubt = Float32Array.from(matte, (m) => 1 - m);
  const spread = new Float32Array(n);
  maxFilter(doubt, spread, new Float32Array(n), w, h, Math.max(1, Math.round(w * FUSION.coreInset)));
  const core = new Uint8Array(n);
  for (let i = 0; i < n; i++) core[i] = spread[i] <= 1 - FUSION.core ? 1 : 0;
  return core;
}

/** Label 4-connected regions of `mask`. Iterative: a frame-sized recursion overflows. */
function label(mask: Uint8Array, w: number, h: number): { labels: Int32Array; count: number } {
  const labels = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let count = 0;
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || labels[start]) continue;
    const id = ++count;
    let top = 0;
    stack[top++] = start;
    labels[start] = id;
    while (top) {
      const i = stack[--top];
      const x = i % w;
      const visit = (j: number) => {
        if (mask[j] && !labels[j]) {
          labels[j] = id;
          stack[top++] = j;
        }
      };
      if (x > 0) visit(i - 1);
      if (x < w - 1) visit(i + 1);
      if (i >= w) visit(i - w);
      if (i < w * (h - 1)) visit(i + w);
    }
  }
  return { labels, count };
}

/**
 * Carry `values` (one plane per channel, valid where `known`) into the rest of the
 * frame: a normalised blur at widening radii, each pixel taking the narrowest radius
 * that reaches something known. Smooth by construction, which is what a shadow is.
 */
function carryInward(values: Float32Array[], known: Uint8Array, w: number, h: number): Float32Array[] {
  const n = w * h;
  const out = values.map((v) => Float32Array.from(v));
  const filled = Uint8Array.from(known);
  for (const sigma of [w / 240, w / 90, w / 35, w / 12, w / 4]) {
    const weight = gauss(Float32Array.from(known), w, h, sigma);
    const blurred = values.map((v) => {
      const masked = new Float32Array(n);
      for (let i = 0; i < n; i++) masked[i] = known[i] ? v[i] : 0;
      return gauss(masked, w, h, sigma);
    });
    for (let i = 0; i < n; i++) {
      if (filled[i] || weight[i] < 0.02) continue;
      for (let c = 0; c < values.length; c++) out[c][i] = blurred[c][i] / weight[i];
      filled[i] = 1;
    }
  }
  return out;
}

/**
 * The fused cutout. Throws `UnkeyableError` (from `keyer.ts`) when the backing is too
 * uneven to solve against; `cutOutByMatte` is the answer to that.
 */
export function cutOut(rgb: Uint8Array, w: number, h: number, matte: Float32Array): Cutout {
  const keyed = key(rgb, w, h);
  const n = w * h;
  const planes = keyed.backing.plane;
  const core = coreOf(matte, w, h);

  // Each pixel as a fraction of the backing's own level, per channel, and from that
  // how plausibly it is nothing but darkened backing.
  const backing = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const ratio = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const backingLike = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const yn = (y / (h - 1)) * 2 - 1;
    for (let x = 0; x < w; x++) {
      const xn = (x / (w - 1)) * 2 - 1;
      const i = y * w + x;
      let lo = 1;
      let hi = 0;
      let sum = 0;
      for (let c = 0; c < 3; c++) {
        const b = Math.max(1, planes[c].c + planes[c].gx * xn + planes[c].gy * yn);
        const r = Math.min(1, rgb[i * 3 + c] / b);
        backing[c][i] = b;
        ratio[c][i] = r;
        sum += r;
        if (r < lo) lo = r;
        if (r > hi) hi = r;
      }
      backingLike[i] =
        smoothstep(FUSION.keptLo, FUSION.keptHi, sum / 3) * (1 - smoothstep(FUSION.chromaLo, FUSION.chromaHi, hi - lo));
    }
  }

  // WALL, by the network: nothing figure-like within the halo.
  const near = new Float32Array(n);
  maxFilter(matte, near, new Float32Array(n), w, h, Math.max(1, Math.round(w * FUSION.halo)));
  const wall = new Uint8Array(n);
  for (let i = 0; i < n; i++) wall[i] = near[i] < FUSION.wall ? 1 : 0;

  // And a patch of backing the figure fully encloses (wall between an arm and the
  // body, or a white shirt under a jacket). It is one thing, so the network is asked
  // about it as one thing: its confidence is averaged over the patch. Pixel by pixel
  // it wavers, and a wavering answer leaves the wall half in the figure.
  const patch = new Uint8Array(n);
  for (let i = 0; i < n; i++) patch[i] = backingLike[i] > 0.5 && !core[i] ? 1 : 0;
  const patches = label(patch, w, h);
  const sum = new Float64Array(patches.count + 1);
  const size = new Int32Array(patches.count + 1);
  const open = new Uint8Array(patches.count + 1);
  for (let i = 0; i < n; i++) {
    const id = patches.labels[i];
    if (!id) continue;
    sum[id] += matte[i];
    size[id]++;
    const x = i % w;
    if (x === 0 || x === w - 1 || i < w || i >= n - w) open[id] = 1;
  }
  const enclosedWall = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const id = patches.labels[i];
    if (id && !open[id] && sum[id] / size[id] < FUSION.patch) enclosedWall[i] = wall[i] = 1;
  }

  // THE CLEAN PLATE, as a fraction of the even backing: the photograph where there is
  // only wall, carried inward everywhere else.
  const plate = carryInward(ratio, wall, w, h);

  // The figure's own colour near its edge, for re-solving coverage over shadow.
  const sure = new Uint8Array(n);
  for (let i = 0; i < n; i++) sure[i] = matte[i] > 0.9 && keyed.alpha[i] === 255 && !wall[i] ? 1 : 0;
  const source = [0, 1, 2].map((c) => Float32Array.from({ length: n }, (_, i) => rgb[i * 3 + c]));
  const own = carryInward(source, sure, w, h);

  const rgba = Buffer.alloc(n * 4);
  let figure = 0;
  let shadow = 0;
  for (let i = 0; i < n; i++) {
    const s0 = plate[0][i];
    const s1 = plate[1][i];
    const s2 = plate[2][i];
    const least = Math.min(s0, s1, s2);

    // FIGURE.
    let af: number;
    let fr: number;
    let fg: number;
    let fb: number;
    if (core[i]) {
      af = 1;
      fr = rgb[i * 3];
      fg = rgb[i * 3 + 1];
      fb = rgb[i * 3 + 2];
    } else if (wall[i]) {
      af = 0;
      fr = fg = fb = 0;
    } else {
      af = keyed.alpha[i] / 255;
      fr = keyed.rgb[i * 3];
      fg = keyed.rgb[i * 3 + 1];
      fb = keyed.rgb[i * 3 + 2];
      const shaded = smoothstep(FUSION.shadedLo, FUSION.shadedHi, 1 - least);
      if (shaded > 0) {
        // Coverage against the shadowed plate: project the pixel onto the line from
        // the plate to the figure's own colour (Smith & Blinn's known-backing solve).
        const p0 = s0 * backing[0][i];
        const p1 = s1 * backing[1][i];
        const p2 = s2 * backing[2][i];
        const d0 = own[0][i] - p0;
        const d1 = own[1][i] - p1;
        const d2 = own[2][i] - p2;
        const span = d0 * d0 + d1 * d1 + d2 * d2;
        if (span > 36) {
          const along = ((rgb[i * 3] - p0) * d0 + (rgb[i * 3 + 1] - p1) * d1 + (rgb[i * 3 + 2] - p2) * d2) / span;
          const solved = Math.min(1, Math.max(0, along));
          af = (1 - shaded) * af + shaded * solved;
          fr = (1 - shaded) * fr + shaded * own[0][i];
          fg = (1 - shaded) * fg + shaded * own[1][i];
          fb = (1 - shaded) * fb + shaded * own[2][i];
        }
      }
    }

    // SHADOW: least coverage that explains the plate, tinted by what the wall lost.
    const as = Math.max(0, 1 - least - FUSION.floor) / (1 - FUSION.floor);
    const tint = (s: number) => (least < 1 ? ((s - least) / (1 - least)) * 255 : 0);

    const under = (1 - af) * as;
    const a = af + under;
    if (a <= 1 / 510) continue;
    rgba[i * 4] = Math.round((af * fr + under * tint(s0)) / a);
    rgba[i * 4 + 1] = Math.round((af * fg + under * tint(s1)) / a);
    rgba[i * 4 + 2] = Math.round((af * fb + under * tint(s2)) / a);
    rgba[i * 4 + 3] = Math.round(a * 255);
    figure += af;
    shadow += under;
  }
  return { rgba, width: w, height: h, method: 'fused', figure: figure / n, shadow: shadow / n };
}

/**
 * The cutout from the network's matte alone, for a backing the keyer refuses. No
 * shadow survives, because without a known backing there is nothing to measure one
 * against. The foreground colour is estimated by one round of blur fusion, which
 * takes the backing's colour back out of the soft edge.
 */
export function cutOutByMatte(rgb: Uint8Array, w: number, h: number, matte: Float32Array): Cutout {
  const n = w * h;
  const sigma = Math.max(2, w / 90);
  const inv = Float32Array.from(matte, (m) => 1 - m);
  const aBlur = gauss(Float32Array.from(matte), w, h, sigma);
  const iBlur = gauss(Float32Array.from(inv), w, h, sigma);
  const rgba = Buffer.alloc(n * 4);
  let figure = 0;
  for (let c = 0; c < 3; c++) {
    const fg = new Float32Array(n);
    const bg = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      fg[i] = rgb[i * 3 + c] * matte[i];
      bg[i] = rgb[i * 3 + c] * inv[i];
    }
    gauss(fg, w, h, sigma);
    gauss(bg, w, h, sigma);
    for (let i = 0; i < n; i++) {
      const a = matte[i];
      const f = fg[i] / Math.max(1e-4, aBlur[i]);
      const b = bg[i] / Math.max(1e-4, iBlur[i]);
      const solved = f + a * (rgb[i * 3 + c] - a * f - (1 - a) * b);
      rgba[i * 4 + c] = Math.round(Math.min(255, Math.max(0, solved)));
    }
  }
  for (let i = 0; i < n; i++) {
    rgba[i * 4 + 3] = Math.round(matte[i] * 255);
    figure += matte[i];
  }
  return { rgba, width: w, height: h, method: 'matte', figure: figure / n, shadow: 0 };
}
