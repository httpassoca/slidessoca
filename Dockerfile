# syntax=docker/dockerfile:1
# One container serves the SvelteKit app and its /api routes (adapter-node, ADR 0001). Two stages:
# the first installs everything and runs `pnpm build`; the second carries only the production
# dependencies and the `build/` output. Built in CI, never on the VPS (it would starve the box).
FROM node:24-slim AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Manifests first, so the install layer stays cached while the lockfile doesn't change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:24-slim
WORKDIR /app
# The deploy prunes dangling images by this label, leaving the other apps' images on the VPS alone.
LABEL app=slidessoca
ENV NODE_ENV=production \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PORT=3000 \
    DATA_DIR=/app/data \
    BODY_SIZE_LIMIT=16M
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# --ignore-scripts: `prepare` runs svelte-kit sync, a dev-only tool.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts && pnpm store prune

COPY --from=build /app/build ./build

# Non-root; the named volume mounted at /app/data inherits this ownership on first use.
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
VOLUME /app/data

EXPOSE 3000
# `docker ps` shows (healthy) once the server answers; the deploy also probes from outside.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "build"]
