# syntax=docker/dockerfile:1.7
# Base image for user project sandboxes.
# Each running container = one user project's workspace, running the
# code-ae sandbox-agent sidecar on :4200 + user's frontend/backend on 3000/4000.

FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PNPM_HOME=/usr/local/pnpm \
    PATH=/usr/local/pnpm:$PATH \
    # Shared bun cache under /opt so both the build-time warm-up and the
    # runtime `workspace` user resolve to the same content-addressed
    # store. Without this, warm-up writes to /root/.bun and runtime reads
    # from /home/workspace/.bun — two different caches, no win.
    BUN_INSTALL_CACHE_DIR=/opt/bun-cache

RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      ca-certificates \
      curl \
      build-essential \
      python3 \
      python3-pip \
      make \
      g++ \
      procps \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
    && npm install -g bun@1.1.38

RUN useradd -ms /bin/bash workspace

# Bake the canonical heal + detect scripts into the image so the API's
# HealPreviewUseCase / DetectErrorsUseCase call them by name — no more
# LLM-composed heal recipes racing the compile, no more API-side bash
# strings drifting from the in-sandbox source of truth.
COPY code-ae-heal.sh /usr/local/bin/code-ae-heal
COPY code-ae-detect-errors.sh /usr/local/bin/code-ae-detect-errors
RUN chmod +x /usr/local/bin/code-ae-heal /usr/local/bin/code-ae-detect-errors

# ── Pre-warm bun's content-addressed cache with the dependency closure of
#    our default + opt-in stacks (Vite + React + react-router-dom +
#    Tailwind + Next). At image build time bun fetches every tarball into
#    BUN_INSTALL_CACHE_DIR; user `bun install` later reuses them, dropping
#    cold install from ~30-60s to under 5s on a fresh sandbox.
RUN mkdir -p /opt/cache /opt/bun-cache
COPY warm-cache-package.json /opt/cache/package.json
RUN cd /opt/cache \
    && bun install --no-summary >/dev/null 2>&1 || true \
    && rm -rf /opt/cache/node_modules /opt/cache/bun.lockb \
    && chmod -R a+rX /opt/bun-cache

# --- sandbox-agent sidecar -----------------------------------------------
# Installed as root into /opt/agent, then we drop privileges to `workspace`.
WORKDIR /opt/agent
COPY sandbox-agent/package.json ./
COPY sandbox-agent/dist ./dist
RUN npm install --omit=dev --no-audit --no-fund \
    && chown -R workspace:workspace /opt/agent

USER workspace
RUN mkdir -p /home/workspace/project
WORKDIR /home/workspace/project

EXPOSE 3000 4000 4200

CMD ["node", "/opt/agent/dist/main.js"]
