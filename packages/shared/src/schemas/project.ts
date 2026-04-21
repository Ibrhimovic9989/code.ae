import { z } from 'zod';

export const ProjectVisibilitySchema = z.enum(['private', 'unlisted', 'public']);
export type ProjectVisibility = z.infer<typeof ProjectVisibilitySchema>;

export const ProjectTemplateSchema = z.enum([
  'next-nest-monorepo',
  'next-only',
  'nest-only',
  'blank',
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
  description: z.string().max(500).optional(),
  template: ProjectTemplateSchema,
  visibility: ProjectVisibilitySchema,
  githubRepoUrl: z.string().url().optional(),
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
