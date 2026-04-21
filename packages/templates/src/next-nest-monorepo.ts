import type { TemplateManifest } from './index';

export const nextNestMonorepoTemplate: TemplateManifest = {
  id: 'next-nest-monorepo',
  name: 'Next.js + NestJS Monorepo',
  description: 'Frontend (Next.js 15) and backend (NestJS) in one pnpm+Turborepo monorepo.',
  files: [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: 'my-app',
          private: true,
          packageManager: 'pnpm@9.12.0',
          scripts: {
            dev: 'turbo run dev',
            build: 'turbo run build',
          },
          devDependencies: { turbo: '^2.3.3', typescript: '^5.7.2' },
        },
        null,
        2,
      ),
    },
    {
      path: 'pnpm-workspace.yaml',
      content: 'packages:\n  - "apps/*"\n  - "packages/*"\n',
    },
    {
      path: 'turbo.json',
      content: JSON.stringify(
        {
          $schema: 'https://turbo.build/schema.json',
          tasks: {
            dev: { cache: false, persistent: true },
            build: { dependsOn: ['^build'], outputs: ['dist/**', '.next/**'] },
          },
        },
        null,
        2,
      ),
    },
    { path: 'apps/web/.gitkeep', content: '' },
    { path: 'apps/api/.gitkeep', content: '' },
    { path: 'packages/shared/.gitkeep', content: '' },
  ],
  postScaffoldCommands: ['git init -b main', 'pnpm install'],
};
