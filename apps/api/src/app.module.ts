import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { SandboxesModule } from './modules/sandboxes/sandboxes.module';
import { SecretsModule } from './modules/secrets/secrets.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { appConfigSchema } from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw) => appConfigSchema.parse(raw),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ProjectsModule,
    SessionsModule,
    SandboxesModule,
    SecretsModule,
  ],
})
export class AppModule {}
