import { Injectable } from '@nestjs/common';
import { SandboxAgentClient, type ReadFileResult } from '../domain/sandbox-agent.client';
import { ResolveActiveSandbox } from './resolve-active-sandbox';

@Injectable()
export class ReadFileUseCase {
  constructor(
    private readonly resolve: ResolveActiveSandbox,
    private readonly agent: SandboxAgentClient,
  ) {}

  async execute(
    projectId: string,
    ownerId: string,
    path: string,
    encoding: 'utf-8' | 'base64' = 'utf-8',
  ): Promise<ReadFileResult> {
    const endpoint = await this.resolve.execute(projectId, ownerId);
    return this.agent.readFile(endpoint, path, encoding);
  }
}
