import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SupabaseIntegrationEntity } from '../domain/supabase-integration.entity';
import { SupabaseIntegrationRepository } from '../domain/supabase-integration.repository';

@Injectable()
export class PrismaSupabaseIntegrationRepository extends SupabaseIntegrationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByUserId(userId: string): Promise<SupabaseIntegrationEntity | null> {
    const row = await this.prisma.supabaseIntegration.findUnique({ where: { userId } });
    return row ? this.toEntity(row) : null;
  }

  async save(entity: SupabaseIntegrationEntity): Promise<void> {
    const e = entity.toObject();
    await this.prisma.supabaseIntegration.upsert({
      where: { id: e.id },
      create: e,
      update: {
        accessToken: e.accessToken,
        supabaseEmail: e.supabaseEmail,
        updatedAt: e.updatedAt,
      },
    });
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.supabaseIntegration.deleteMany({ where: { userId } });
  }

  private toEntity(row: {
    id: string;
    userId: string;
    accessToken: string;
    supabaseEmail: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SupabaseIntegrationEntity {
    return SupabaseIntegrationEntity.create({ ...row });
  }
}
