import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/interfaces/http/jwt-auth.guard';
import { CurrentUser } from '../../../auth/interfaces/http/current-user.decorator';
import type { AccessTokenPayload } from '../../../auth/infrastructure/jwt.service';
import { ConnectVercelUseCase } from '../../application/connect.usecase';
import { DisconnectVercelUseCase } from '../../application/disconnect.usecase';
import { GetVercelIntegrationUseCase } from '../../application/get-integration.usecase';
import { PublishProjectUseCase } from '../../application/publish-project.usecase';
import { GetLatestDeploymentUseCase } from '../../application/get-latest-deployment.usecase';

@Controller()
@UseGuards(JwtAuthGuard)
export class VercelController {
  constructor(
    private readonly connect: ConnectVercelUseCase,
    private readonly disconnect: DisconnectVercelUseCase,
    private readonly getIntegration: GetVercelIntegrationUseCase,
    private readonly publish: PublishProjectUseCase,
    private readonly getLatestDeployment: GetLatestDeploymentUseCase,
  ) {}

  @Get('auth/vercel')
  async me(@CurrentUser() user: AccessTokenPayload) {
    const integration = await this.getIntegration.execute(user.sub);
    return { integration: integration?.toPublic() ?? null };
  }

  @Post('auth/vercel/connect')
  async connectToken(@CurrentUser() user: AccessTokenPayload, @Body() body: unknown) {
    const entity = await this.connect.execute(user.sub, body);
    return { integration: entity.toPublic() };
  }

  @Delete('auth/vercel')
  async disconnectToken(@CurrentUser() user: AccessTokenPayload) {
    await this.disconnect.execute(user.sub);
    return { ok: true };
  }

  @Post('projects/:projectId/publish')
  async publishProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.publish.execute(projectId, user.sub);
  }

  @Get('projects/:projectId/deployment')
  async latest(@Param('projectId') projectId: string, @CurrentUser() user: AccessTokenPayload) {
    const deployment = await this.getLatestDeployment.execute(projectId, user.sub);
    return { deployment };
  }
}
