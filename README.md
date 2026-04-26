# skovbyesexologi.com

Editorial website for Signe Skovbye — psychomotor therapist, clinical
sexologist, intimacy coordinator. Static SvelteKit site, Danish-first
with English translation, self-hosted on a Synology NAS via the
[nas-sites](https://github.com/den-frie-vilje/nas-sites) deploy
pipeline.

The homepage is a single scrolling document with a scroll-choreographed
Three.js stage. Content is edited in-browser via Sveltia CMS at `/admin`,
which writes back to this repo via the GitHub backend.

## Local dev

All commands run via `pkgx` — Node and pnpm are managed at the
versions declared in `pkgx.yml` + `package.json`'s `engines` (Node 25,
pnpm 10).

```sh
pkgx pnpm install
pkgx pnpm dev      # vite on :5173, host 0.0.0.0
pkgx pnpm build    # static → build/
pkgx pnpm check    # svelte-check + tsc
pkgx pnpm icons    # regenerate pose SVG thumbnails (after editing src/lib/stage/poses.ts)
```

## Where to look

- **[AGENTS.md](AGENTS.md)** — deep reference: Three.js stage
  architecture, palette conventions, scroll anchoring, perf rules,
  status + open work.
- **[CLAUDE.md](CLAUDE.md)** — quick start aimed at AI assistants
  working on the repo (Svelte 5 runes only, MCP tools available, etc).
- **[DEPLOY.md](DEPLOY.md)** — operational runbook for the NAS-side
  deploy pipeline + per-site bootstrap.
- **[deploy/](deploy/)** — Dockerfile, compose files, Caddyfiles,
  nginx config.
- **[static/admin/config.yml](static/admin/config.yml)** — Sveltia CMS
  collection definitions.

## Deploy

Pushes to `staging` automatically deploy to the staging origin
(`skovbyesexologi-com.stage.denfrievilje.dk`). Pushes to `main` go
through a reviewer-gated GitHub Actions pipeline with path-scoped
signed-commit verification before deploying to the production origin
(`skovbyesexologi-com.prod.denfrievilje.dk`). See
[DEPLOY.md](DEPLOY.md) for the full lifecycle.
