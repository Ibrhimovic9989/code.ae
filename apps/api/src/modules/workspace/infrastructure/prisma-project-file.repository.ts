import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  ProjectFileRepository,
  type ProjectFileRow,
} from '../domain/project-file.repository';

@Injectable()
export class PrismaProjectFileRepository extends ProjectFileRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async upsert(row: Omit<ProjectFileRow, 'updatedAt'>): Promise<void> {
    await this.prisma.projectFile.upsert({
      where: { projectId_path: { projectId: row.projectId, path: row.path } },
      create: {
        projectId: row.projectId,
        path: row.path,
        size: row.size,
        etag: row.etag,
      },
      update: {
        size: row.size,
        etag: row.etag,
      },
    });
  }

  async delete(projectId: string, path: string): Promise<void> {
    await this.prisma.projectFile.deleteMany({ where: { projectId, path } });
  }

  async listByProject(projectId: string): Promise<ProjectFileRow[]> {
    const rows = await this.prisma.projectFile.findMany({
      where: { projectId },
      orderBy: { path: 'asc' },
    });
    return rows.map((r) => ({
      projectId: r.projectId,
      path: r.path,
      size: r.size,
      etag: r.etag,
      updatedAt: r.updatedAt,
    }));
  }

  async findOne(projectId: string, path: string): Promise<ProjectFileRow | null> {
    const row = await this.prisma.projectFile.findUnique({
      where: { projectId_path: { projectId, path } },
    });
    return row
      ? {
          projectId: row.projectId,
          path: row.path,
          size: row.size,
          etag: row.etag,
          updatedAt: row.updatedAt,
        }
      : null;
  }

  async rename(
    projectId: string,
    fromPath: string,
    toPath: string,
    newEtag: string,
  ): Promise<void> {
    // Run in a transaction so a crash mid-rename doesn't leave both rows.
    await this.prisma.$transaction([
      this.prisma.projectFile.deleteMany({ where: { projectId, path: toPath } }),
      this.prisma.projectFile.update({
        where: { projectId_path: { projectId, path: fromPath } },
        data: { path: toPath, etag: newEtag },
      }),
    ]);
  }

  async replaceAll(
    projectId: string,
    rows: Omit<ProjectFileRow, 'updatedAt'>[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.projectFile.deleteMany({ where: { projectId } }),
      ...(rows.length > 0
        ? [
            this.prisma.projectFile.createMany({
              data: rows.map((r) => ({
                projectId: r.projectId,
                path: r.path,
                size: r.size,
                etag: r.etag,
              })),
            }),
          ]
        : []),
    ]);
  }
}
