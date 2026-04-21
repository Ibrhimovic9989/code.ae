import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { SecretScope } from '@code-ae/shared';
import { JwtAuthGuard } from '../../../auth/interfaces/http/jwt-auth.guard';
import { CurrentUser } from '../../../auth/interfaces/http/current-user.decorator';
import type { AccessTokenPayload } from '../../../auth/infrastructure/jwt.service';
import { UpsertSecretUseCase } from '../../application/upsert-secret.usecase';
import { ListSecretsUseCase } from '../../application/list-secrets.usecase';
import { DeleteSecretUseCase } from '../../application/delete-secret.usecase';

@Controller()
@UseGuards(JwtAuthGuard)
export class SecretsController {
  constructor(
    private readonly upsert: UpsertSecretUseCase,
    private readonly list: ListSecretsUseCase,
    private readonly remove: DeleteSecretUseCase,
  ) {}

  @Get('projects/:projectId/secrets')
  async index(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Query('scope') scope?: SecretScope,
  ) {
    const secrets = await this.list.execute(projectId, user.sub, scope);
    return { secrets: secrets.map((s) => s.toPublic()) };
  }

  @Post('projects/:projectId/secrets')
  async create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: unknown,
  ) {
    const secret = await this.upsert.execute(projectId, user.sub, body);
    return { secret: secret.toPublic() };
  }

  @Delete('secrets/:secretId')
  async destroy(@Param('secretId') secretId: string, @CurrentUser() user: AccessTokenPayload) {
    await this.remove.execute(secretId, user.sub);
    return { ok: true };
  }
}
