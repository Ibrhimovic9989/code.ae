import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { UnauthorizedError } from '@code-ae/shared';
import { JwtAuthService, type AccessTokenPayload } from '../../infrastructure/jwt.service';

export interface AuthenticatedRequest extends FastifyRequest {
  user: AccessTokenPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtAuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedError('Missing bearer token');
    }
    const token = header.slice(7).trim();
    try {
      req.user = this.jwt.verifyAccessToken(token);
      return true;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}
