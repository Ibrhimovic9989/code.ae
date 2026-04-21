# syntax=docker/dockerfile:1.7
# Base image for user project sandboxes.
# Each running container = one user project's workspace, running the
# code-ae sandbox-agent sidecar on :4200 + user's frontend/backend on 3000/4000.

FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PNPM_HOME=/usr/local/pnpm \
    PATH=/usr/local/pnpm:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      ca-certificates \
      curl \
      build-essential \
      python3 \
      python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
    && npm install -g bun@1.1.38

RUN useradd -ms /bin/bash workspace

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
