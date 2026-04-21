import { Injectable, Logger } from '@nestjs/common';
import type { SecretScope } from '@code-ae/shared';
import { SecretRepository, SecretStore } from '../domain/secret.repository';

@Injectable()
export class ResolveSecretsForSandboxUseCase {
  private readonly logger = new Logger(ResolveSecretsForSandboxUseCase.name);

  constructor(
    private readonly secrets: SecretRepository,
    private readonly store: SecretStore,
  ) {}

  async execute(projectId: string, scope: SecretScope = 'development'): Promise<Record<string, string>> {
    const entries = await this.secrets.listByProject(projectId, scope);
    const env: Record<string, string> = {};
    await Promise.all(
      entries.map(async (entry) => {
        try {
          const value = await this.store.get(entry.keyVaultRef);
          if (value !== null) env[entry.key] = value;
        } catch (err) {
          this.logger.warn(
            `Failed to resolve secret ${entry.key} (${entry.keyVaultRef}): ${err instanceof Error ? err.message : err}`,
          );
        }
      }),
    );
    return env;
  }
}
