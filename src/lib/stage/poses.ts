/**
 * Pose palette for the WebGL `<Stage>` component.
 *
 * Editors (via Sveltia) and the homepage section registry reference poses by
 * name. Raw NDC numbers live here and here only — never in content files.
 *
 * NDC convention: +x right, +y up, -1 to 1. Scale is a multiplier on each
 * element's base size; the Stage per-frame perf gate skips work when
 * `scale <= 0.02`, so `offstage` uses `scale: 0.01` to guarantee the skip.
 *
 * When adding a pose: pick a name that describes *position*, not narrative
 * role. Reusable across any future section.
 *
 * ⚠  After any edit to this file, regenerate the SVG thumbnails used by
 *     the Sveltia pose picker:
 *
 *         pkgx pnpm icons
 *
 *     Commit the regenerated SVGs under `static/admin/pose-icons/` in the
 *     same change so code and CMS stay in sync.
 */

export type Pose = {
  x: number;
  y: number;
  scale: number;
};

/** Mercury orb — the displaced sphere, iridescent in Terapi / chrome in Konsulent. */
export const bubblePoses = {
  offstage:       { x: 1.8,   y: 0,     scale: 0.01 },
  heroFarRight:   { x: 1.15,  y: -0.1,  scale: 1.05 },
  heroRightBig:   { x: 0.5,   y: -0.05, scale: 1.2  },
  heroLeftBig:    { x: -0.45, y: 0.05,  scale: 1.2  },
  upperRightBig:  { x: 0.6,   y: 0.35,  scale: 1.05 },
  centerMax:      { x: 0.48,  y: 0.0,   scale: 1.4  },
  topRightSm:     { x: 0.9,   y: 0.55,  scale: 0.4  },
  topLeftSm:      { x: -0.82, y: 0.5,   scale: 0.42 },
  bottomLeftSm:   { x: -0.88, y: -0.62, scale: 0.42 },
  cornerBLtiny:   { x: -0.95, y: -0.9,  scale: 0.28 },
  // Slightly off-center, oversized so the element covers the viewport — for
  // sections that want the element as a scroll-triggered background fill.
  fullBleed:      { x: 0.15,  y: -0.1,  scale: 3.5  }
} as const satisfies Record<string, Pose>;

/** Gold metaball cluster — MarchingCubes, warm in Terapi / cool chrome in Konsulent. */
export const dropsPoses = {
  offstage:         { x: 2,     y: 0,     scale: 0.01 },
  disperseLowC:     { x: -0.25, y: -0.45, scale: 0.82 },
  disperseLowR:     { x: 0.35,  y: -0.75, scale: 0.78 },
  disperseLowL:     { x: -0.65, y: -0.5,  scale: 0.8  },
  disperseRightMid: { x: 0.85,  y: 0.1,   scale: 0.8  },
  topRightMed:      { x: 0.82,  y: 0.6,   scale: 0.5  },
  topLeftSm:        { x: -0.78, y: 0.55,  scale: 0.4  },
  bottomLeftMed:    { x: -0.78, y: -0.55, scale: 0.47 },
  cornerTLtiny:     { x: -0.91, y: 0.84,  scale: 0.24 },
  cornerBRsm:       { x: 0.85,  y: -0.6,  scale: 0.3  },
  cornerBLsm:       { x: -0.85, y: -0.6,  scale: 0.35 },
  // Slightly off-center, oversized — background-fill variant. Gold's
  // orbit-radius ramp caps at 2.5 above scale 0.4, so at 3.5 the balls
  // sit at their fully dispersed positions within a very large MC grid.
  fullBleed:        { x: 0.15,  y: -0.1,  scale: 3.5  }
} as const satisfies Record<string, Pose>;

/** Faceted gem — low-poly icosahedron, amethyst in Terapi / chrome in Konsulent. Opaque. */
export const gemPoses = {
  offstage:      { x: 2,     y: 0,     scale: 0.01 },
  heroBRhuge:    { x: 0.9,   y: -0.9,  scale: 1.5  },
  heroRightBig:  { x: 0.7,   y: 0.1,   scale: 1.1  },
  midRightBig:   { x: 0.92,  y: -0.05, scale: 0.95 },
  cornerBRsm:    { x: 0.93,  y: -0.85, scale: 0.4  },
  cornerTRsm:    { x: 0.95,  y: 0.75,  scale: 0.3  },
  topRightSm:    { x: 0.92,  y: 0.6,   scale: 0.4  },
  topLeftSm:     { x: -0.86, y: 0.7,   scale: 0.4  },
  upperRightMed: { x: 0.92,  y: 0.65,  scale: 0.7  },
  // Slightly off-center, oversized — background-fill variant. The
  // faceted icosahedron at scale 3.5 reads as a chunky geometric
  // backdrop rather than a discrete gem.
  fullBleed:     { x: 0.15,  y: -0.1,  scale: 3.5  }
} as const satisfies Record<string, Pose>;

export type BubblePose = keyof typeof bubblePoses;
export type DropsPose = keyof typeof dropsPoses;
export type GemPose = keyof typeof gemPoses;

/**
 * A section's stage configuration — the CMS-editable, content-side shape.
 * Editors pick pose names from the palette above; this is what they author
 * in frontmatter.
 *
 * Field naming matches the element vocabulary used across code, content,
 * and Sveltia admin: `bubble` (the mercury orb), `drops` (the gold
 * metaballs), `gem` (the faceted icosahedron).
 */
export type StageConfig = {
  bubble: BubblePose;
  drops: DropsPose;
  gem: GemPose;
  /** Tone mapping exposure multiplier when this section is in view. */
  intensity?: number;
};

export type SectionStage = {
  /** Stable identifier — rendered as `data-stage-anchor` on the section root. */
  id: string;
  stage: StageConfig;
};

/** Runtime shape consumed by Stage. */
export type ResolvedAnchor = {
  selector: string;
  bubble: Pose;
  drops: Pose;
  gem: Pose;
  intensity: number;
};

/**
 * Resolve a section's named poses into concrete NDC coordinates and the
 * selector Stage uses to query the DOM.
 */
export function resolveAnchor(section: SectionStage): ResolvedAnchor {
  return {
    selector: `[data-stage-anchor="${section.id}"]`,
    bubble: bubblePoses[section.stage.bubble],
    drops: dropsPoses[section.stage.drops],
    gem: gemPoses[section.stage.gem],
    intensity: section.stage.intensity ?? 1.0
  };
}
