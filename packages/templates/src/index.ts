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

export const TEMPLATES: Record<ProjectTemplate, T> = {
  'next-nest-monorepo': nextNestMonorepoTemplate,
  'next-only': nextNestMonorepoTemplate,
  'nest-only': nextNestMonorepoTemplate,
  blank: blankTemplate,
};
