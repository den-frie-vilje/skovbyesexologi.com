# Multi-stage Dockerfile — build tooling lives in the builder
# stage so CI only runs `docker build` + push + webhook. The
# reusable build-and-notify workflow in nas-sites stays
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
FROM pkgxdev/pkgx:latest AS builder
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
FROM nginxinc/nginx-unprivileged:1.27-alpine

# Drop the distro's default config so our server block is the
# only one. Install wget — nginxinc/nginx-unprivileged is slim
# and doesn't ship it; the compose healthcheck
# (`wget --spider http://localhost:8080/`) needs it.
USER root
RUN rm /etc/nginx/conf.d/default.conf \
    && apk add --no-cache wget
USER nginx

# Site nginx config. Listens on 8080 — update the Caddyfile
# upstream if this ever changes.
COPY --chown=nginx:nginx deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Prerendered SvelteKit output from the builder stage.
COPY --from=builder --chown=nginx:nginx /app/build/ /usr/share/nginx/html/

# Container listens on 8080 (not 80) because nginx runs as a
# non-root user. Compose / Caddy target this port.
EXPOSE 8080
