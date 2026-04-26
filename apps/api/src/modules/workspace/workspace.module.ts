import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { SandboxesModule } from '../sandboxes/sandboxes.module';
import { SandboxRepository } from '../sandboxes/domain/sandbox.repository';
import { PrismaSandboxRepository } from '../sandboxes/infrastructure/prisma-sandbox.repository';
import { SandboxAgentClient } from './domain/sandbox-agent.client';
import { HttpSandboxAgentClient } from './infrastructure/http-sandbox-agent.client';
import { ProjectFileRepository } from './domain/project-file.repository';
import { PrismaProjectFileRepository } from './infrastructure/prisma-project-file.repository';
import { WorkspaceFileStoreModule } from '../../infrastructure/workspace-file-store/workspace-file-store.module';
import { ResolveActiveSandbox } from './application/resolve-active-sandbox';
import { WriteFileUseCase } from './application/write-file.usecase';
import { ReadFileUseCase } from './application/read-file.usecase';
import { ListFilesUseCase } from './application/list-files.usecase';
import { DeleteFileUseCase } from './application/delete-file.usecase';
import { MoveFileUseCase } from './application/move-file.usecase';
import { ExecCommandUseCase } from './application/exec-command.usecase';
import { StreamCommandUseCase } from './application/stream-command.usecase';
import { HealPreviewUseCase } from './application/heal-preview.usecase';
import { DetectErrorsUseCase } from './application/detect-errors.usecase';
import { MaterializeWorkspaceUseCase } from './application/materialize-workspace.usecase';
import { WorkspaceController } from './interfaces/http/workspace.controller';
import { PreviewProxyController } from './interfaces/http/preview-proxy.controller';

@Module({
  imports: [AuthModule, ProjectsModule, SandboxesModule, WorkspaceFileStoreModule],
  controllers: [WorkspaceController, PreviewProxyController],
  providers: [
    { provide: SandboxRepository, useClass: PrismaSandboxRepository },
    { provide: SandboxAgentClient, useClass: HttpSandboxAgentClient },
    { provide: ProjectFileRepository, useClass: PrismaProjectFileRepository },
    ResolveActiveSandbox,
    WriteFileUseCase,
    ReadFileUseCase,
    ListFilesUseCase,
    DeleteFileUseCase,
    MoveFileUseCase,
    ExecCommandUseCase,
    StreamCommandUseCase,
    HealPreviewUseCase,
    DetectErrorsUseCase,
    MaterializeWorkspaceUseCase,
  ],
  exports: [
    ExecCommandUseCase,
    ResolveActiveSandbox,
    SandboxAgentClient,
    HealPreviewUseCase,
    DetectErrorsUseCase,
    MaterializeWorkspaceUseCase,
    ProjectFileRepository,
    // Exported so SessionsModule's ToolDispatcher can inject them without
    // re-providing — re-providing creates separate instances that lack the
    // newly-required WorkspaceFileStore + ProjectFileRepository deps.
    WriteFileUseCase,
    ReadFileUseCase,
    ListFilesUseCase,
  ],
})
export class WorkspaceModule {}
