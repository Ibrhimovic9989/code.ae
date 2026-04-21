# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/agent-runtime/package.json packages/agent-runtime/
COPY packages/templates/package.json packages/templates/
RUN pnpm install --frozen-lockfile \
  --filter @code-ae/api... \
  --filter @code-ae/shared \
  --filter @code-ae/agent-runtime \
  --filter @code-ae/templates

FROM deps AS build
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @code-ae/api exec prisma generate
RUN pnpm --filter @code-ae/api build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=build /repo /app
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
