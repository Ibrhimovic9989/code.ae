import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ValidationError } from '@code-ae/shared';
import { SandboxAgentClient } from '../domain/sandbox-agent.client';
import { ResolveActiveSandbox } from './resolve-active-sandbox';
import { ProjectFileRepository } from '../domain/project-file.repository';
import { WorkspaceFileStore } from '../../../infrastructure/workspace-file-store/workspace-file-store.service';
import { isPersistablePath } from './persistable-path';

export const WriteFileSchema = z.object({
  path: z.string().min(1).max(2048),
  content: z.string().max(5_000_000),
  encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
});
export type WriteFileInput = z.infer<typeof WriteFileSchema>;

@Injectable()
export class WriteFileUseCase {
  private readonly logger = new Logger(WriteFileUseCase.name);

  constructor(
    private readonly resolve: ResolveActiveSandbox,
    private readonly agent: SandboxAgentClient,
    private readonly fileStore: WorkspaceFileStore,
    private readonly fileIndex: ProjectFileRepository,
  ) {}

  async execute(projectId: string, ownerId: string, raw: unknown): Promise<{ path: string; bytes: number }> {
    const parsed = WriteFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid write input', parsed.error.flatten().fieldErrors);
    }
    const endpoint = await this.resolve.execute(projectId, ownerId);

    // Persist BEFORE the live-sandbox write. The persistence is the source of
    // truth — if the sandbox-side write fails, we still keep the user's bytes
    // safe for the next materialize. (The reverse order would risk losing
    // changes when a flaky sandbox swallows the call.)
    if (isPersistablePath(parsed.data.path)) {
      try {
        const buf =
          parsed.data.encoding === 'base64'
            ? Buffer.from(parsed.data.content, 'base64')
            : Buffer.from(parsed.data.content, 'utf-8');
        const { etag, size } = await this.fileStore.put(projectId, parsed.data.path, buf);
        await this.fileIndex.upsert({ projectId, path: parsed.data.path, etag, size });
      } catch (err) {
        // Don't block the write on persistence — log and continue. A user
        // shouldn't lose typing speed because Blob is degraded.
        this.logger.warn(
          `persist write failed (project=${projectId} path=${parsed.data.path}): ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return this.agent.writeFile(endpoint, parsed.data);
  }
}
