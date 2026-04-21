# Code.ae

Arabic-first AI coding platform for the UAE / GCC market. Lovable + Replit, reimagined for the region.

## Architecture

```
code.ae/
├── apps/
│   ├── web/            Next.js 15 — Arabic-first UI, editor, live preview
│   ├── api/            NestJS — auth, projects, sessions (DDD modules)
│   └── orchestrator/   Azure Container Instances driver — per-user sandboxes
├── packages/
│   ├── shared/         zod DTOs, i18n keys, cross-cutting types
│   ├── agent-runtime/  @anthropic-ai/claude-agent-sdk wrapper
│   └── templates/      scaffolds generated into user projects
└── infra/
    ├── docker/         Dockerfiles for all services + sandbox base image
    └── azure/          Bicep / az CLI scripts
```

## Local dev

```bash
pnpm install
pnpm dev
```

## Infrastructure

Hosted on Azure, UAE North region. Resource group: `code-ae-dev`.

| Layer | Azure service |
|---|---|
| Platform web/api/orchestrator | Container Apps |
| Per-user sandboxes | Container Instances |
| Image registry | Container Registry |
| Platform DB | PostgreSQL Flexible Server |
| Secrets / env keeper | Key Vault |
| Project snapshots | Blob Storage |
