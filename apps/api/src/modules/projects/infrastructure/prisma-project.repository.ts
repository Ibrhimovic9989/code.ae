import { Injectable } from '@nestjs/common';
import type { ProjectTemplate, ProjectVisibility } from '@code-ae/shared';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ProjectEntity } from '../domain/project.entity';
import { ProjectRepository } from '../domain/project.repository';

type PrismaProjectRow = {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  description: string | null;
  template: string;
  visibility: string;
  githubRepoUrl: string | null;
  vercelProjectId: string | null;
  vercelDeploymentUrl: string | null;
  supabaseProjectRef: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaProjectRepository extends ProjectRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<ProjectEntity | null> {
    const row = await this.prisma.project.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findBySlug(slug: string): Promise<ProjectEntity | null> {
    const row = await this.prisma.project.findUnique({ where: { slug } });
    return row ? this.toEntity(row) : null;
  }

  async listByOwner(ownerId: string): Promise<ProjectEntity[]> {
    const rows = await this.prisma.project.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async save(project: ProjectEntity): Promise<void> {
    const p = project.toObject();
    await this.prisma.project.upsert({
      where: { id: p.id },
      create: p,
      update: {
        name: p.name,
        description: p.description,
        visibility: p.visibility,
        githubRepoUrl: p.githubRepoUrl,
        vercelProjectId: p.vercelProjectId,
        vercelDeploymentUrl: p.vercelDeploymentUrl,
        supabaseProjectRef: p.supabaseProjectRef,
        updatedAt: p.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }

  private toEntity(row: PrismaProjectRow): ProjectEntity {
    return ProjectEntity.create({
      id: row.id,
      ownerId: row.ownerId,
      slug: row.slug,
      name: row.name,
      description: row.description,
      template: row.template as ProjectTemplate,
      visibility: row.visibility as ProjectVisibility,
      githubRepoUrl: row.githubRepoUrl,
      vercelProjectId: row.vercelProjectId,
      vercelDeploymentUrl: row.vercelDeploymentUrl,
      supabaseProjectRef: row.supabaseProjectRef,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
