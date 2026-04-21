import { Injectable } from '@nestjs/common';
import { SandboxAgentClient, type ListResult } from '../domain/sandbox-agent.client';
import { ResolveActiveSandbox } from './resolve-active-sandbox';

@Injectable()
export class ListFilesUseCase {
  constructor(
    private readonly resolve: ResolveActiveSandbox,
    private readonly agent: SandboxAgentClient,
  ) {}

  async execute(projectId: string, ownerId: string, path: string = '.'): Promise<ListResult> {
    const endpoint = await this.resolve.execute(projectId, ownerId);
    return this.agent.listFiles(endpoint, path);
  }
}
