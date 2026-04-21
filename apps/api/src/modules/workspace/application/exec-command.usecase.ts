import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ValidationError } from '@code-ae/shared';
import { SandboxAgentClient, type ExecResult } from '../domain/sandbox-agent.client';
import { ResolveActiveSandbox } from './resolve-active-sandbox';

export const ExecCommandSchema = z.object({
  command: z.string().min(1).max(8000),
  cwd: z.string().default('.'),
  timeoutMs: z.number().int().min(1000).max(600_000).optional(),
});
export type ExecCommandInput = z.infer<typeof ExecCommandSchema>;

@Injectable()
export class ExecCommandUseCase {
  constructor(
    private readonly resolve: ResolveActiveSandbox,
    private readonly agent: SandboxAgentClient,
  ) {}

  async execute(projectId: string, ownerId: string, raw: unknown): Promise<ExecResult> {
    const parsed = ExecCommandSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid exec input', parsed.error.flatten().fieldErrors);
    }
    const endpoint = await this.resolve.execute(projectId, ownerId);
    return this.agent.exec(endpoint, {
      command: parsed.data.command,
      cwd: parsed.data.cwd,
      ...(parsed.data.timeoutMs !== undefined ? { timeoutMs: parsed.data.timeoutMs } : {}),
    });
  }
}
