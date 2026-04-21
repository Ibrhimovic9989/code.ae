import { Injectable } from '@nestjs/common';
import { RefreshTokenRepository } from '../domain/auth.repository';
import { JwtAuthService } from '../infrastructure/jwt.service';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly tokens: RefreshTokenRepository,
    private readonly jwt: JwtAuthService,
  ) {}

  async execute(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const hash = this.jwt.hashRefreshToken(rawRefreshToken);
    const token = await this.tokens.findByHash(hash);
    if (!token) return;
    token.revoke(null);
    await this.tokens.save(token);
  }
}
