import { Injectable } from '@nestjs/common';
import type { SecretScope } from '@code-ae/shared';
import { ForbiddenError, NotFoundError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { SecretRepository } from '../domain/secret.repository';
import type { SecretEntity } from '../domain/secret.entity';

@Injectable()
export class ListSecretsUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly secrets: SecretRepository,
  ) {}

  async execute(projectId: string, ownerId: string, scope?: SecretScope): Promise<SecretEntity[]> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your project');
    return this.secrets.listByProject(projectId, scope);
  }
}
