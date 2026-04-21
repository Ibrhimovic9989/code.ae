import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError, ValidationError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { VercelIntegrationRepository } from '../domain/vercel-integration.repository';
import { VercelApiClient, type VercelDeployment } from '../infrastructure/vercel-api.client';

@Injectable()
export class GetLatestDeploymentUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly vercel: VercelIntegrationRepository,
    private readonly api: VercelApiClient,
  ) {}

  async execute(projectId: string, ownerId: string): Promise<VercelDeployment | null> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your project');

    const integration = await this.vercel.findByUserId(ownerId);
    if (!integration) throw new ValidationError('Vercel not connected');

    const props = project.toObject();
    if (!props.vercelProjectId) return null;

    const list = await this.api.listDeployments(
      integration.accessToken,
      integration.teamId,
      props.vercelProjectId,
      1,
    );
    return list[0] ?? null;
  }
}
