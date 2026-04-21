import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ValidationError } from '@code-ae/shared';
import { UserEntity } from '../domain/user.entity';
import { UserRepository } from '../domain/auth.repository';
import { PasswordHasher } from '../infrastructure/password-hasher';

export const RegisterInputSchema = z.object({
  email: z.string().email().max(254).transform((s) => s.toLowerCase().trim()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
  displayName: z.string().min(1).max(80),
  locale: z.enum(['ar', 'en']).default('ar'),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(raw: unknown): Promise<UserEntity> {
    const parsed = RegisterInputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid registration input', parsed.error.flatten().fieldErrors);
    }
    const input = parsed.data;

    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new ValidationError('Email already registered');

    const passwordHash = await this.hasher.hash(input.password);
    const now = new Date();

    const user = UserEntity.create({
      id: randomUUID(),
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      locale: input.locale,
      createdAt: now,
      updatedAt: now,
    });

    await this.users.save(user);
    return user;
  }
}
