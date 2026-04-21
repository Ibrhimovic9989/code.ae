import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateProjectSchema, type CreateProjectInput, ValidationError } from '@code-ae/shared';
import { ProjectEntity } from '../domain/project.entity';
import { ProjectRepository } from '../domain/project.repository';

@Injectable()
export class CreateProjectUseCase {
  constructor(private readonly projects: ProjectRepository) {}

  async execute(ownerId: string, raw: unknown): Promise<ProjectEntity> {
    const parsed = CreateProjectSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid project input', parsed.error.flatten().fieldErrors);
    }
    const input: CreateProjectInput = parsed.data;

    const existing = await this.projects.findBySlug(input.slug);
    if (existing) throw new ValidationError(`Slug "${input.slug}" is already taken`);

    const now = new Date();
    const project = ProjectEntity.create({
      id: randomUUID(),
      ownerId,
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      template: input.template,
      visibility: input.visibility,
      githubRepoUrl: null,
      createdAt: now,
      updatedAt: now,
    });

    await this.projects.save(project);
    return project;
  }
}
