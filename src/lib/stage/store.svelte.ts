/**
 * Shared stage state — lets the Stage mount persist in the
 * root layout while pages publish their own anchors + chapter
 * palette through this store. Because the same Stage instance
 * renders across client-side navigation, its internal tween-state
 * (orb rotation, material cross-fade, anchor lerp) carries over
 * — the stage eases from the old page's pose to the new page's
 * pose rather than re-mounting and resetting.
 *
 * Svelte 5 module-scoped runes require the `.svelte.ts` extension,
 * which is why this file doesn't sit alongside `poses.ts`.
 *
 * Publishers (pages):
 *   import { stage } from '$lib/stage/store.svelte';
 *   $effect(() => {
 *     stage.anchors = [...];
 *     stage.chapterMode = 0;
 *     stage.konsulentY = 0;
 *   });
 *
 * Consumer (the root layout):
 *   <Stage anchors={stage.anchors} chapterMode={stage.chapterMode} />
 */

import type { ResolvedAnchor } from './poses';

export const stage = $state({
  /** Stage anchor set — one entry per `data-stage-anchor`
   *  element on the current page. Empty on routes without a stage. */
  anchors: [] as ResolvedAnchor[],
  /** 0 = terapi / iridescent palette; 1 = konsulent / chrome.
   *  Continuous (0..1) on the homepage as the user scrolls past
   *  the chapter-II divider; fixed at 0 or 1 on service pages. */
  chapterMode: 0,
  /**
   * Pixel Y-position of the chapter-II divider within `.app-shell`,
   * used to hard-stop the bg gradient at the divider line so the
   * cool→warm paper transition aligns with the text change.
   *   • Homepage scroll listener updates this live.
   *   • Konsulent service pages set it to `0` (whole page warm).
   *   • Terapi service pages leave it `null`; the layout omits
   *     the inline style and the CSS fallback `200vh` applies,
   *     rendering the whole page as the cool variant.
   */
  konsulentY: null as number | null
});
