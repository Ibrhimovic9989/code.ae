# syntax=docker/dockerfile:1.7
# Base image for user project sandboxes.
# Each running container is one user project's workspace, ephemeral and isolated.

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
USER workspace
WORKDIR /home/workspace/project

EXPOSE 3000 4000

CMD ["bash", "-lc", "tail -f /dev/null"]
