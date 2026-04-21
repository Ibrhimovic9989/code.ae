import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/app.config';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  locale: string;
  typ: 'access';
}

@Injectable()
export class JwtAuthService {
  private readonly secret: string;
  private readonly accessTtlSeconds = 60 * 15;
  private readonly refreshTtlDays = 30;

  constructor(
    private readonly jwt: NestJwtService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.secret = config.get('JWT_SECRET', { infer: true });
  }

  signAccessToken(payload: Omit<AccessTokenPayload, 'typ'>): string {
    return this.jwt.sign(
      { ...payload, typ: 'access' } satisfies AccessTokenPayload,
      { secret: this.secret, expiresIn: this.accessTtlSeconds },
    );
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = this.jwt.verify<AccessTokenPayload>(token, { secret: this.secret });
    if (decoded.typ !== 'access') throw new Error('Wrong token type');
    return decoded;
  }

  generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
    const token = randomBytes(48).toString('base64url');
    const hash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000);
    return { token, hash, expiresAt };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
