import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError, SandboxSpecSchema } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { SandboxRepository } from '../domain/sandbox.repository';
import { OrchestratorClient } from '../domain/orchestrator-client';
import { SandboxEntity } from '../domain/sandbox.entity';

@Injectable()
export class StartSandboxUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly sandboxes: SandboxRepository,
    private readonly orchestrator: OrchestratorClient,
  ) {}

  async execute(projectId: string, ownerId: string): Promise<SandboxEntity> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your project');

    const existing = await this.sandboxes.findActiveByProject(projectId);
    if (existing) return existing;

    const spec = SandboxSpecSchema.parse({
      projectId,
      image: 'code-ae-sandbox:latest',
      cpuCores: 1,
      memoryGb: 2,
      envRefs: [],
      ports: [3000, 4000],
      idleTimeoutSeconds: 600,
    });

    const created = await this.orchestrator.createSandbox(spec);

    const sandbox = SandboxEntity.create({
      id: created.id,
      projectId,
      status: created.status,
      previewUrl: created.previewUrl ?? null,
      createdAt: created.createdAt,
      stoppedAt: null,
    });
    await this.sandboxes.save(sandbox);

    return sandbox;
  }
}
