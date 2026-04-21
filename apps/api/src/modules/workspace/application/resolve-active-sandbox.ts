import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { SandboxRepository } from '../../sandboxes/domain/sandbox.repository';
import type { SandboxAgentEndpoint } from '../domain/sandbox-agent.client';

/**
 * Every workspace use case starts the same way: check project ownership,
 * find the active sandbox, and build the agent endpoint from it. This
 * helper centralises that so the use cases stay single-responsibility.
 */
@Injectable()
export class ResolveActiveSandbox {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly sandboxes: SandboxRepository,
  ) {}

  async execute(projectId: string, ownerId: string): Promise<SandboxAgentEndpoint> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your project');

    const sandbox = await this.sandboxes.findActiveByProject(projectId);
    if (!sandbox) throw new NotFoundError('Active sandbox for project', projectId);
    if (!sandbox.agentUrl || !sandbox.agentToken) {
      throw new NotFoundError('Sandbox agent endpoint', sandbox.id);
    }

    return { baseUrl: sandbox.agentUrl, token: sandbox.agentToken };
  }
}
