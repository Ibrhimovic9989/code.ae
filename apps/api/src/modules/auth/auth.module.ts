import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserRepository, RefreshTokenRepository } from './domain/auth.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma-refresh-token.repository';
import { PasswordHasher } from './infrastructure/password-hasher';
import { JwtAuthService } from './infrastructure/jwt.service';
import { RegisterUseCase } from './application/register.usecase';
import { LoginUseCase } from './application/login.usecase';
import { RefreshUseCase } from './application/refresh.usecase';
import { LogoutUseCase } from './application/logout.usecase';
import { AuthController } from './interfaces/http/auth.controller';
import { JwtAuthGuard } from './interfaces/http/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: RefreshTokenRepository, useClass: PrismaRefreshTokenRepository },
    PasswordHasher,
    JwtAuthService,
    RegisterUseCase,
    LoginUseCase,
    RefreshUseCase,
    LogoutUseCase,
    JwtAuthGuard,
  ],
  exports: [JwtAuthService, JwtAuthGuard, UserRepository],
})
export class AuthModule {}
