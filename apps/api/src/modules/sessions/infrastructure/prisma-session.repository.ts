import { Injectable } from '@nestjs/common';
import type { SessionStatus } from '@code-ae/shared';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SessionEntity } from '../domain/session.entity';
import { SessionRepository } from '../domain/session.repository';

@Injectable()
export class PrismaSessionRepository extends SessionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<SessionEntity | null> {
    const row = await this.prisma.session.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findActiveByProject(projectId: string): Promise<SessionEntity | null> {
    const row = await this.prisma.session.findFirst({
      where: {
        projectId,
        status: { in: ['initializing', 'running', 'idle'] satisfies SessionStatus[] as string[] },
      },
      orderBy: { lastActivityAt: 'desc' },
    });
    return row ? this.toEntity(row) : null;
  }

  async save(session: SessionEntity): Promise<void> {
    const s = session.toObject();
    await this.prisma.session.upsert({
      where: { id: s.id },
      create: s,
      update: {
        status: s.status,
        sandboxId: s.sandboxId,
        lastActivityAt: s.lastActivityAt,
      },
    });
  }

  private toEntity(row: {
    id: string;
    projectId: string;
    status: string;
    sandboxId: string | null;
    startedAt: Date;
    lastActivityAt: Date;
  }): SessionEntity {
    return SessionEntity.create({
      id: row.id,
      projectId: row.projectId,
      status: row.status as SessionStatus,
      sandboxId: row.sandboxId,
      startedAt: row.startedAt,
      lastActivityAt: row.lastActivityAt,
    });
  }
}
