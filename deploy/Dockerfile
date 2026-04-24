# Multi-stage Dockerfile — all build tooling lives here, CI
# only runs `docker build` + push. Lets the reusable build-
# and-notify workflow in nas-sites stay language-agnostic.
#
# Stage 1: build the SvelteKit static output
# Stage 2: serve it from a rootless nginx base

# ----- builder --------------------------------------------------
# node:25-alpine matches our engines.node: ~25 floor. Alpine keeps
# the build-stage layer weight down (~70 MB vs ~300 for the
# Debian-slim base). We don't ship this layer, it gets discarded
# after the COPY --from=builder.
FROM node:25-alpine AS builder
WORKDIR /app

# pnpm via npm (corepack's experimental in 25; explicit npm install
# gives a pinned, reproducible pnpm version across Node minors).
RUN npm install -g pnpm@10

# Copy lockfile first so dep-install layer caches until lockfile
# actually changes. A source-code-only change doesn't re-download
# node_modules.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Source tree next. Changes here bust the build layer but leave
# the node_modules layer alone.
COPY . .

# Vite bakes build-time env vars into the client bundle. CI passes
# PUBLIC_GIT_SHA / PUBLIC_BUILD_TIME via --build-arg; the ENV
# statements below re-export them so `pnpm build` sees them.
ARG VITE_MODE=production
ARG PUBLIC_GIT_SHA=
ARG PUBLIC_BUILD_TIME=
ENV PUBLIC_GIT_SHA=$PUBLIC_GIT_SHA
ENV PUBLIC_BUILD_TIME=$PUBLIC_BUILD_TIME

# Type check first so a type error fails the build layer BEFORE
# the (slower) Vite build starts. Output ends up in ./build via
# adapter-static.
RUN pnpm check
RUN pnpm build -- --mode $VITE_MODE

# ----- runtime --------------------------------------------------
# nginxinc/nginx-unprivileged runs as UID 101 (nginx user), binds
# to port 8080 by default (non-root can't bind <1024). Caddy's
# upstream config points at `site:8080` accordingly.
#
# Rationale for rootless: if this image is ever compromised (e.g.
# a malicious file landed in static/), a root-running nginx
# widens the blast radius. uid 101 with no shell and no write
# access to /usr/share/nginx/html keeps damage contained.
FROM nginxinc/nginx-unprivileged:1.27-alpine

# Drop the distro's default config so our server block is the
# only one. `wget` for the compose healthcheck (busybox wget is
# already in the base image, just pinning availability).
USER root
RUN rm /etc/nginx/conf.d/default.conf
USER nginx

# Site nginx config. Listens on 8080 — update the Caddyfile
# upstream if this ever changes.
COPY --chown=nginx:nginx deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Prerendered SvelteKit output from the builder stage.
COPY --from=builder --chown=nginx:nginx /app/build/ /usr/share/nginx/html/

# Container listens on 8080 (not 80) because nginx is running as
# a non-root user. Compose / Caddy target this port.
EXPOSE 8080
