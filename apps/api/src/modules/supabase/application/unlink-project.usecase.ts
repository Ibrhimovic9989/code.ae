import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';

@Injectable()
export class UnlinkSupabaseProjectUseCase {
  constructor(private readonly projects: ProjectRepository) {}

  async execute(projectId: string, ownerId: string): Promise<void> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your project');
    project.linkSupabase(null);
    await this.projects.save(project);
    // Secrets are left in place intentionally — user may still want access via prior keys.
    // They can clear them manually via the Secrets UI.
  }
}
