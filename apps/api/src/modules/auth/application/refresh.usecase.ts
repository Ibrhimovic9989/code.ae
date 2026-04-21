import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UnauthorizedError } from '@code-ae/shared';
import { RefreshTokenEntity } from '../domain/refresh-token.entity';
import { RefreshTokenRepository, UserRepository } from '../domain/auth.repository';
import { JwtAuthService } from '../infrastructure/jwt.service';

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class RefreshUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: RefreshTokenRepository,
    private readonly jwt: JwtAuthService,
  ) {}

  async execute(
    rawToken: string,
    ctx: { userAgent?: string | undefined; ipAddress?: string | undefined } = {},
  ): Promise<RefreshResult> {
    if (!rawToken) throw new UnauthorizedError('Missing refresh token');

    const tokenHash = this.jwt.hashRefreshToken(rawToken);
    const token = await this.tokens.findByHash(tokenHash);
    if (!token || !token.isActive) throw new UnauthorizedError('Invalid refresh token');

    const user = await this.users.findById(token.userId);
    if (!user) throw new UnauthorizedError('User not found');

    const fresh = this.jwt.generateRefreshToken();
    const newTokenId = randomUUID();

    token.revoke(newTokenId);
    await this.tokens.save(token);

    const newToken = RefreshTokenEntity.create({
      id: newTokenId,
      userId: user.id,
      tokenHash: fresh.hash,
      expiresAt: fresh.expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
      userAgent: ctx.userAgent ?? null,
      ipAddress: ctx.ipAddress ?? null,
      createdAt: new Date(),
    });
    await this.tokens.save(newToken);

    const accessToken = this.jwt.signAccessToken({
      sub: user.id,
      email: user.email,
      locale: user.locale,
    });

    return {
      accessToken,
      refreshToken: fresh.token,
      refreshTokenExpiresAt: fresh.expiresAt,
    };
  }

}
