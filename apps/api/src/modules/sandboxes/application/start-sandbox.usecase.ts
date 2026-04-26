import { Injectable, Logger, Optional } from '@nestjs/common';
import { ForbiddenError, NotFoundError, SandboxSpecSchema } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { SandboxRepository } from '../domain/sandbox.repository';
import { OrchestratorClient } from '../domain/orchestrator-client';
import { SandboxEntity } from '../domain/sandbox.entity';
import { ResolveSecretsForSandboxUseCase } from '../../secrets/application/resolve-secrets-for-sandbox.usecase';
import { MaterializeWorkspaceUseCase } from '../../workspace/application/materialize-workspace.usecase';

@Injectable()
export class StartSandboxUseCase {
  private readonly logger = new Logger(StartSandboxUseCase.name);

  constructor(
    private readonly projects: ProjectRepository,
    private readonly sandboxes: SandboxRepository,
    private readonly orchestrator: OrchestratorClient,
    private readonly resolveSecrets: ResolveSecretsForSandboxUseCase,
    @Optional() private readonly materialize?: MaterializeWorkspaceUseCase,
  ) {}

  async execute(projectId: string, ownerId: string): Promise<SandboxEntity> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your project');

    const existing = await this.sandboxes.findActiveByProject(projectId);
    if (existing) {
      this.logger.log(
        `start: reusing existing sandbox id=${existing.id.slice(0, 20)} status=${
          existing.toObject().status
        } project=${projectId}`,
      );
      return existing;
    }

    this.logger.log(`start: creating new sandbox for project=${projectId}`);
    const env = await this.resolveSecrets.execute(projectId, 'development');

    const spec = SandboxSpecSchema.parse({
      projectId,
      image: 'code-ae-sandbox:latest',
      cpuCores: 1,
      memoryGb: 2,
      envRefs: [],
      env,
      ports: [3000, 4000],
      idleTimeoutSeconds: 600,
    });

    const startedAt = Date.now();
    let created;
    try {
      created = await this.orchestrator.createSandbox(spec);
    } catch (err) {
      this.logger.error(
        `start: orchestrator.createSandbox FAILED for project=${projectId} after ${
          Date.now() - startedAt
        }ms: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
    this.logger.log(
      `start: orchestrator returned sandbox id=${created.id} status=${created.status} previewUrl=${
        created.previewUrl ?? '<none>'
      } agentUrl=${created.agentUrl ?? '<none>'} took=${Date.now() - startedAt}ms`,
    );

    const sandbox = SandboxEntity.create({
      id: created.id,
      projectId,
      status: created.status,
      previewUrl: created.previewUrl ?? null,
      agentUrl: created.agentUrl ?? null,
      agentToken: created.agentToken ?? null,
      createdAt: created.createdAt,
      stoppedAt: null,
    });
    await this.sandboxes.save(sandbox);

    // Materialize the persisted workspace into the fresh container as soon as
    // the agent endpoint is reachable. Best-effort and fire-and-forget — a
    // slow Blob read shouldn't block the start response. The agent's
    // file-write endpoint queues per-path so concurrent calls are safe.
    if (this.materialize && sandbox.toObject().agentUrl && sandbox.toObject().agentToken) {
      const endpoint = {
        baseUrl: sandbox.toObject().agentUrl ?? '',
        token: sandbox.toObject().agentToken ?? '',
      };
      this.materialize.execute(projectId, endpoint).catch((err) => {
        this.logger.warn(
          `materialize after start failed for project=${projectId}: ${err instanceof Error ? err.message : err}`,
        );
      });
    }

    return sandbox;
  }
}
