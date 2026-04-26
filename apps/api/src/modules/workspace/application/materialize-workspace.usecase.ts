import { Injectable, Logger } from '@nestjs/common';
import type { SandboxAgentEndpoint } from '../domain/sandbox-agent.client';
import { SandboxAgentClient } from '../domain/sandbox-agent.client';
import { ProjectFileRepository } from '../domain/project-file.repository';
import { WorkspaceFileStore } from '../../../infrastructure/workspace-file-store/workspace-file-store.service';

export interface MaterializeResult {
  filesRestored: number;
  bytesRestored: number;
  failed: number;
  tookMs: number;
}

/**
 * Hydrate a fresh sandbox's workspace from the persistent Postgres index +
 * Azure Blob bytes. Called by StartSandboxUseCase right after the container
 * comes up; idempotent so repeated calls on a non-empty sandbox are safe.
 *
 * Concurrency: writes happen in parallel against the sandbox-agent (which
 * is fine — agent's writeFile is per-path serialised on its end).
 */
@Injectable()
export class MaterializeWorkspaceUseCase {
  private readonly logger = new Logger(MaterializeWorkspaceUseCase.name);
  private readonly concurrency = 12;

  constructor(
    private readonly agent: SandboxAgentClient,
    private readonly fileStore: WorkspaceFileStore,
    private readonly fileIndex: ProjectFileRepository,
  ) {}

  async execute(projectId: string, endpoint: SandboxAgentEndpoint): Promise<MaterializeResult> {
    const started = Date.now();
    const rows = await this.fileIndex.listByProject(projectId);
    if (rows.length === 0) {
      return { filesRestored: 0, bytesRestored: 0, failed: 0, tookMs: 0 };
    }

    let restored = 0;
    let bytes = 0;
    let failed = 0;

    const queue = [...rows];
    const workers = Array.from({ length: Math.min(this.concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const row = queue.shift();
        if (!row) break;
        try {
          const buf = await this.fileStore.get(projectId, row.path);
          await this.agent.writeFile(endpoint, {
            path: row.path,
            content: buf.toString('base64'),
            encoding: 'base64',
          });
          restored += 1;
          bytes += row.size;
        } catch (err) {
          failed += 1;
          this.logger.warn(
            `materialize failed (project=${projectId} path=${row.path}): ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    });
    await Promise.all(workers);

    const tookMs = Date.now() - started;
    this.logger.log(
      `materialize: project=${projectId} restored=${restored} failed=${failed} bytes=${bytes} took=${tookMs}ms`,
    );
    return { filesRestored: restored, bytesRestored: bytes, failed, tookMs };
  }
}
