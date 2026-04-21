import { z } from 'zod';

export const SecretScopeSchema = z.enum(['development', 'production']);
export type SecretScope = z.infer<typeof SecretScopeSchema>;

export const SecretSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  key: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Env keys must be UPPER_SNAKE_CASE'),
  scope: SecretScopeSchema,
  keyVaultRef: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Secret = z.infer<typeof SecretSchema>;

export const UpsertSecretSchema = z.object({
  key: SecretSchema.shape.key,
  value: z.string().min(1).max(10_000),
  scope: SecretScopeSchema,
});
export type UpsertSecretInput = z.infer<typeof UpsertSecretSchema>;
