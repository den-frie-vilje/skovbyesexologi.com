# Webhook receiver image.
#
# Base: adnanh/webhook (Go, single static binary, ~5 MB). Adds
# docker CLI + git so the hook scripts can `git pull` + run
# `docker compose`.
#
# Why not just bind-mount docker CLI from the host? The DSM
# host's `docker` binary isn't in a stable location we can
# count on across DSM versions. Installing the official
# docker-cli inside this tiny image is simpler and portable.

FROM almir/webhook:2.8.1

# --no-cache keeps the final image slim; we don't need the apk
# package index lingering after install.
RUN apk add --no-cache \
    docker-cli \
    docker-cli-compose \
    git \
    bash \
    curl

# Entrypoint/command inherited from the base image and set in
# compose.webhook.yml.
