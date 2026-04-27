import { z } from 'zod';

export const ProjectVisibilitySchema = z.enum(['private', 'unlisted', 'public']);
export type ProjectVisibility = z.infer<typeof ProjectVisibilitySchema>;

/**
 * Templates are intent-hints, not stack lock-ins. The agent reads the
 * user's first prompt + this template and picks the actual tech stack
 * (Vite, Next, etc.) per the system prompt's stack-selection rules.
 *
 * Legacy values (next-nest-monorepo / next-only / nest-only) are kept
 * for backwards compatibility with existing rows; new dashboards should
 * only show the intent-based options.
 */
export const ProjectTemplateSchema = z.enum([
  // New, intent-based options shown in the create dialog:
  'web-app',
  'web-app-with-api',
  'blank',
  // Legacy stack-coded values (still valid in the DB):
  'next-nest-monorepo',
  'next-only',
  'nest-only',
]);
export type ProjectTemplate = z.infer<typeof ProjectTemplateSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  slug: z
    .string()
    .min(3)
    .max(48)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
  template: ProjectTemplateSchema,
  visibility: ProjectVisibilitySchema,
  // All three integrations are `string | null` in Postgres; nullish() accepts
  // both `null` (what the API serializes) and `undefined` (for optional).
  githubRepoUrl: z.string().url().nullish(),
  vercelProjectId: z.string().nullish(),
  vercelDeploymentUrl: z.string().nullish(),
  supabaseProjectRef: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectSchema = ProjectSchema.pick({
  slug: true,
  name: true,
  description: true,
  template: true,
  visibility: true,
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
