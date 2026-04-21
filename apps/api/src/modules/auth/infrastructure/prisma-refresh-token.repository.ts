import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RefreshTokenEntity } from '../domain/refresh-token.entity';
import { RefreshTokenRepository } from '../domain/auth.repository';

@Injectable()
export class PrismaRefreshTokenRepository extends RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<RefreshTokenEntity | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    const row = await this.prisma.refreshToken.findFirst({ where: { tokenHash } });
    return row ? this.toEntity(row) : null;
  }

  async save(token: RefreshTokenEntity): Promise<void> {
    const t = token.toObject();
    await this.prisma.refreshToken.upsert({
      where: { id: t.id },
      create: t,
      update: {
        revokedAt: t.revokedAt,
        replacedByTokenId: t.replacedByTokenId,
      },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private toEntity(row: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    replacedByTokenId: string | null;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: Date;
  }): RefreshTokenEntity {
    return RefreshTokenEntity.create({
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      replacedByTokenId: row.replacedByTokenId,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt,
    });
  }
}
