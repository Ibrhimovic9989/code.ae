import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/interfaces/http/jwt-auth.guard';
import { CurrentUser } from '../../../auth/interfaces/http/current-user.decorator';
import type { AccessTokenPayload } from '../../../auth/infrastructure/jwt.service';
import { StartSandboxUseCase } from '../../application/start-sandbox.usecase';
import { GetSandboxUseCase } from '../../application/get-sandbox.usecase';
import { StopSandboxUseCase } from '../../application/stop-sandbox.usecase';

@Controller('projects/:projectId/sandbox')
@UseGuards(JwtAuthGuard)
export class SandboxesController {
  constructor(
    private readonly startSandbox: StartSandboxUseCase,
    private readonly getSandbox: GetSandboxUseCase,
    private readonly stopSandbox: StopSandboxUseCase,
  ) {}

  @Post()
  async start(@Param('projectId') projectId: string, @CurrentUser() user: AccessTokenPayload) {
    const sandbox = await this.startSandbox.execute(projectId, user.sub);
    return { sandbox: sandbox.toObject() };
  }

  @Get()
  async get(@Param('projectId') projectId: string, @CurrentUser() user: AccessTokenPayload) {
    const sandbox = await this.getSandbox.execute(projectId, user.sub);
    return { sandbox: sandbox?.toObject() ?? null };
  }

  @Delete()
  async stop(@Param('projectId') projectId: string, @CurrentUser() user: AccessTokenPayload) {
    await this.stopSandbox.execute(projectId, user.sub);
    return { ok: true };
  }
}
