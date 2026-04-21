import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../../auth/interfaces/http/jwt-auth.guard';
import { CurrentUser } from '../../../auth/interfaces/http/current-user.decorator';
import type { AccessTokenPayload } from '../../../auth/infrastructure/jwt.service';
import { WriteFileUseCase } from '../../application/write-file.usecase';
import { ReadFileUseCase } from '../../application/read-file.usecase';
import { ListFilesUseCase } from '../../application/list-files.usecase';
import { DeleteFileUseCase } from '../../application/delete-file.usecase';
import { MoveFileUseCase } from '../../application/move-file.usecase';
import { ExecCommandUseCase } from '../../application/exec-command.usecase';
import { StreamCommandUseCase } from '../../application/stream-command.usecase';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(
    private readonly writeFile: WriteFileUseCase,
    private readonly readFile: ReadFileUseCase,
    private readonly listFiles: ListFilesUseCase,
    private readonly deleteFile: DeleteFileUseCase,
    private readonly moveFile: MoveFileUseCase,
    private readonly execCommand: ExecCommandUseCase,
    private readonly streamCommand: StreamCommandUseCase,
  ) {}

  @Post('files')
  async write(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: unknown,
  ) {
    return this.writeFile.execute(projectId, user.sub, body);
  }

  @Get('files')
  async read(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Query('path') path: string,
    @Query('encoding') encoding?: 'utf-8' | 'base64',
  ) {
    return this.readFile.execute(projectId, user.sub, path, encoding ?? 'utf-8');
  }

  @Get('files/list')
  async list(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Query('path') path?: string,
  ) {
    return this.listFiles.execute(projectId, user.sub, path ?? '.');
  }

  @Delete('files')
  async delete(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Query('path') path: string,
    @Query('recursive') recursive?: string,
  ) {
    await this.deleteFile.execute(projectId, user.sub, path, recursive === 'true');
    return { ok: true };
  }

  @Post('files/move')
  async move(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: unknown,
  ) {
    await this.moveFile.execute(projectId, user.sub, body);
    return { ok: true };
  }

  @Post('exec')
  async exec(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: unknown,
  ) {
    return this.execCommand.execute(projectId, user.sub, body);
  }

  @Post('exec/stream')
  async execStream(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const upstream = await this.streamCommand.execute(projectId, user.sub, body);

    const origin = req.headers.origin;
    if (origin) {
      reply.raw.setHeader('Access-Control-Allow-Origin', origin);
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
      reply.raw.setHeader('Vary', 'Origin');
    }
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders?.();

    if (!upstream.body) {
      reply.raw.end();
      return;
    }

    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        reply.raw.write(value);
      }
    } finally {
      reply.raw.end();
    }
  }
}
