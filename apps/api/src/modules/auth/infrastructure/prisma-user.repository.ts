import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { UserEntity, type UserProps } from '../domain/user.entity';
import { UserRepository } from '../domain/auth.repository';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return row ? this.toEntity(row) : null;
  }

  async save(user: UserEntity): Promise<void> {
    const u = user.toObject();
    await this.prisma.user.upsert({
      where: { id: u.id },
      create: u,
      update: {
        email: u.email,
        passwordHash: u.passwordHash,
        displayName: u.displayName,
        locale: u.locale,
        updatedAt: u.updatedAt,
      },
    });
  }

  private toEntity(row: {
    id: string;
    email: string;
    passwordHash: string;
    displayName: string;
    locale: string;
    createdAt: Date;
    updatedAt: Date;
  }): UserEntity {
    return UserEntity.create({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      displayName: row.displayName,
      locale: (row.locale === 'en' ? 'en' : 'ar') as UserProps['locale'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
