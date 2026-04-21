import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { SecretsModule } from '../secrets/secrets.module';
import { SandboxRepository } from './domain/sandbox.repository';
import { OrchestratorClient } from './domain/orchestrator-client';
import { PrismaSandboxRepository } from './infrastructure/prisma-sandbox.repository';
import { HttpOrchestratorClient } from './infrastructure/http-orchestrator.client';
import { StartSandboxUseCase } from './application/start-sandbox.usecase';
import { GetSandboxUseCase } from './application/get-sandbox.usecase';
import { StopSandboxUseCase } from './application/stop-sandbox.usecase';
import { SandboxesController } from './interfaces/http/sandboxes.controller';

@Module({
  imports: [AuthModule, ProjectsModule, SecretsModule],
  controllers: [SandboxesController],
  providers: [
    { provide: SandboxRepository, useClass: PrismaSandboxRepository },
    { provide: OrchestratorClient, useClass: HttpOrchestratorClient },
    StartSandboxUseCase,
    GetSandboxUseCase,
    StopSandboxUseCase,
  ],
  exports: [StartSandboxUseCase, SandboxRepository],
})
export class SandboxesModule {}
