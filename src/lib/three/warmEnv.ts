/**
 * Abstract photo-studio environment for the mercury blob reflections.
 * Warm paper base, blush + cool-blue softboxes, overhead key light, no literal shapes.
 */
export function paintStudioEnv(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#fff6ea');
  base.addColorStop(0.2, '#faecd9');
  base.addColorStop(0.5, '#f0e4d3');
  base.addColorStop(0.75, '#e2d3c0');
  base.addColorStop(0.92, '#c8b6a2');
  base.addColorStop(1, '#a6968a');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Warm blush haze across the middle
  const blush = ctx.createRadialGradient(
    width * 0.5,
    height * 0.38,
    0,
    width * 0.5,
    height * 0.38,
    width * 0.55
  );
  blush.addColorStop(0, 'rgba(255, 210, 200, 0.55)');
  blush.addColorStop(0.55, 'rgba(255, 190, 180, 0.18)');
  blush.addColorStop(1, 'rgba(255, 190, 180, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = blush;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Softboxes — abstract rectangles, heavily blurred
  softbox(ctx, width * 0.22, height * 0.3, width * 0.18, height * 0.16, '#ffffff', 0.95, 42);
  softbox(ctx, width * 0.72, height * 0.26, width * 0.22, height * 0.19, '#fff7ea', 0.92, 48);
  softbox(ctx, width * 0.12, height * 0.56, width * 0.1, height * 0.16, '#ffd9da', 0.78, 36);
  softbox(ctx, width * 0.5, height * 0.52, width * 0.14, height * 0.1, '#ffecc0', 0.55, 44);
  softbox(ctx, width * 0.84, height * 0.62, width * 0.1, height * 0.14, '#dae3f0', 0.6, 40);
  softbox(ctx, width * 0.4, height * 0.18, width * 0.25, height * 0.06, '#ffffff', 0.7, 30);

  // Soft horizon seam — subtle, no heavy floor shadow
  const floor = ctx.createLinearGradient(0, height * 0.82, 0, height);
  floor.addColorStop(0, 'rgba(80, 60, 45, 0)');
  floor.addColorStop(1, 'rgba(80, 60, 45, 0.15)');
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = floor;
  ctx.fillRect(0, height * 0.82, width, height * 0.18);
  ctx.restore();

  // Tiny highlight flecks — tiny specular pinpoints for shimmer
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(255, 240, 210, 0.9)';
  for (const [x, y, r] of [
    [0.26, 0.28, 3],
    [0.74, 0.24, 4],
    [0.5, 0.2, 2.5],
    [0.13, 0.55, 2.5],
    [0.86, 0.6, 3],
    [0.42, 0.52, 2]
  ] as Array<[number, number, number]>) {
    ctx.beginPath();
    ctx.arc(x * width, y * height, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function softbox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  color: string,
  alpha: number,
  blur: number
): void {
  ctx.save();
  ctx.filter = `blur(${blur}px)`;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);
  ctx.restore();
}

/**
 * Warm/rich environment for liquid gold — dramatic amber/orange highlights,
 * deep brown shadows, strong horizon for that "wet metal" gallery light.
 */
export function paintGoldEnv(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  // Dramatic gold-photography env: bright overhead sky, warm amber wrap,
  // DEEP near-black floor. Gold needs that strong top-to-bottom contrast
  // for reflections to read as metal rather than uniform wax.
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#ffeec0');
  base.addColorStop(0.18, '#f8d58a');
  base.addColorStop(0.38, '#c88a30');
  base.addColorStop(0.52, '#6a4414');
  base.addColorStop(0.72, '#1c1108');
  base.addColorStop(1, '#060302');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Primary key softbox — sharp, classic jewelry-photo square highlight
  softbox(ctx, width * 0.3, height * 0.2, width * 0.1, height * 0.09, '#ffffff', 1.0, 5);
  // Second sharp key on the right for bilateral highlights
  softbox(ctx, width * 0.72, height * 0.22, width * 0.1, height * 0.09, '#ffffff', 0.95, 6);
  // Warm amber wrap between the keys (soft), gives the mid-tone gold color
  softbox(ctx, width * 0.5, height * 0.3, width * 0.28, height * 0.12, '#ffc85a', 0.6, 50);
  // Sharp horizon band — where bright sky meets dark floor
  softbox(ctx, width * 0.5, height * 0.42, width * 0.5, height * 0.012, '#ffd88a', 0.85, 4);

  // Deep shadow at the bottom — ensures gold has dark undersides (not waxy)
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const shadow = ctx.createLinearGradient(0, height * 0.5, 0, height);
  shadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shadow.addColorStop(0.6, 'rgba(0, 0, 0, 0.5)');
  shadow.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, height * 0.5, width, height * 0.5);
  ctx.restore();

  // Tiny pinpoint sparkles
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(255, 248, 220, 0.95)';
  for (const [x, y, r] of [
    [0.3, 0.2, 3.5],
    [0.77, 0.17, 4],
    [0.52, 0.11, 3],
    [0.15, 0.42, 2.5],
    [0.86, 0.44, 3]
  ] as Array<[number, number, number]>) {
    ctx.beginPath();
    ctx.arc(x * width, y * height, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * High-contrast environment for the dark amethyst — bright white keys on
 * near-black, with a few tight colored pinpoints to suggest prismatic refraction.
 */
export function paintGemEnv(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#2a1a38');
  base.addColorStop(0.35, '#120a1c');
  base.addColorStop(0.6, '#080510');
  base.addColorStop(1, '#020107');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Hot-white key softboxes — dramatic contrast for sharp facet highlights
  softbox(ctx, width * 0.25, height * 0.22, width * 0.13, height * 0.1, '#ffffff', 1.0, 20);
  softbox(ctx, width * 0.72, height * 0.18, width * 0.15, height * 0.12, '#ffffff', 1.0, 24);
  softbox(ctx, width * 0.5, height * 0.35, width * 0.08, height * 0.04, '#ffffff', 0.9, 16);

  // Blooming pink highlights — big soft magenta clouds that reflect as halos on facets
  softbox(ctx, width * 0.14, height * 0.38, width * 0.18, height * 0.18, '#ffb0da', 0.95, 72);
  softbox(ctx, width * 0.82, height * 0.44, width * 0.2, height * 0.2, '#ff7fcf', 0.95, 80);
  softbox(ctx, width * 0.46, height * 0.62, width * 0.2, height * 0.12, '#ffcdeb', 0.7, 64);
  softbox(ctx, width * 0.32, height * 0.16, width * 0.08, height * 0.06, '#ff8ac8', 0.6, 32);

  // Colored specular pinpoints — caustic hints (violet, pink, cold cyan)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const sparkles: Array<[number, number, number, string]> = [
    [0.25, 0.22, 4, 'rgba(255,255,255,1)'],
    [0.72, 0.18, 5, 'rgba(255,255,255,1)'],
    [0.5, 0.35, 3, 'rgba(255,255,255,1)'],
    [0.18, 0.3, 6, 'rgba(255,170,220,0.9)'],
    [0.82, 0.3, 5, 'rgba(255,140,200,0.9)'],
    [0.38, 0.5, 4, 'rgba(255,180,230,0.85)'],
    [0.62, 0.55, 4, 'rgba(255,150,210,0.85)'],
    [0.1, 0.1, 3, 'rgba(255,255,255,0.9)'],
    [0.92, 0.08, 3, 'rgba(255,255,255,0.9)']
  ];
  for (const [x, y, r, c] of sparkles) {
    const g = ctx.createRadialGradient(x * width, y * height, 0, x * width, y * height, r * 4);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x * width - r * 4, y * height - r * 4, r * 8, r * 8);
  }
  ctx.restore();

  // Pink-lit horizon kiss — thin bright line across the middle with rose tint
  const horizon = ctx.createLinearGradient(0, height * 0.42, 0, height * 0.58);
  horizon.addColorStop(0, 'rgba(255, 160, 210, 0)');
  horizon.addColorStop(0.5, 'rgba(255, 180, 220, 0.4)');
  horizon.addColorStop(1, 'rgba(255, 160, 210, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = horizon;
  ctx.fillRect(0, height * 0.42, width, height * 0.16);
  ctx.restore();
}

/**
 * Cool-chrome environment for the konsulent-state mercury metaballs.
 * Blue-leaning softboxes, softer top-to-bottom contrast (no near-black)
 * so the chrome picks up gentle blue reflections without the high-contrast
 * harshness of the pink gem env.
 */
export function paintChromeEnv(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#eaf2fa');
  base.addColorStop(0.25, '#d6e1ef');
  base.addColorStop(0.5, '#b6c4d6');
  base.addColorStop(0.75, '#8a99ac');
  base.addColorStop(1, '#62718a');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Pure cool-light environment — two overhead softboxes + two mid-lower
  // fills. No warm / pink directional accents; the chrome reads as a
  // cool steel-silver rather than picking up tinted specular highlights.
  softbox(ctx, width * 0.3, height * 0.22, width * 0.12, height * 0.09, '#ecf4fc', 0.85, 28);
  softbox(ctx, width * 0.7, height * 0.22, width * 0.12, height * 0.09, '#e4eef9', 0.82, 30);

  // Soft cyan wash mid-lower for quiet tinted fill
  softbox(ctx, width * 0.3, height * 0.62, width * 0.2, height * 0.14, '#b8ccdf', 0.5, 54);
  softbox(ctx, width * 0.78, height * 0.6, width * 0.18, height * 0.14, '#c4d3e3', 0.48, 50);

  // Gentle horizon kiss — blue-tinted, no screen-blown highlights
  const horizon = ctx.createLinearGradient(0, height * 0.42, 0, height * 0.58);
  horizon.addColorStop(0, 'rgba(215, 228, 242, 0)');
  horizon.addColorStop(0.5, 'rgba(225, 235, 246, 0.28)');
  horizon.addColorStop(1, 'rgba(215, 228, 242, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = horizon;
  ctx.fillRect(0, height * 0.42, width, height * 0.16);
  ctx.restore();
}

function makeEnvTexture(
  THREE: typeof import('three'),
  painter: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context for env texture');
  painter(ctx, 1024, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWarmEnvTexture(THREE: typeof import('three')) {
  return makeEnvTexture(THREE, paintStudioEnv);
}
export function createGoldEnvTexture(THREE: typeof import('three')) {
  return makeEnvTexture(THREE, paintGoldEnv);
}
export function createGemEnvTexture(THREE: typeof import('three')) {
  return makeEnvTexture(THREE, paintGemEnv);
}
export function createChromeEnvTexture(THREE: typeof import('three')) {
  return makeEnvTexture(THREE, paintChromeEnv);
}
