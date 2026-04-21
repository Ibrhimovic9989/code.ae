import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { SandboxRepository } from '../domain/sandbox.repository';
import { OrchestratorClient } from '../domain/orchestrator-client';
import { SandboxEntity } from '../domain/sandbox.entity';

@Injectable()
export class GetSandboxUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly sandboxes: SandboxRepository,
    private readonly orchestrator: OrchestratorClient,
  ) {}

  async execute(projectId: string, ownerId: string): Promise<SandboxEntity | null> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your project');

    const local = await this.sandboxes.findActiveByProject(projectId);
    if (!local) return null;

    const remote = await this.orchestrator.getSandbox(local.id);
    if (!remote) {
      local.markStopped();
      await this.sandboxes.save(local);
      return local;
    }

    local.updateStatus(remote.status, remote.previewUrl ?? null);
    await this.sandboxes.save(local);
    return local;
  }
}
