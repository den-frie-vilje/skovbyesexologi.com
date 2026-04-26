/**
 * Sveltia bundle prebuild copy.
 *
 * Copies the version-pinned Sveltia CMS bundle from
 * `node_modules/@sveltia/cms/dist/sveltia-cms.js` to
 * `static/admin/sveltia-cms.js`, where SvelteKit's static adapter
 * picks it up and serves it at `/admin/sveltia-cms.js`.
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
 * Runs as `prebuild` lifecycle hook before `vite build`. Node 25
 * strips TypeScript types natively so this runs as `node
 * scripts/copy-sveltia.ts` without a build step (matches the
 * `scripts/icons` and `scripts/og` patterns).
 */

import { copyFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SRC = 'node_modules/@sveltia/cms/dist/sveltia-cms.js';
const DST = 'static/admin/sveltia-cms.js';

if (!existsSync(SRC)) {
  console.error(`prebuild: ${SRC} not found — did pnpm install run?`);
  process.exit(1);
}

mkdirSync(dirname(DST), { recursive: true });
copyFileSync(SRC, DST);

const { size } = statSync(DST);
const sizeKb = (size / 1024).toFixed(1);
console.log(`prebuild: copied Sveltia bundle (${sizeKb} KB) → ${DST}`);
