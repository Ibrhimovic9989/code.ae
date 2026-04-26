import { z } from 'zod';

export const configSchema = z.object({
  PORT: z.coerce.number().int().default(4200),
  SANDBOX_TOKEN: z.string().min(16),
  WORKSPACE_ROOT: z.string().default('/home/workspace/project'),
  // Bumped from 120s → 300s. Heal/warm-up recipes commonly run a 120-second
  // probe loop AFTER kicking the dev server; the old 120s ceiling SIGKILLed
  // the parent bash mid-loop, killing the warm-up output and tricking the
  // chat agent into "the sandbox is unstable" misdiagnoses. Process groups
  // detached via setsid still survive the parent's death, but the warm-up
  // result we want to surface gets lost.
  SHELL_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600_000).default(300_000),
});

export type AgentConfig = z.infer<typeof configSchema>;

export function loadConfig(): AgentConfig {
  return configSchema.parse(process.env);
}
