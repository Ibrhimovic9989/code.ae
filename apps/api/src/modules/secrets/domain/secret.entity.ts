import type { SecretScope } from '@code-ae/shared';

export interface SecretProps {
  id: string;
  projectId: string;
  key: string;
  scope: SecretScope;
  keyVaultRef: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SecretEntity {
  private constructor(private props: SecretProps) {}

  static create(props: SecretProps): SecretEntity {
    return new SecretEntity(props);
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get key(): string {
    return this.props.key;
  }

  get scope(): SecretScope {
    return this.props.scope;
  }

  get keyVaultRef(): string {
    return this.props.keyVaultRef;
  }

  touch(): void {
    this.props.updatedAt = new Date();
  }

  toObject(): SecretProps {
    return { ...this.props };
  }

  /** Metadata only — no value. Values live in Key Vault and are never returned here. */
  toPublic() {
    return {
      id: this.props.id,
      projectId: this.props.projectId,
      key: this.props.key,
      scope: this.props.scope,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
