import type { SecretScope } from '@code-ae/shared';
import type { SecretEntity } from './secret.entity';

export abstract class SecretRepository {
  abstract findById(id: string): Promise<SecretEntity | null>;
  abstract findByKey(projectId: string, key: string, scope: SecretScope): Promise<SecretEntity | null>;
  abstract listByProject(projectId: string, scope?: SecretScope): Promise<SecretEntity[]>;
  abstract save(secret: SecretEntity): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

/** Holds the actual secret value. In prod this is Azure Key Vault. */
export abstract class SecretStore {
  abstract set(ref: string, value: string): Promise<void>;
  abstract get(ref: string): Promise<string | null>;
  abstract delete(ref: string): Promise<void>;
}
