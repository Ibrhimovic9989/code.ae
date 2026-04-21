import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { SandboxError } from '@code-ae/shared';
import { SecretStore } from '../domain/secret.repository';
import type { AppConfig } from '../../../config/app.config';

@Injectable()
export class KeyVaultSecretStore extends SecretStore {
  private readonly logger = new Logger(KeyVaultSecretStore.name);
  private readonly client: SecretClient | null;

  constructor(config: ConfigService<AppConfig, true>) {
    super();
    const url = config.get('AZURE_KEY_VAULT_URL', { infer: true });
    if (!url) {
      this.logger.warn('AZURE_KEY_VAULT_URL not set; secret store will fail at use');
      this.client = null;
    } else {
      this.client = new SecretClient(url, new DefaultAzureCredential());
    }
  }

  async set(ref: string, value: string): Promise<void> {
    await this.requireClient().setSecret(ref, value);
  }

  async get(ref: string): Promise<string | null> {
    try {
      const res = await this.requireClient().getSecret(ref);
      return res.value ?? null;
    } catch (err) {
      if (err instanceof Error && /not found/i.test(err.message)) return null;
      throw new SandboxError(`Key Vault get failed for ${ref}: ${err instanceof Error ? err.message : err}`);
    }
  }

  async delete(ref: string): Promise<void> {
    try {
      const poller = await this.requireClient().beginDeleteSecret(ref);
      await poller.pollUntilDone();
    } catch (err) {
      if (err instanceof Error && /not found/i.test(err.message)) return;
      throw new SandboxError(`Key Vault delete failed for ${ref}: ${err instanceof Error ? err.message : err}`);
    }
  }

  private requireClient(): SecretClient {
    if (!this.client) {
      throw new SandboxError('Azure Key Vault not configured (AZURE_KEY_VAULT_URL missing)');
    }
    return this.client;
  }
}
