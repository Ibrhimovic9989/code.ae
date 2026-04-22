import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { SecretsModule } from '../secrets/secrets.module';
import { SupabaseIntegrationRepository } from './domain/supabase-integration.repository';
import { PrismaSupabaseIntegrationRepository } from './infrastructure/prisma-supabase-integration.repository';
import { SupabaseApiClient } from './infrastructure/supabase-api.client';
import { ConnectSupabaseUseCase } from './application/connect.usecase';
import { DisconnectSupabaseUseCase } from './application/disconnect.usecase';
import { GetSupabaseIntegrationUseCase } from './application/get-integration.usecase';
import { ListSupabaseProjectsUseCase } from './application/list-projects.usecase';
import { LinkSupabaseProjectUseCase } from './application/link-project.usecase';
import { UnlinkSupabaseProjectUseCase } from './application/unlink-project.usecase';
import { SupabaseController } from './interfaces/http/supabase.controller';

@Module({
  imports: [AuthModule, ProjectsModule, SecretsModule],
  controllers: [SupabaseController],
  providers: [
    { provide: SupabaseIntegrationRepository, useClass: PrismaSupabaseIntegrationRepository },
    SupabaseApiClient,
    ConnectSupabaseUseCase,
    DisconnectSupabaseUseCase,
    GetSupabaseIntegrationUseCase,
    ListSupabaseProjectsUseCase,
    LinkSupabaseProjectUseCase,
    UnlinkSupabaseProjectUseCase,
  ],
  exports: [
    SupabaseIntegrationRepository,
    SupabaseApiClient,
    GetSupabaseIntegrationUseCase,
  ],
})
export class SupabaseModule {}
