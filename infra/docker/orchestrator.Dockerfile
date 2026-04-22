# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/orchestrator/package.json apps/orchestrator/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @code-ae/orchestrator... --filter @code-ae/shared

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/orchestrator apps/orchestrator
# Shared must be compiled first so orchestrator's tsc can resolve `@code-ae/shared`.
RUN pnpm --filter @code-ae/shared build
RUN pnpm --filter @code-ae/orchestrator build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
# Copy the entire repo so pnpm's workspace symlinks (apps/orchestrator/node_modules/*
# → ../../node_modules/.pnpm/...) resolve correctly at runtime.
COPY --from=build /repo /app
WORKDIR /app/apps/orchestrator
EXPOSE 4100
CMD ["node", "dist/main.js"]
