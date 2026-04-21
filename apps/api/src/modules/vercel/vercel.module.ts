import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { VercelIntegrationRepository } from './domain/vercel-integration.repository';
import { PrismaVercelIntegrationRepository } from './infrastructure/prisma-vercel-integration.repository';
import { VercelApiClient } from './infrastructure/vercel-api.client';
import { ConnectVercelUseCase } from './application/connect.usecase';
import { DisconnectVercelUseCase } from './application/disconnect.usecase';
import { GetVercelIntegrationUseCase } from './application/get-integration.usecase';
import { PublishProjectUseCase } from './application/publish-project.usecase';
import { GetLatestDeploymentUseCase } from './application/get-latest-deployment.usecase';
import { VercelController } from './interfaces/http/vercel.controller';

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [VercelController],
  providers: [
    { provide: VercelIntegrationRepository, useClass: PrismaVercelIntegrationRepository },
    VercelApiClient,
    ConnectVercelUseCase,
    DisconnectVercelUseCase,
    GetVercelIntegrationUseCase,
    PublishProjectUseCase,
    GetLatestDeploymentUseCase,
  ],
})
export class VercelModule {}
