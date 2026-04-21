import type { ProjectEntity } from './project.entity';

export abstract class ProjectRepository {
  abstract findById(id: string): Promise<ProjectEntity | null>;
  abstract findBySlug(slug: string): Promise<ProjectEntity | null>;
  abstract listByOwner(ownerId: string): Promise<ProjectEntity[]>;
  abstract save(project: ProjectEntity): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
