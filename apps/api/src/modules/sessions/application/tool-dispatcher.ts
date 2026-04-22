import { Injectable } from '@nestjs/common';
import { WriteFileUseCase } from '../../workspace/application/write-file.usecase';
import { ReadFileUseCase } from '../../workspace/application/read-file.usecase';
import { ListFilesUseCase } from '../../workspace/application/list-files.usecase';
import { ExecCommandUseCase } from '../../workspace/application/exec-command.usecase';
import { McpRegistry } from '../../mcp/domain/mcp-registry';

export interface ToolContext {
  projectId: string;
  ownerId: string;
}

export interface ToolDispatchResult {
  ok: boolean;
  output: unknown;
  pending?: boolean;
}

@Injectable()
export class ToolDispatcher {
  constructor(
    private readonly writeFile: WriteFileUseCase,
    private readonly readFile: ReadFileUseCase,
    private readonly listFiles: ListFilesUseCase,
    private readonly execCommand: ExecCommandUseCase,
    private readonly mcp: McpRegistry,
  ) {}

  async dispatch(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolDispatchResult> {
    try {
      switch (name) {
        case 'write_file': {
          const res = await this.writeFile.execute(ctx.projectId, ctx.ownerId, input);
          return { ok: true, output: res };
        }
        case 'read_file': {
          const path = String(input['path'] ?? '');
          const res = await this.readFile.execute(ctx.projectId, ctx.ownerId, path);
          return { ok: true, output: res };
        }
        case 'list_files': {
          const path = String(input['path'] ?? '.');
          const res = await this.listFiles.execute(ctx.projectId, ctx.ownerId, path);
          return { ok: true, output: res };
        }
        case 'exec': {
          const res = await this.execCommand.execute(ctx.projectId, ctx.ownerId, input);
          return { ok: true, output: res };
        }
        case 'ask_user': {
          return { ok: true, pending: true, output: null };
        }
        default: {
          if (this.mcp.isMcpToolName(name)) {
            const result = await this.mcp.callTool(name, input, { projectId: ctx.projectId });
            return { ok: result.ok, output: result.output };
          }
          return { ok: false, output: { error: `Unknown tool: ${name}` } };
        }
      }
    } catch (err) {
      return {
        ok: false,
        output: { error: err instanceof Error ? err.message : String(err) },
      };
    }
  }
}
