import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError, ValidationError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { VercelIntegrationRepository } from '../domain/vercel-integration.repository';
import { VercelApiClient, type VercelDeployment } from '../infrastructure/vercel-api.client';

export interface PublishProjectResult {
  projectId: string;
  projectName: string;
  deploymentId: string;
  deploymentUrl: string;
  state: VercelDeployment['state'];
}

@Injectable()
export class PublishProjectUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly vercel: VercelIntegrationRepository,
    private readonly api: VercelApiClient,
  ) {}

  async execute(projectId: string, ownerId: string): Promise<PublishProjectResult> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your project');

    const integration = await this.vercel.findByUserId(ownerId);
    if (!integration) throw new ValidationError('Connect your Vercel account first');

    const props = project.toObject();
    if (!props.githubRepoUrl) {
      throw new ValidationError('Push the project to GitHub first — Vercel deploys from a git repo.');
    }

    // githubRepoUrl is like "https://github.com/owner/repo"
    const ghMatch = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(props.githubRepoUrl);
    if (!ghMatch) throw new ValidationError('Could not parse GitHub repo URL');
    const repoFullName = `${ghMatch[1]}/${ghMatch[2]}`;

    const projectName = props.slug;
    const token = integration.accessToken;
    const teamId = integration.teamId;

    // Look up or create the Vercel project linked to the GitHub repo.
    let vercelProject = await this.api.findProjectByName(token, teamId, projectName);
    if (!vercelProject) {
      vercelProject = await this.api.createProject(token, teamId, {
        name: projectName,
        framework: 'nextjs',
        gitRepository: { type: 'github', repo: repoFullName },
      });
    }

    const deployment = await this.api.createDeployment(token, teamId, {
      name: projectName,
      gitSource: { type: 'github', repo: repoFullName, ref: 'main' },
      target: 'production',
    });

    const deploymentUrl = deployment.url.startsWith('http') ? deployment.url : `https://${deployment.url}`;

    project.linkVercel(vercelProject.id, deploymentUrl);
    await this.projects.save(project);

    return {
      projectId: vercelProject.id,
      projectName,
      deploymentId: deployment.uid,
      deploymentUrl,
      state: deployment.state,
    };
  }
}
