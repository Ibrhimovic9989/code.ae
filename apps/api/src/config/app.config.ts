import { z } from 'zod';

export const appConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ORCHESTRATOR_URL: z.string().url().default('http://localhost:4100'),
  AZURE_KEY_VAULT_URL: z.string().url().optional(),

  AZURE_OPENAI_ENDPOINT: z.string().url(),
  AZURE_OPENAI_API_KEY: z.string().min(1),
  AZURE_OPENAI_DEPLOYMENT: z.string().default('gpt-5.2-chat'),
  AZURE_OPENAI_API_VERSION: z.string().default('2025-04-01-preview'),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
