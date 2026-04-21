import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { GitHubIntegrationEntity } from '../domain/github-integration.entity';
import { GitHubIntegrationRepository } from '../domain/github-integration.repository';

@Injectable()
export class PrismaGitHubIntegrationRepository extends GitHubIntegrationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByUserId(userId: string): Promise<GitHubIntegrationEntity | null> {
    const row = await this.prisma.gitHubIntegration.findUnique({ where: { userId } });
    return row ? this.toEntity(row) : null;
  }

  async save(entity: GitHubIntegrationEntity): Promise<void> {
    const e = entity.toObject();
    await this.prisma.gitHubIntegration.upsert({
      where: { id: e.id },
      create: e,
      update: {
        accessToken: e.accessToken,
        scopes: e.scopes,
        updatedAt: e.updatedAt,
      },
    });
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.gitHubIntegration.deleteMany({ where: { userId } });
  }

  private toEntity(row: {
    id: string;
    userId: string;
    githubLogin: string;
    githubId: number;
    accessToken: string;
    scopes: string;
    createdAt: Date;
    updatedAt: Date;
  }): GitHubIntegrationEntity {
    return GitHubIntegrationEntity.create({ ...row });
  }
}
