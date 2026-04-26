import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ValidationError } from '@code-ae/shared';
import { SandboxAgentClient } from '../domain/sandbox-agent.client';
import { ResolveActiveSandbox } from './resolve-active-sandbox';
import { ProjectFileRepository } from '../domain/project-file.repository';
import { WorkspaceFileStore } from '../../../infrastructure/workspace-file-store/workspace-file-store.service';
import { isPersistablePath } from './persistable-path';

export const MoveFileSchema = z.object({
  from: z.string().min(1).max(2048),
  to: z.string().min(1).max(2048),
  overwrite: z.boolean().default(false),
});

@Injectable()
export class MoveFileUseCase {
  private readonly logger = new Logger(MoveFileUseCase.name);

  constructor(
    private readonly resolve: ResolveActiveSandbox,
    private readonly agent: SandboxAgentClient,
    private readonly fileStore: WorkspaceFileStore,
    private readonly fileIndex: ProjectFileRepository,
  ) {}

  async execute(projectId: string, ownerId: string, raw: unknown): Promise<void> {
    const parsed = MoveFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid move input', parsed.error.flatten().fieldErrors);
    }
    const endpoint = await this.resolve.execute(projectId, ownerId);
    await this.agent.moveFile(endpoint, parsed.data.from, parsed.data.to, parsed.data.overwrite);

    // Persist the rename. Only matters if the source was indexed in the
    // first place (i.e. wasn't a node_modules/etc path).
    if (isPersistablePath(parsed.data.from) && isPersistablePath(parsed.data.to)) {
      try {
        const existing = await this.fileIndex.findOne(projectId, parsed.data.from);
        if (existing) {
          const { etag } = await this.fileStore.move(projectId, parsed.data.from, parsed.data.to);
          await this.fileIndex.rename(projectId, parsed.data.from, parsed.data.to, etag);
        }
      } catch (err) {
        this.logger.warn(
          `persist move failed (project=${projectId} ${parsed.data.from} → ${parsed.data.to}): ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }
  }
}
