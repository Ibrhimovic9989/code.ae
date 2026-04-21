import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import type { AccessTokenPayload } from '../../infrastructure/jwt.service';

export const CurrentUser = createParamDecorator<unknown, ExecutionContext, AccessTokenPayload>(
  (_data, ctx) => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.user;
  },
);
