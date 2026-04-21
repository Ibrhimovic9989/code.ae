import { z } from 'zod';

export const SandboxStatusSchema = z.enum([
  'pending',
  'creating',
  'running',
  'stopping',
  'stopped',
  'failed',
]);
export type SandboxStatus = z.infer<typeof SandboxStatusSchema>;

export const SandboxSpecSchema = z.object({
  projectId: z.string().uuid(),
  image: z.string(),
  cpuCores: z.number().min(0.25).max(4).default(1),
  memoryGb: z.number().min(0.5).max(8).default(2),
  envRefs: z.array(z.string()).default([]),
  ports: z.array(z.number().int().min(1).max(65535)).default([3000, 4000]),
  idleTimeoutSeconds: z.number().int().min(60).max(3600).default(600),
});
export type SandboxSpec = z.infer<typeof SandboxSpecSchema>;

export const SandboxSchema = z.object({
  id: z.string(),
  projectId: z.string().uuid(),
  status: SandboxStatusSchema,
  previewUrl: z.string().url().optional(),
  createdAt: z.date(),
  stoppedAt: z.date().optional(),
});
export type Sandbox = z.infer<typeof SandboxSchema>;
