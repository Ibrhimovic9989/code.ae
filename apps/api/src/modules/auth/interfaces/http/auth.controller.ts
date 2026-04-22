import { Body, Controller, Get, NotFoundException, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { RegisterUseCase } from '../../application/register.usecase';
import { LoginUseCase } from '../../application/login.usecase';
import { RefreshUseCase } from '../../application/refresh.usecase';
import { LogoutUseCase } from '../../application/logout.usecase';
import { JwtAuthService } from '../../infrastructure/jwt.service';
import { UserRepository } from '../../domain/auth.repository';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AccessTokenPayload } from '../../infrastructure/jwt.service';

const REFRESH_COOKIE = 'code_ae_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly register: RegisterUseCase,
    private readonly login: LoginUseCase,
    private readonly refresh: RefreshUseCase,
    private readonly logout: LogoutUseCase,
    private readonly jwt: JwtAuthService,
    private readonly users: UserRepository,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() payload: AccessTokenPayload) {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new NotFoundException('User not found');
    return { user: user.toPublic() };
  }

  @Post('register')
  async postRegister(@Body() body: unknown) {
    const user = await this.register.execute(body);

    const access = this.jwt.signAccessToken({
      sub: user.id,
      email: user.email,
      locale: user.locale,
    });
    return {
      user: user.toPublic(),
      accessToken: access,
    };
  }

  @Post('login')
  async postLogin(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.login.execute(body, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    this.setRefreshCookie(reply, result.refreshToken, result.refreshTokenExpiresAt);
    return {
      user: result.user.toPublic(),
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  async postRefresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const raw = this.readRefreshCookie(req);
    const result = await this.refresh.execute(raw ?? '', {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    this.setRefreshCookie(reply, result.refreshToken, result.refreshTokenExpiresAt);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async postLogout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @CurrentUser() _user: AccessTokenPayload,
  ) {
    const raw = this.readRefreshCookie(req);
    await this.logout.execute(raw);
    this.clearRefreshCookie(reply);
    return { ok: true };
  }

  private setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
    // SameSite=None because web (vercel.app) and API (azurecontainerapps.io)
    // live on different registrable domains — browsers drop Lax cookies on
    // cross-site fetches, so every page reload hits /auth/refresh without
    // the cookie and bounces the user to login. None + Secure is the
    // correct combo for a credentialed cross-origin cookie.
    reply.header(
      'set-cookie',
      `${REFRESH_COOKIE}=${token}; Path=/api/v1/auth; HttpOnly; Secure; SameSite=None; Expires=${expiresAt.toUTCString()}`,
    );
  }

  private clearRefreshCookie(reply: FastifyReply): void {
    reply.header(
      'set-cookie',
      `${REFRESH_COOKIE}=; Path=/api/v1/auth; HttpOnly; Secure; SameSite=None; Max-Age=0`,
    );
  }

  private readRefreshCookie(req: FastifyRequest): string | undefined {
    const cookie = req.headers.cookie;
    if (!cookie) return undefined;
    for (const part of cookie.split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === REFRESH_COOKIE) return v.join('=');
    }
    return undefined;
  }
}
