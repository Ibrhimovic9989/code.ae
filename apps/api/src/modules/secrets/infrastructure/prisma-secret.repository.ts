import { Injectable } from '@nestjs/common';
import type { SecretScope } from '@code-ae/shared';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SecretEntity } from '../domain/secret.entity';
import { SecretRepository } from '../domain/secret.repository';

@Injectable()
export class PrismaSecretRepository extends SecretRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<SecretEntity | null> {
    const row = await this.prisma.secret.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByKey(projectId: string, key: string, scope: SecretScope): Promise<SecretEntity | null> {
    const row = await this.prisma.secret.findUnique({
      where: { projectId_key_scope: { projectId, key, scope } },
    });
    return row ? this.toEntity(row) : null;
  }

  async listByProject(projectId: string, scope?: SecretScope): Promise<SecretEntity[]> {
    const rows = await this.prisma.secret.findMany({
      where: { projectId, ...(scope ? { scope } : {}) },
      orderBy: [{ scope: 'asc' }, { key: 'asc' }],
    });
    return rows.map((r) => this.toEntity(r));
  }

  async save(secret: SecretEntity): Promise<void> {
    const s = secret.toObject();
    await this.prisma.secret.upsert({
      where: { id: s.id },
      create: s,
      update: { keyVaultRef: s.keyVaultRef, updatedAt: s.updatedAt },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.secret.delete({ where: { id } });
  }

  private toEntity(row: {
    id: string;
    projectId: string;
    key: string;
    scope: string;
    keyVaultRef: string;
    createdAt: Date;
    updatedAt: Date;
  }): SecretEntity {
    return SecretEntity.create({
      id: row.id,
      projectId: row.projectId,
      key: row.key,
      scope: row.scope as SecretScope,
      keyVaultRef: row.keyVaultRef,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
