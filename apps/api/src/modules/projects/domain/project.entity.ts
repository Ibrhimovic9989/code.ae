import type { ProjectTemplate, ProjectVisibility } from '@code-ae/shared';

export interface ProjectProps {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  description: string | null;
  template: ProjectTemplate;
  visibility: ProjectVisibility;
  githubRepoUrl: string | null;
  vercelProjectId: string | null;
  vercelDeploymentUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectEntity {
  private constructor(private props: ProjectProps) {}

  static create(props: ProjectProps): ProjectEntity {
    return new ProjectEntity(props);
  }

  get id(): string {
    return this.props.id;
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get slug(): string {
    return this.props.slug;
  }

  rename(name: string): void {
    if (!name.trim()) throw new Error('Project name cannot be empty');
    this.props.name = name.trim();
    this.props.updatedAt = new Date();
  }

  linkGithub(repoUrl: string): void {
    this.props.githubRepoUrl = repoUrl;
    this.props.updatedAt = new Date();
  }

  linkVercel(vercelProjectId: string, deploymentUrl: string): void {
    this.props.vercelProjectId = vercelProjectId;
    this.props.vercelDeploymentUrl = deploymentUrl;
    this.props.updatedAt = new Date();
  }

  changeVisibility(next: ProjectVisibility): void {
    this.props.visibility = next;
    this.props.updatedAt = new Date();
  }

  toObject(): ProjectProps {
    return { ...this.props };
  }
}
