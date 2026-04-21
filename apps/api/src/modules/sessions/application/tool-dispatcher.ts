import { Injectable } from '@nestjs/common';
import { WriteFileUseCase } from '../../workspace/application/write-file.usecase';
import { ReadFileUseCase } from '../../workspace/application/read-file.usecase';
import { ListFilesUseCase } from '../../workspace/application/list-files.usecase';
import { ExecCommandUseCase } from '../../workspace/application/exec-command.usecase';

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
          // Pending — the user answers via a form; we'll persist the tool result
          // on the next POST in toolResponses[]. We don't execute anything here.
          return { ok: true, pending: true, output: null };
        }
        default:
          return { ok: false, output: { error: `Unknown tool: ${name}` } };
      }
    } catch (err) {
      return {
        ok: false,
        output: { error: err instanceof Error ? err.message : String(err) },
      };
    }
  }
}
