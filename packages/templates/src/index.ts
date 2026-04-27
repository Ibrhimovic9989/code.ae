import type { ProjectTemplate } from '@code-ae/shared';

export interface TemplateFile {
  path: string;
  content: string;
}

export interface TemplateManifest {
  id: ProjectTemplate;
  name: string;
  description: string;
  files: TemplateFile[];
  postScaffoldCommands: string[];
}

export { nextNestMonorepoTemplate } from './next-nest-monorepo';
export { blankTemplate } from './blank';

import type { TemplateManifest as T } from './index';
import { nextNestMonorepoTemplate } from './next-nest-monorepo';
import { blankTemplate } from './blank';

// Template files are intent-hints — the agent picks the actual stack
// (Vite, Next, etc.) based on the user's prompt. The TEMPLATES map is
// kept as a fallback for callers that need a starter file set, but the
// preferred path is "scaffold from the agent's first turn".
export const TEMPLATES: Record<ProjectTemplate, T> = {
  // Intent-based, currently shown in the dashboard:
  'web-app': blankTemplate,
  'web-app-with-api': blankTemplate,
  blank: blankTemplate,
  // Legacy (still in the schema for backwards compat with existing rows):
  'next-nest-monorepo': nextNestMonorepoTemplate,
  'next-only': nextNestMonorepoTemplate,
  'nest-only': nextNestMonorepoTemplate,
};
