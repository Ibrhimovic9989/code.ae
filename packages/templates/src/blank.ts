import type { TemplateManifest } from './index';

export const blankTemplate: TemplateManifest = {
  id: 'blank',
  name: 'Blank',
  description: 'Empty repo with git initialized.',
  files: [
    { path: 'README.md', content: '# New Project\n' },
    { path: '.gitignore', content: 'node_modules/\ndist/\n.env\n' },
  ],
  postScaffoldCommands: ['git init -b main'],
};
