import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ValidationError } from '@code-ae/shared';
import { SandboxAgentClient } from '../domain/sandbox-agent.client';
import { ResolveActiveSandbox } from './resolve-active-sandbox';

export const WriteFileSchema = z.object({
  path: z.string().min(1).max(2048),
  content: z.string().max(5_000_000),
  encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
});
export type WriteFileInput = z.infer<typeof WriteFileSchema>;

@Injectable()
export class WriteFileUseCase {
  constructor(
    private readonly resolve: ResolveActiveSandbox,
    private readonly agent: SandboxAgentClient,
  ) {}

  async execute(projectId: string, ownerId: string, raw: unknown): Promise<{ path: string; bytes: number }> {
    const parsed = WriteFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid write input', parsed.error.flatten().fieldErrors);
    }
    const endpoint = await this.resolve.execute(projectId, ownerId);
    return this.agent.writeFile(endpoint, parsed.data);
  }
}
