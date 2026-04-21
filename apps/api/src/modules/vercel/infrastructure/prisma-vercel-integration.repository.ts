import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { VercelIntegrationEntity } from '../domain/vercel-integration.entity';
import { VercelIntegrationRepository } from '../domain/vercel-integration.repository';

@Injectable()
export class PrismaVercelIntegrationRepository extends VercelIntegrationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByUserId(userId: string): Promise<VercelIntegrationEntity | null> {
    const row = await this.prisma.vercelIntegration.findUnique({ where: { userId } });
    return row ? this.toEntity(row) : null;
  }

  async save(entity: VercelIntegrationEntity): Promise<void> {
    const e = entity.toObject();
    await this.prisma.vercelIntegration.upsert({
      where: { id: e.id },
      create: e,
      update: {
        accessToken: e.accessToken,
        vercelUserId: e.vercelUserId,
        vercelUsername: e.vercelUsername,
        teamId: e.teamId,
        updatedAt: e.updatedAt,
      },
    });
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.vercelIntegration.deleteMany({ where: { userId } });
  }

  private toEntity(row: {
    id: string;
    userId: string;
    accessToken: string;
    vercelUserId: string;
    vercelUsername: string;
    teamId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): VercelIntegrationEntity {
    return VercelIntegrationEntity.create({ ...row });
  }
}
