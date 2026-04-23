import { Injectable, Logger } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { SandboxRepository } from '../domain/sandbox.repository';
import { OrchestratorClient } from '../domain/orchestrator-client';

@Injectable()
export class StopSandboxUseCase {
  private readonly logger = new Logger(StopSandboxUseCase.name);

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
    if (!sandbox) {
      this.logger.log(`stop: no active sandbox for project=${projectId}; noop`);
      return;
    }

    this.logger.log(`stop: stopping sandbox id=${sandbox.id} project=${projectId}`);
    try {
      await this.orchestrator.stopSandbox(sandbox.id);
    } catch (err) {
      this.logger.warn(
        `stop: orchestrator.stopSandbox threw for id=${sandbox.id}: ${
          err instanceof Error ? err.message : String(err)
        } — marking row stopped anyway`,
      );
    }
    sandbox.markStopped();
    await this.sandboxes.save(sandbox);
    this.logger.log(`stop: marked sandbox id=${sandbox.id} stopped in DB`);
  }
}
