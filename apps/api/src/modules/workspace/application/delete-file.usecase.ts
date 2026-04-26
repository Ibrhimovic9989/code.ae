import { Injectable, Logger } from '@nestjs/common';
import { SandboxAgentClient } from '../domain/sandbox-agent.client';
import { ResolveActiveSandbox } from './resolve-active-sandbox';
import { ProjectFileRepository } from '../domain/project-file.repository';
import { WorkspaceFileStore } from '../../../infrastructure/workspace-file-store/workspace-file-store.service';

@Injectable()
export class DeleteFileUseCase {
  private readonly logger = new Logger(DeleteFileUseCase.name);

  constructor(
    private readonly resolve: ResolveActiveSandbox,
    private readonly agent: SandboxAgentClient,
    private readonly fileStore: WorkspaceFileStore,
    private readonly fileIndex: ProjectFileRepository,
  ) {}

  async execute(projectId: string, ownerId: string, path: string, recursive: boolean): Promise<void> {
    const endpoint = await this.resolve.execute(projectId, ownerId);
    await this.agent.deleteFile(endpoint, path, recursive);

    // Mirror the delete to persistent storage. For recursive deletes, we
    // remove every index row whose path matches OR starts with `path/`.
    try {
      if (recursive) {
        const all = await this.fileIndex.listByProject(projectId);
        const prefix = path.replace(/\/$/, '') + '/';
        const matches = all.filter((r) => r.path === path || r.path.startsWith(prefix));
        await Promise.all(
          matches.map(async (m) => {
            await this.fileStore.delete(projectId, m.path);
            await this.fileIndex.delete(projectId, m.path);
          }),
        );
      } else {
        await this.fileStore.delete(projectId, path);
        await this.fileIndex.delete(projectId, path);
      }
    } catch (err) {
      this.logger.warn(
        `persist delete failed (project=${projectId} path=${path}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
