import { Injectable } from '@nestjs/common';
import { ProjectEntity } from '../domain/project.entity';
import { ProjectRepository } from '../domain/project.repository';

@Injectable()
export class ListProjectsUseCase {
  constructor(private readonly projects: ProjectRepository) {}

  execute(ownerId: string): Promise<ProjectEntity[]> {
    return this.projects.listByOwner(ownerId);
  }
}
