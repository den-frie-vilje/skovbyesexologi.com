<!--
  The bio portrait: a cutout of the figure over a CSS ground.

  The cutout comes from `scripts/gen-portrait.ts` by way of
  `portrait-manifest.json`. It is transparent, with the wall's cast shadow
  kept as shadow, so the ground below is plain CSS and can be anything:
  the editor picks one of `GROUNDS` in the CMS (`bio.portraitGround`).

  A portrait with no cutout in the manifest (a new upload before its build,
  or a photograph that could not be cut out) is shown as it is, filling the
  same frame, so the layout never depends on the pipeline.

  The frame fills its parent's width. Its shape is the parent's call:
  `--portrait-ratio` (default 6 / 7), or `fill` to take the parent's height.
-->
<script lang="ts" module>
  /** The grounds an editor can choose. Keep in step with `portraitGround` in `static/admin/config.yml`. */
  export const GROUNDS = ['white', 'warm', 'chartreuse', 'cool'] as const;
  export type PortraitGround = (typeof GROUNDS)[number];
</script>

<script lang="ts">
  import manifestData from '$lib/portrait-manifest.json';

  interface CutoutEntry {
    width: number;
    height: number;
    avif: string;
    webp: string;
    fallback: string;
  }
  const manifest = manifestData as Record<string, { cutout?: CutoutEntry }>;

  interface Props {
    src: string;
    alt: string;
    ground?: string;
    /** `sizes` hint so the browser picks the right width. */
    sizes?: string;
    loading?: 'lazy' | 'eager';
    /** Take the parent's height instead of keeping `--portrait-ratio`. */
    fill?: boolean;
  }
  let { src, alt, ground = 'white', sizes = '100vw', loading = 'lazy', fill = false }: Props = $props();

  const cutout = $derived(manifest[src]?.cutout);
  const groundName = $derived((GROUNDS as readonly string[]).includes(ground) ? ground : 'white');
</script>

<div class="portrait" class:fill data-ground={groundName}>
  {#if cutout}
    <picture>
      <source type="image/avif" srcset={cutout.avif} {sizes} />
      <source type="image/webp" srcset={cutout.webp} {sizes} />
      <img src={cutout.fallback} {alt} width={cutout.width} height={cutout.height} {loading} decoding="async" />
    </picture>
  {:else}
    <img {src} {alt} {loading} decoding="async" />
  {/if}
</div>

<style>
  .portrait {
    position: relative;
    overflow: hidden;
    width: 100%;
    aspect-ratio: var(--portrait-ratio, 6 / 7);
    background: var(--ground);
    --ground: #fff;
  }
  .portrait.fill {
    aspect-ratio: auto;
    height: 100%;
  }
  /*
    The grounds. Each is a wash across the frame with a pool of light behind
    the head, so the figure reads as standing in front of a lit wall.
    Light grounds only: the jacket is near black and needs something to
    stand against.
  */
  .portrait[data-ground='warm'] {
    --ground:
      radial-gradient(ellipse 70% 55% at 50% 26%, oklch(0.98 0.02 80 / 0.85), transparent 70%),
      linear-gradient(168deg, oklch(0.93 0.035 72) 0%, oklch(0.84 0.075 32) 100%);
  }
  .portrait[data-ground='chartreuse'] {
    --ground:
      radial-gradient(ellipse 70% 55% at 50% 26%, oklch(0.985 0.012 150 / 0.9), transparent 70%),
      linear-gradient(172deg, oklch(0.95 0.012 215) 0%, oklch(0.93 0.2 120) 100%);
  }
  .portrait[data-ground='cool'] {
    --ground:
      radial-gradient(ellipse 70% 55% at 50% 26%, oklch(0.985 0.008 230 / 0.9), transparent 70%),
      linear-gradient(165deg, oklch(0.93 0.018 220) 0%, oklch(0.8 0.055 255) 100%);
  }
  .portrait picture {
    display: contents;
  }
  .portrait img {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* Anchor the top: the frame may be squatter than the photograph, and the
       crop should come off the bottom, never the top of the head. */
    object-position: 50% 0;
    filter: saturate(0.94) contrast(1.02);
  }
</style>
