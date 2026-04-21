import { Injectable } from '@nestjs/common';
import type { SandboxStatus } from '@code-ae/shared';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SandboxEntity } from '../domain/sandbox.entity';
import { SandboxRepository } from '../domain/sandbox.repository';

@Injectable()
export class PrismaSandboxRepository extends SandboxRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<SandboxEntity | null> {
    const row = await this.prisma.sandbox.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findActiveByProject(projectId: string): Promise<SandboxEntity | null> {
    const row = await this.prisma.sandbox.findFirst({
      where: {
        projectId,
        status: { in: ['creating', 'running'] satisfies SandboxStatus[] as string[] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.toEntity(row) : null;
  }

  async save(sandbox: SandboxEntity): Promise<void> {
    const s = sandbox.toObject();
    await this.prisma.sandbox.upsert({
      where: { id: s.id },
      create: s,
      update: {
        status: s.status,
        previewUrl: s.previewUrl,
        stoppedAt: s.stoppedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.sandbox.delete({ where: { id } });
  }

  private toEntity(row: {
    id: string;
    projectId: string;
    status: string;
    previewUrl: string | null;
    createdAt: Date;
    stoppedAt: Date | null;
  }): SandboxEntity {
    return SandboxEntity.create({
      id: row.id,
      projectId: row.projectId,
      status: row.status as SandboxStatus,
      previewUrl: row.previewUrl,
      createdAt: row.createdAt,
      stoppedAt: row.stoppedAt,
    });
  }
}
