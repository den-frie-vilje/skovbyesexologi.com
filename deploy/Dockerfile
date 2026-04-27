# Multi-stage Dockerfile — build tooling lives in the builder
# stage so CI only runs `docker build` + push + cosign sign. The
# reusable build-and-sign workflow in nas-sites stays
# framework-agnostic; this file owns the dev→image bridge.
#
# Stage 1: pkgx-backed builder — same Node + pnpm versions as
#          local dev (sourced from pkgx.yml — the repo's single
#          source of truth for runtime versions).
# Stage 2: rootless nginx serving the built static output.

# ----- builder --------------------------------------------------
# pkgxdev/pkgx is the official image — comes with pkgx binary
# pre-installed and glibc (pkgx needs glibc, which Alpine's
# musl can't provide without a compat layer). When pkgx.yml
# bumps node or pnpm, this Dockerfile gets the new versions on
# the next build — no code change here. Same dev↔CI toolchain
# as `pkgx pnpm ...` on the laptop.
FROM pkgxdev/pkgx:latest@sha256:a752ba83d58f0429a21e11206af5be562b44674e1ac0e97f9022ae150a1b6973 AS builder
WORKDIR /app

# Copy pkgx.yml first so the pkgx-install layer caches until
# tool versions change.
COPY pkgx.yml ./

# Copy lockfile next so the deps-install layer caches until
# lockfile actually changes. Source-only changes don't re-run
# pnpm install.
COPY package.json pnpm-lock.yaml ./
RUN pkgx pnpm install --frozen-lockfile

# Source tree. Changes here bust the build layer but leave
# node_modules alone.
COPY . .

# Vite bakes build-time env vars into the client bundle. CI
# passes PUBLIC_GIT_SHA / PUBLIC_BUILD_TIME via --build-arg;
# the ENV statements below re-export them so `pnpm build` sees
# them.
ARG VITE_MODE=production
ARG PUBLIC_GIT_SHA=
ARG PUBLIC_BUILD_TIME=
ENV PUBLIC_GIT_SHA=$PUBLIC_GIT_SHA
ENV PUBLIC_BUILD_TIME=$PUBLIC_BUILD_TIME

# Type check first — faster to fail here than in the (slower)
# Vite build. Output lands in ./build via adapter-static.
RUN pkgx pnpm check
RUN pkgx pnpm build -- --mode $VITE_MODE

# ----- runtime --------------------------------------------------
# nginxinc/nginx-unprivileged runs as UID 101 (nginx user),
# binds to port 8080. Caddy's upstream is `site:8080`.
#
# Rationale for rootless: if this image is ever compromised
# (e.g. a malicious file landed in static/), a root-running
# nginx widens the blast radius. uid 101 with no shell and
# no write access to /usr/share/nginx/html keeps damage
# contained.
FROM nginxinc/nginx-unprivileged:1.29-alpine@sha256:f35982400455b4f359083ba9d1ef573fbbe4221a6a8a194dc7a14beb4e2cd3dc

# Drop the distro's default config so our server block is the
# only one. Install wget — nginxinc/nginx-unprivileged is slim
# and doesn't ship it; the compose healthcheck
# (`wget --spider http://localhost:8080/`) needs it.
# Stay as root for the install + COPYs + the optional strip
# below — /usr/share/nginx/html/ in the base image is root-
# owned, so the nginx user can't `rm` files inside it. Switch
# to nginx for the final EXPOSE / runtime.
USER root
RUN rm /etc/nginx/conf.d/default.conf \
    && apk add --no-cache wget

# Site nginx config. Listens on 8080 — update the Caddyfile
# upstream if this ever changes.
COPY --chown=nginx:nginx deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Prerendered SvelteKit output from the builder stage.
COPY --from=builder --chown=nginx:nginx /app/build/ /usr/share/nginx/html/

# Phase 8 / M5 — strip the editor from production images.
#
# The `/admin` route hosts Sveltia CMS and only needs to exist
# on staging (where Signe edits content). Including it in the
# production image means the Sveltia bundle is loadable at
# `https://skovbyesexologi-com.prod.denfrievilje.dk/admin`
# even though it has no working OAuth proxy on prod — anyone
# who discovers the .prod hostname can hit the editor shell
# and probe its config. Tiny attack surface but a needless one.
#
# When STRIP_EDITOR=true (set by deploy-production.yml's
# build-args; deploy-staging.yml leaves it default-false to
# keep the editor functional on staging), we delete:
#   /usr/share/nginx/html/admin/  (the prerendered Sveltia
#                                  host page + config.yml +
#                                  the self-hosted bundle)
#
# /admin without trailing slash falls through nginx's
# try_files to /200.html (the SPA shell). The shell tries to
# render the /admin route client-side, but the Sveltia bundle
# script tag points at /admin/sveltia-cms.js which now 404s,
# so the editor mounts no UI — visible-but-broken. Better
# would be an explicit 404, but that needs a per-environment
# nginx.conf which we'd rather not introduce yet.
#
# /publish is intentionally NOT stripped — it has prerender=
# false (lives only in /200.html) and depends on a
# localStorage Sveltia OAuth token to do anything, which
# isn't present in production. Harmless if ever loaded.
ARG STRIP_EDITOR=false
RUN if [ "$STRIP_EDITOR" = "true" ]; then \
        echo "STRIP_EDITOR=true → removing /admin from production image" ; \
        rm -rf /usr/share/nginx/html/admin ; \
    fi

# Drop privilege for the runtime — nginx-unprivileged binds
# to :8080 as UID 101, so root isn't needed at runtime.
USER nginx

# Container listens on 8080 (not 80) because nginx runs as a
# non-root user. Compose / Caddy target this port.
EXPOSE 8080
