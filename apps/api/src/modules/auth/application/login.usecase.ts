import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { UnauthorizedError, ValidationError } from '@code-ae/shared';
import { RefreshTokenEntity } from '../domain/refresh-token.entity';
import { UserEntity } from '../domain/user.entity';
import { RefreshTokenRepository, UserRepository } from '../domain/auth.repository';
import { PasswordHasher } from '../infrastructure/password-hasher';
import { JwtAuthService } from '../infrastructure/jwt.service';

export const LoginInputSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export interface LoginResult {
  user: UserEntity;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface LoginContext {
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
}

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly jwt: JwtAuthService,
  ) {}

  async execute(raw: unknown, ctx: LoginContext = {}): Promise<LoginResult> {
    const parsed = LoginInputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid login input', parsed.error.flatten().fieldErrors);
    }
    const { email, password } = parsed.data;

    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const ok = await this.hasher.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedError('Invalid email or password');

    const accessToken = this.jwt.signAccessToken({
      sub: user.id,
      email: user.email,
      locale: user.locale,
    });

    const refresh = this.jwt.generateRefreshToken();
    const refreshEntity = RefreshTokenEntity.create({
      id: randomUUID(),
      userId: user.id,
      tokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
      userAgent: ctx.userAgent ?? null,
      ipAddress: ctx.ipAddress ?? null,
      createdAt: new Date(),
    });
    await this.tokens.save(refreshEntity);

    return {
      user,
      accessToken,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }
}
