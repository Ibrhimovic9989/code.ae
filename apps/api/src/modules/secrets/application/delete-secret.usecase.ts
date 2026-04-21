import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { SecretRepository, SecretStore } from '../domain/secret.repository';

@Injectable()
export class DeleteSecretUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly secrets: SecretRepository,
    private readonly store: SecretStore,
  ) {}

  async execute(secretId: string, ownerId: string): Promise<void> {
    const secret = await this.secrets.findById(secretId);
    if (!secret) throw new NotFoundError('Secret', secretId);

    const project = await this.projects.findById(secret.projectId);
    if (!project) throw new NotFoundError('Project', secret.projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your secret');

    await this.store.delete(secret.keyVaultRef);
    await this.secrets.delete(secret.id);
  }
}
