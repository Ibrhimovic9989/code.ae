import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/interfaces/http/jwt-auth.guard';
import { CurrentUser } from '../../../auth/interfaces/http/current-user.decorator';
import type { AccessTokenPayload } from '../../../auth/infrastructure/jwt.service';
import { WriteFileUseCase } from '../../application/write-file.usecase';
import { ReadFileUseCase } from '../../application/read-file.usecase';
import { ListFilesUseCase } from '../../application/list-files.usecase';
import { DeleteFileUseCase } from '../../application/delete-file.usecase';
import { ExecCommandUseCase } from '../../application/exec-command.usecase';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(
    private readonly writeFile: WriteFileUseCase,
    private readonly readFile: ReadFileUseCase,
    private readonly listFiles: ListFilesUseCase,
    private readonly deleteFile: DeleteFileUseCase,
    private readonly execCommand: ExecCommandUseCase,
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

  @Post('exec')
  async exec(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: unknown,
  ) {
    return this.execCommand.execute(projectId, user.sub, body);
  }
}
