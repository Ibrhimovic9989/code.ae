import { Injectable } from '@nestjs/common';
import { SandboxAgentClient } from '../domain/sandbox-agent.client';
import { ResolveActiveSandbox } from './resolve-active-sandbox';

@Injectable()
export class DeleteFileUseCase {
  constructor(
    private readonly resolve: ResolveActiveSandbox,
    private readonly agent: SandboxAgentClient,
  ) {}

  async execute(projectId: string, ownerId: string, path: string, recursive: boolean): Promise<void> {
    const endpoint = await this.resolve.execute(projectId, ownerId);
    await this.agent.deleteFile(endpoint, path, recursive);
  }
}
