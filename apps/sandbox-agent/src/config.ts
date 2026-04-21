import { z } from 'zod';

export const configSchema = z.object({
  PORT: z.coerce.number().int().default(4200),
  SANDBOX_TOKEN: z.string().min(16),
  WORKSPACE_ROOT: z.string().default('/home/workspace/project'),
  SHELL_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600_000).default(120_000),
});

export type AgentConfig = z.infer<typeof configSchema>;

export function loadConfig(): AgentConfig {
  return configSchema.parse(process.env);
}
