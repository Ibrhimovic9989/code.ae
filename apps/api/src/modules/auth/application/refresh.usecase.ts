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

  /**
   * Grace window for concurrent refreshes. After a token is rotated, the
   * old hash stays "good enough" for this many ms — long enough to absorb a
   * second tab / a retry from a 401 racing the auth-context hydrate. Without
   * this, a refresh-token rotation race locks the user out for the full
   * 30-day cookie TTL.
   */
  private readonly GRACE_MS = 10_000;

  async execute(
    rawToken: string,
    ctx: { userAgent?: string | undefined; ipAddress?: string | undefined } = {},
  ): Promise<RefreshResult> {
    if (!rawToken) throw new UnauthorizedError('Missing refresh token');

    const tokenHash = this.jwt.hashRefreshToken(rawToken);
    const token = await this.tokens.findByHash(tokenHash);
    if (!token) throw new UnauthorizedError('Invalid refresh token');
    if (!token.isActive) {
      // Inside the grace window we trust the now-revoked token: the second
      // request sees the rotated hash, but it was rotated <10s ago by the
      // same client. Issue a fresh access token and a fresh refresh cookie
      // so both racers end up converged on a valid session.
      const props = token.toObject();
      const revokedAt = props.revokedAt;
      const recentlyRotated =
        revokedAt && Date.now() - revokedAt.getTime() < this.GRACE_MS && !!props.replacedByTokenId;
      if (!recentlyRotated) {
        throw new UnauthorizedError('Invalid refresh token');
      }
    }

    const user = await this.users.findById(token.userId);
    if (!user) throw new UnauthorizedError('User not found');

    const fresh = this.jwt.generateRefreshToken();
    const newTokenId = randomUUID();

    // If we're inside the grace window, the token was already revoked by
    // the first racer — don't double-revoke (would clobber replacedByTokenId)
    // and don't double-save.
    if (token.isActive) {
      token.revoke(newTokenId);
      await this.tokens.save(token);
    }

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
