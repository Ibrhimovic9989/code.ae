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
COPY packages/mcp-client/package.json packages/mcp-client/
# Install every workspace package the api transitively depends on. `...` means
# "and all dependencies" so pnpm hydrates the monorepo deps correctly.
RUN pnpm install --frozen-lockfile --filter @code-ae/api...

FROM deps AS build
COPY packages packages
COPY apps/api apps/api
# Build workspace dependencies BEFORE the api. @code-ae/shared and
# @code-ae/agent-runtime are TypeScript packages whose `dist/` must exist
# for the api's tsc to resolve imports like `from '@code-ae/shared'`.
RUN pnpm -r --filter @code-ae/shared --filter @code-ae/agent-runtime --filter @code-ae/templates --filter @code-ae/mcp-client run build || true
RUN pnpm --filter @code-ae/api exec prisma generate
RUN pnpm --filter @code-ae/api build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=build /repo /app
WORKDIR /app/apps/api
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 4000
CMD ["/usr/local/bin/docker-entrypoint.sh"]
