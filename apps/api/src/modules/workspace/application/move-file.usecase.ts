import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ValidationError } from '@code-ae/shared';
import { SandboxAgentClient } from '../domain/sandbox-agent.client';
import { ResolveActiveSandbox } from './resolve-active-sandbox';

export const MoveFileSchema = z.object({
  from: z.string().min(1).max(2048),
  to: z.string().min(1).max(2048),
  overwrite: z.boolean().default(false),
});

@Injectable()
export class MoveFileUseCase {
  constructor(
    private readonly resolve: ResolveActiveSandbox,
    private readonly agent: SandboxAgentClient,
  ) {}

  async execute(projectId: string, ownerId: string, raw: unknown): Promise<void> {
    const parsed = MoveFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid move input', parsed.error.flatten().fieldErrors);
    }
    const endpoint = await this.resolve.execute(projectId, ownerId);
    await this.agent.moveFile(endpoint, parsed.data.from, parsed.data.to, parsed.data.overwrite);
  }
}
