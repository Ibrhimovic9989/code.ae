import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ForbiddenError, NotFoundError, UpsertSecretSchema, ValidationError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { SecretEntity } from '../domain/secret.entity';
import { SecretRepository, SecretStore } from '../domain/secret.repository';

@Injectable()
export class UpsertSecretUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly secrets: SecretRepository,
    private readonly store: SecretStore,
  ) {}

  async execute(projectId: string, ownerId: string, raw: unknown): Promise<SecretEntity> {
    const parsed = UpsertSecretSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid secret input', parsed.error.flatten().fieldErrors);
    }

    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your project');

    const { key, value, scope } = parsed.data;
    const existing = await this.secrets.findByKey(projectId, key, scope);

    const now = new Date();
    const entity = existing
      ? existing
      : SecretEntity.create({
          id: randomUUID(),
          projectId,
          key,
          scope,
          keyVaultRef: buildRef(projectId, scope, key),
          createdAt: now,
          updatedAt: now,
        });

    await this.store.set(entity.keyVaultRef, value);
    if (existing) entity.touch();
    await this.secrets.save(entity);
    return entity;
  }
}

function buildRef(projectId: string, scope: string, key: string): string {
  // KV names must match ^[0-9a-zA-Z-]+$ and are case-insensitive.
  const safeProject = projectId.replace(/[^0-9a-zA-Z-]/g, '').slice(0, 20);
  const safeKey = key.replace(/[^0-9a-zA-Z-]/g, '-').slice(0, 60);
  return `proj-${safeProject}-${scope}-${safeKey}`;
}
