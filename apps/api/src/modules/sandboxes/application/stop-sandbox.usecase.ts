import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { SandboxRepository } from '../domain/sandbox.repository';
import { OrchestratorClient } from '../domain/orchestrator-client';

@Injectable()
export class StopSandboxUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly sandboxes: SandboxRepository,
    private readonly orchestrator: OrchestratorClient,
  ) {}

  async execute(projectId: string, ownerId: string): Promise<void> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your project');

    const sandbox = await this.sandboxes.findActiveByProject(projectId);
    if (!sandbox) return;

    await this.orchestrator.stopSandbox(sandbox.id);
    sandbox.markStopped();
    await this.sandboxes.save(sandbox);
  }
}
