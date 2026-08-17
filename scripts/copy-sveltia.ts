/**
 * Sveltia prebuild vendoring.
 *
 * Copies the version-pinned Sveltia CMS bundle from
 * `node_modules/@sveltia/cms/dist/sveltia-cms.js` to
 * `static/admin/sveltia-cms.js`, where SvelteKit's static adapter
 * picks it up and serves it at `/admin/sveltia-cms.js`, and then
 * vendors the assets the bundle would otherwise fetch from a
 * third-party CDN at runtime, rewriting its URLs to point here.
 *
 * Replaces a previous `<script src="https://unpkg.com/@sveltia/cms@0/dist/sveltia-cms.js">`
 * loader. Self-hosting kills the supply-chain dependency on unpkg
 * + the loose `@0` semver tag (which floated to whatever Sveltia
 * had just published — could include breakage and could in
 * principle deliver a compromised bundle the next time the CDN
 * served us a non-cached request). Now the version is pinned via
 * `package.json`'s devDependencies, Dependabot manages bumps via
 * the weekly npm grouped PR, and the bundle file in
 * `static/admin/` is ignored from git (it's a build artefact —
 * the source of truth is `package.json` + `pnpm-lock.yaml`).
 *
 * ## Why the rewrites exist
 *
 * Serving the bundle ourselves was never the whole story. The bundle
 * itself reaches out at runtime:
 *
 * - **Fonts.** Up to v0.173 from Google Fonts, which is the GDPR
 *   complaint in sveltia-cms#443; from v0.174 from Fontsource on
 *   jsDelivr, which is better and is still a third party receiving
 *   the IP address of every editor who opens `/admin`.
 * - **Locale strings.** From v0.181 the admin UI downloads every
 *   non-`en-US` locale from unpkg at runtime, though the npm package
 *   ships them in `locales/`.
 * - **The update check.** Fetches the published `package.json` from
 *   unpkg to compare versions. For a pinned, vendored bundle the
 *   answer cannot be acted on in place; Dependabot handles bumps.
 *
 * There is no upstream option for any of this: the maintainer ruled
 * out bundling on size grounds and said "build it yourself if
 * needed" (sveltia-cms#443). We asked for a documented contract in
 * sveltia-cms#909; until there is one, this script is the contract,
 * and it is written to fail loudly rather than silently stop
 * matching. Every replacement below asserts that it changed
 * something. When a Sveltia release renames a literal, this build
 * fails with the literal it could not find, which is the moment to
 * look, rather than shipping an admin page that quietly resumes
 * talking to a CDN.
 *
 * The font files are taken from the Fontsource npm packages pinned
 * to the exact versions the bundle names. They are byte-identical to
 * what jsDelivr serves, verified by sha256 against the CDN when this
 * was written, so this substitutes the source of the bytes and not
 * the bytes.
 *
 * ## What is deliberately NOT vendored
 *
 * The bundle also lazily imports ESM from unpkg for media handling
 * and map fields (`@jsquash/*`, `exifr`, `svgo`, `leaflet`,
 * `terra-draw`). Those imports only fire when the relevant feature is
 * used, and `/admin`'s CSP has carried `script-src 'self'` since
 * Phase 2, so they are already blocked on this site and always have
 * been. Vendoring them is a larger job and is not made necessary by
 * this change.
 *
 * Runs as `prebuild` lifecycle hook before `vite build`. Node 25
 * strips TypeScript types natively so this runs as `node
 * scripts/copy-sveltia.ts` without a build step (matches the
 * `scripts/icons` and `scripts/og` patterns).
 */

import { copyFileSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';

const PKG = 'node_modules/@sveltia/cms';
const SRC = `${PKG}/dist/sveltia-cms.js`;
const DST = 'static/admin/sveltia-cms.js';
const FONT_DIR = 'static/admin/fonts';
const LOCALE_DIR = 'static/admin/locales';
const PKG_JSON_DST = 'static/admin/sveltia-cms.package.json';

/** Font files the bundle names, and the pinned package each comes from. */
const FONTS = [
  '@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2',
  '@fontsource/noto-mono/files/noto-mono-latin-400-normal.woff2',
  '@fontsource-variable/material-symbols-outlined/files/material-symbols-outlined-latin-wght-normal.woff2',
];

/**
 * Literal rewrites applied to the copied bundle. Each `find` must
 * occur at least once or the build fails: an unmatched literal means
 * upstream moved and this script no longer does what it claims.
 */
const REWRITES = [
  {
    what: 'font: Source Sans 3',
    find: 'https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3:vf@5.3.0/latin-wght-normal.woff2',
    replace: '/admin/fonts/source-sans-3-latin-wght-normal.woff2',
  },
  {
    what: 'font: Noto Mono',
    find: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-mono@5.3.0/latin-400-normal.woff2',
    replace: '/admin/fonts/noto-mono-latin-400-normal.woff2',
  },
  {
    what: 'font: Material Symbols Outlined',
    find: 'https://cdn.jsdelivr.net/fontsource/fonts/material-symbols-outlined:vf@5.3.1/latin-wght-normal.woff2',
    replace: '/admin/fonts/material-symbols-outlined-latin-wght-normal.woff2',
  },
  {
    // A preconnect opens a real DNS + TLS connection, so it leaks the editor's
    // IP to jsDelivr even though no font is fetched from there any more. The
    // element is kept and repointed at our own origin rather than removed: it
    // sits inside a compiled Svelte template whose node structure the runtime
    // walks, so deleting a node is a bigger claim than changing an attribute.
    what: 'jsDelivr preconnect',
    find: '<link rel="preconnect" href="https://cdn.jsdelivr.net/"/>',
    replace: '<link rel="preconnect" href="/"/>',
  },
  {
    what: 'locale strings base URL',
    find: 'DZ=`${JH}@${qH}/locales`',
    replace: 'DZ=`/admin/locales`',
  },
  {
    what: 'update check',
    find: 'n=`${JH}/package.json`',
    replace: 'n=`/admin/sveltia-cms.package.json`',
  },
];

/** Hosts that must not survive in the served bundle. */
const FORBIDDEN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

if (!existsSync(SRC)) {
  console.error(`prebuild: ${SRC} not found — did pnpm install run?`);
  process.exit(1);
}

mkdirSync(dirname(DST), { recursive: true });

// 1. The bundle, with its CDN URLs rewritten to our own origin.
let bundle = readFileSync(SRC, 'utf8');

for (const { what, find, replace } of REWRITES) {
  if (!bundle.includes(find)) {
    console.error(
      `prebuild: ${what} — literal not found in the Sveltia bundle:\n  ${find}\n` +
        `The bundle changed shape. Re-read it before shipping: an admin page that\n` +
        `silently resumes fetching from a CDN is the failure this check exists to stop.\n` +
        `See sveltia-cms#909 for the upstream request that would retire these rewrites.`,
    );
    process.exit(1);
  }
  bundle = bundle.replaceAll(find, replace);
}

for (const host of FORBIDDEN_HOSTS) {
  if (bundle.includes(host)) {
    console.error(`prebuild: ${host} still referenced in the rewritten bundle — refusing to ship it.`);
    process.exit(1);
  }
}

writeFileSync(DST, bundle);

// 2. The fonts the bundle now asks us for, from the pinned Fontsource packages.
mkdirSync(FONT_DIR, { recursive: true });
for (const rel of FONTS) {
  const src = `node_modules/${rel}`;
  if (!existsSync(src)) {
    console.error(`prebuild: ${src} not found — is the Fontsource package installed and pinned?`);
    process.exit(1);
  }
  copyFileSync(src, `${FONT_DIR}/${basename(rel)}`);
}

// 3. The locale strings, which the bundle downloads at runtime from v0.181.
mkdirSync(LOCALE_DIR, { recursive: true });
const locales = readdirSync(`${PKG}/locales`).filter((f) => f.endsWith('.json'));
if (locales.length === 0) {
  console.error(`prebuild: no locale files in ${PKG}/locales — the package layout changed.`);
  process.exit(1);
}
for (const f of locales) copyFileSync(`${PKG}/locales/${f}`, `${LOCALE_DIR}/${f}`);

// 4. The package manifest the update check reads, so it compares us to us.
copyFileSync(`${PKG}/package.json`, PKG_JSON_DST);

const { version } = JSON.parse(readFileSync(`${PKG}/package.json`, 'utf8'));
const sizeKb = (statSync(DST).size / 1024).toFixed(1);
console.log(
  `prebuild: vendored Sveltia ${version} (${sizeKb} KB) → ${DST}\n` +
    `prebuild: ${FONTS.length} fonts, ${locales.length} locales, ${REWRITES.length} URL rewrites, no third-party host remaining`,
);
