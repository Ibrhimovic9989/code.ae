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

  GITHUB_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_OAUTH_REDIRECT_URL: z.string().url().default('http://localhost:4000/api/v1/auth/github/callback'),
  GITHUB_OAUTH_POST_REDIRECT: z.string().url().default('http://localhost:3000/dashboard'),

  MAGIC_MCP_API_KEY: z.string().min(1).optional(),

  /// Azure Blob storage account URL for the per-project workspace files.
  /// Auth is via the API container app's managed identity (Storage Blob Data
  /// Contributor on the storage account).
  WORKSPACE_FILES_ACCOUNT_URL: z.string().url(),
  WORKSPACE_FILES_CONTAINER: z.string().default('workspace-files'),

  /// The API's own public origin (HTTPS), used to compute per-project preview
  /// proxy URLs that we inject into sandbox env so the agent can pass a
  /// correct `emailRedirectTo` to Supabase. Falls back to localhost in dev.
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
