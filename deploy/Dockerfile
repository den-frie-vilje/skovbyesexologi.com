# Static site container. Layer contents:
#   1. Alpine-based nginx (~8 MB)
#   2. Site nginx config (routing, caching, gzip)
#   3. The prerendered SvelteKit output from `build/`
#
# Build context is the repo root; only the two COPY targets below
# end up in the image. No secrets at any stage — the `build/`
# output contains only PUBLIC_* Vite vars, and nothing else from
# the repo is pulled in.

FROM nginx:1.27-alpine

# Drop the default nginx config so our single server block is
# the only one. Replacing, not appending, avoids route-priority
# surprises later.
# Also add wget — not in nginx:alpine by default — so the
# compose healthcheck can hit / locally without needing
# exec-ing shell builtins.
RUN rm /etc/nginx/conf.d/default.conf \
    && apk add --no-cache wget

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY build/ /usr/share/nginx/html/

# nginx:alpine already sets the right user, exposes 80, and
# configures daemon-off entry. No further runtime config needed.
