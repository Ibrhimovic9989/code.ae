import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply } from 'fastify';
import { ValidationError } from '@code-ae/shared';
import { JwtAuthGuard } from '../../../auth/interfaces/http/jwt-auth.guard';
import { CurrentUser } from '../../../auth/interfaces/http/current-user.decorator';
import type { AccessTokenPayload } from '../../../auth/infrastructure/jwt.service';
import { JwtAuthService } from '../../../auth/infrastructure/jwt.service';
import { StartGitHubOAuthUseCase } from '../../application/start-oauth.usecase';
import { CompleteGitHubOAuthUseCase } from '../../application/complete-oauth.usecase';
import { GetGitHubIntegrationUseCase } from '../../application/get-integration.usecase';
import { PushWorkspaceUseCase } from '../../application/push-workspace.usecase';
import { RestoreFromGitHubUseCase } from '../../application/restore-from-github.usecase';
import type { AppConfig } from '../../../../config/app.config';

@Controller()
export class GitHubController {
  constructor(
    private readonly start: StartGitHubOAuthUseCase,
    private readonly complete: CompleteGitHubOAuthUseCase,
    private readonly getIntegration: GetGitHubIntegrationUseCase,
    private readonly push: PushWorkspaceUseCase,
    private readonly restore: RestoreFromGitHubUseCase,
    private readonly jwt: JwtAuthService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Get('auth/github/start')
  @UseGuards(JwtAuthGuard)
  async startOAuth(@CurrentUser() user: AccessTokenPayload) {
    return this.start.execute(user.sub);
  }

  @Get('auth/github/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!code || !state) throw new ValidationError('Missing code or state');
    const userId = state.split('.')[1];
    if (!userId) throw new ValidationError('Malformed state');

    await this.complete.execute(code, state, userId);
    const redirect = this.config.get('GITHUB_OAUTH_POST_REDIRECT', { infer: true });
    reply.redirect(`${redirect}?github=connected`, 302);
  }

  @Get('auth/github')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AccessTokenPayload) {
    const integration = await this.getIntegration.execute(user.sub);
    return { integration: integration?.toPublic() ?? null };
  }

  @Post('projects/:projectId/github/push')
  @UseGuards(JwtAuthGuard)
  async pushRepo(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: { repoName?: string; privateRepo?: boolean; commitMessage?: string } | undefined,
  ) {
    const result = await this.push.execute({
      projectId,
      ownerId: user.sub,
      ...(body?.repoName ? { repoName: body.repoName } : {}),
      ...(body?.privateRepo !== undefined ? { privateRepo: body.privateRepo } : {}),
      ...(body?.commitMessage ? { commitMessage: body.commitMessage } : {}),
    });
    return { ok: true, ...result };
  }

  @Post('projects/:projectId/github/restore')
  @UseGuards(JwtAuthGuard)
  async restoreRepo(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.restore.execute(projectId, user.sub);
  }
}
