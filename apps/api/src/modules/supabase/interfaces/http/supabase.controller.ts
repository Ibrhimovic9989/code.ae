import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/interfaces/http/jwt-auth.guard';
import { CurrentUser } from '../../../auth/interfaces/http/current-user.decorator';
import type { AccessTokenPayload } from '../../../auth/infrastructure/jwt.service';
import { ConnectSupabaseUseCase } from '../../application/connect.usecase';
import { DisconnectSupabaseUseCase } from '../../application/disconnect.usecase';
import { GetSupabaseIntegrationUseCase } from '../../application/get-integration.usecase';
import { ListSupabaseProjectsUseCase } from '../../application/list-projects.usecase';
import { LinkSupabaseProjectUseCase } from '../../application/link-project.usecase';
import { UnlinkSupabaseProjectUseCase } from '../../application/unlink-project.usecase';

@Controller()
@UseGuards(JwtAuthGuard)
export class SupabaseController {
  constructor(
    private readonly connect: ConnectSupabaseUseCase,
    private readonly disconnect: DisconnectSupabaseUseCase,
    private readonly getIntegration: GetSupabaseIntegrationUseCase,
    private readonly listSupabaseProjects: ListSupabaseProjectsUseCase,
    private readonly linkProject: LinkSupabaseProjectUseCase,
    private readonly unlinkProject: UnlinkSupabaseProjectUseCase,
  ) {}

  @Get('auth/supabase')
  async me(@CurrentUser() user: AccessTokenPayload) {
    const integration = await this.getIntegration.execute(user.sub);
    return { integration: integration?.toPublic() ?? null };
  }

  @Post('auth/supabase/connect')
  async connectToken(@CurrentUser() user: AccessTokenPayload, @Body() body: unknown) {
    const entity = await this.connect.execute(user.sub, body);
    return { integration: entity.toPublic() };
  }

  @Delete('auth/supabase')
  async disconnectToken(@CurrentUser() user: AccessTokenPayload) {
    await this.disconnect.execute(user.sub);
    return { ok: true };
  }

  @Get('auth/supabase/projects')
  async listProjects(@CurrentUser() user: AccessTokenPayload) {
    const projects = await this.listSupabaseProjects.execute(user.sub);
    return {
      projects: projects.map((p) => ({
        ref: p.ref,
        name: p.name,
        region: p.region,
        status: p.status,
      })),
    };
  }

  @Post('projects/:projectId/supabase/link')
  async link(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: unknown,
  ) {
    return this.linkProject.execute(projectId, user.sub, body);
  }

  @Delete('projects/:projectId/supabase/link')
  async unlink(@Param('projectId') projectId: string, @CurrentUser() user: AccessTokenPayload) {
    await this.unlinkProject.execute(projectId, user.sub);
    return { ok: true };
  }
}
