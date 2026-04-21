import { z } from 'zod';

export const configSchema = z.object({
  PORT: z.coerce.number().int().default(4100),
  AZURE_SUBSCRIPTION_ID: z.string().min(1),
  AZURE_RESOURCE_GROUP: z.string().default('code-ae-dev'),
  AZURE_LOCATION: z.string().default('uaenorth'),
  AZURE_ACR_LOGIN_SERVER: z.string().min(1),
  AZURE_ACR_USERNAME: z.string().min(1),
  AZURE_ACR_PASSWORD: z.string().min(1),
  SANDBOX_IMAGE: z.string().default('code-ae-sandbox:latest'),
});

export type OrchestratorConfig = z.infer<typeof configSchema>;

export function loadConfig(): OrchestratorConfig {
  return configSchema.parse(process.env);
}
