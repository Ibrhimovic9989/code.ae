import { Module } from '@nestjs/common';
import { WorkspaceFileStoreModule } from '../../infrastructure/workspace-file-store/workspace-file-store.module';
import { ProjectFileRepository } from './domain/project-file.repository';
import { PrismaProjectFileRepository } from './infrastructure/prisma-project-file.repository';
import { SandboxAgentClient } from './domain/sandbox-agent.client';
import { HttpSandboxAgentClient } from './infrastructure/http-sandbox-agent.client';
import { MaterializeWorkspaceUseCase } from './application/materialize-workspace.usecase';

/**
 * Standalone bundle of the persistence pieces (Blob store + Postgres index +
 * agent file-write) so `SandboxesModule` can inject `MaterializeWorkspaceUseCase`
 * without importing the full `WorkspaceModule` (which would create a cycle —
 * WorkspaceModule already imports SandboxesModule for ResolveActiveSandbox).
 */
@Module({
  imports: [WorkspaceFileStoreModule],
  providers: [
    { provide: ProjectFileRepository, useClass: PrismaProjectFileRepository },
    { provide: SandboxAgentClient, useClass: HttpSandboxAgentClient },
    MaterializeWorkspaceUseCase,
  ],
  exports: [MaterializeWorkspaceUseCase, ProjectFileRepository, SandboxAgentClient],
})
export class WorkspacePersistenceModule {}
