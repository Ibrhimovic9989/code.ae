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
# Build workspace dependencies BEFORE the api in dependency order.
# @code-ae/shared MUST build first since the others import it. We
# previously had `|| true` on a single combined run, which silently
# masked a failure in any of these — the api's tsc then 5-error'd
# with "Cannot find module '@code-ae/agent-runtime'". Now each
# workspace package builds explicitly; any failure surfaces here.
RUN pnpm --filter @code-ae/shared run build
RUN pnpm --filter @code-ae/agent-runtime run build
RUN pnpm --filter @code-ae/templates run build
RUN pnpm --filter @code-ae/mcp-client run build
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
