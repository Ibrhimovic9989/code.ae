import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ForbiddenError, NotFoundError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { StartSandboxUseCase } from '../../sandboxes/application/start-sandbox.usecase';
import { SessionEntity } from '../domain/session.entity';
import { SessionRepository } from '../domain/session.repository';

@Injectable()
export class CreateSessionUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly sessions: SessionRepository,
    private readonly startSandbox: StartSandboxUseCase,
  ) {}

  async execute(projectId: string, ownerId: string): Promise<SessionEntity> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your project');

    const existing = await this.sessions.findActiveByProject(projectId);
    if (existing) return existing;

    const sandbox = await this.startSandbox.execute(projectId, ownerId);

    const now = new Date();
    const session = SessionEntity.create({
      id: randomUUID(),
      projectId,
      status: 'running',
      sandboxId: sandbox.id,
      startedAt: now,
      lastActivityAt: now,
    });
    await this.sessions.save(session);
    return session;
  }
}
