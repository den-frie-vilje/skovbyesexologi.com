/**
 * OG image generator.
 *
 * Screenshots the prerendered `/og/[[lang=locale]]/[slug]` routes to
 * 1200×630 PNGs in `static/img/og/`. Those PNGs are what the main
 * pages reference as `og:image` — already a filesystem artifact, no
 * runtime rendering in production.
 *
 * Run manually (not wired into prebuild so iterating on the OG
 * layout doesn't thrash committed PNGs):
 *
 *     pkgx pnpm og
 *
 * One-time setup for new contributors (~92 MB Chromium download
 * cached per user, not in the repo):
 *
 *     pkgx pnpm exec playwright install chromium
 *
 * The script boots `vite dev` on an ephemeral port, waits for it to
 * answer, navigates to each OG variant, screenshots, and shuts the
 * server down. Uses dev server (not `vite preview`) so fonts and
 * Vite-served assets resolve identically to local browsing — avoids
 * needing a full `pnpm build` first.
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const VIEWPORT = { width: 1200, height: 630 };

type Variant = {
  /** URL path to navigate to, relative to the dev server. */
  path: string;
  /** Output filename under static/img/og/ (without extension). */
  name: string;
};

/*
  Add new variants here — matches entries in the OG route's
  +page.ts. OG slugs use the stable service `id` (content
  filename), NOT the locale-specific URL slug, so each OG URL
  stays the same across locales.
*/
const OG_SLUGS = ['home', 'terapi', 'intimacy-coordination', 'aeldrepleje', 'undervisning'] as const;
const variants: Variant[] = OG_SLUGS.flatMap((slug) => [
  { path: `/og/${slug}`, name: `${slug}.da` },
  { path: `/og/en/${slug}`, name: `${slug}.en` }
]);

async function waitFor(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  console.log('→ starting vite dev…');
  // Bind to 127.0.0.1 on a fixed port — dev server doesn't need internet
  // access, just a localhost address Playwright can hit.
  const port = 5173;
  const server = spawn('pkgx', ['pnpm', 'dev', '--port', String(port), '--host', '127.0.0.1'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Surface server errors without drowning stdout with HMR chatter.
  server.stderr?.on('data', (chunk) => process.stderr.write(chunk));

  try {
    await waitFor(`http://127.0.0.1:${port}/`);
    console.log(`✓ vite ready on :${port}`);

    console.log('→ launching chromium…');
    // Real Chrome in headed mode uses the host GPU for WebGL —
    // necessary for Three.js's MeshPhysicalMaterial with iridescence
    // to render into the canvas. Headless chromium (including
    // `headless: 'new'`) uses SwiftShader which produces a
    // transparent buffer for these advanced material shaders.
    //
    // A browser window flashes open for ~4s while the generator
    // runs. It's closed when the generator exits.
    const browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox']
    });
    /*
      `deviceScaleFactor: 2` doubles the render resolution to
      2400×1260 for retina-ready OG cards — much crisper type
      and stage rendering than 1x. The accompanying JPEG quality
      setting below (q=75) keeps the file size under WhatsApp's
      300 KB ceiling at this resolution. Earlier iterations: 2x
      PNG → 1.8 MB (rejected); 1x JPEG q85 → ~100 KB but soft
      type; 2x JPEG q75 → ~250 KB with crisp type.
    */
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });

    const outDir = resolve(repoRoot, 'static', 'img', 'og');
    mkdirSync(outDir, { recursive: true });

    for (const v of variants) {
      const url = `http://127.0.0.1:${port}${v.path}`;
      const file = resolve(outDir, `${v.name}.jpg`);
      process.stdout.write(`  ${v.path.padEnd(24)} → ${file.replace(repoRoot + '/', '')}`);

      const page = await context.newPage();
      page.on('pageerror', (err) => console.warn(`  [pageerror] ${err.message}`));

      await page.goto(url, { waitUntil: 'networkidle' });
      // Wait for webfonts to actually finish loading — networkidle
      // catches the CSS fetch but not font-face decoding. Without
      // this, the first PNG may use a system fallback (often a
      // condensed sans) instead of Instrument Serif / Fraunces.
      await page.evaluate(() => document.fonts.ready);
      // Three.js startup cost: dynamic `import('three')` +
      // MarchingCubes addon, WebGLRenderer init, shader compile,
      // env-texture generation, then several frames of lerping
      // toward the anchor pose. 2s is too tight — the capture
      // fires before the first material has painted, so the PNG
      // shows the text + portrait over an empty page. 6s leaves
      // comfortable headroom on cold GPU paths.
      await page.waitForTimeout(6000);
      /*
        JPEG output at q=75 — paired with the 2× deviceScaleFactor
        above, this lands each file in the 200–280 KB range,
        under WhatsApp's 300 KB unfurl-preview ceiling while
        keeping 2400×1260 pixels of detail. OG images are opaque
        so PNG's lossless advantage isn't needed.
      */
      await page.screenshot({
        path: file,
        type: 'jpeg',
        quality: 75,
        clip: { x: 0, y: 0, ...VIEWPORT }
      });
      await page.close();
      process.stdout.write(' ✓\n');
    }

    await browser.close();
    console.log(`✓ ${variants.length} og image${variants.length === 1 ? '' : 's'} written`);
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
