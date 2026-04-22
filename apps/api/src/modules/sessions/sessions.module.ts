import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { SandboxesModule } from '../sandboxes/sandboxes.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { WriteFileUseCase } from '../workspace/application/write-file.usecase';
import { ReadFileUseCase } from '../workspace/application/read-file.usecase';
import { ListFilesUseCase } from '../workspace/application/list-files.usecase';
import { ExecCommandUseCase } from '../workspace/application/exec-command.usecase';
import { ResolveActiveSandbox } from '../workspace/application/resolve-active-sandbox';
import { SandboxAgentClient } from '../workspace/domain/sandbox-agent.client';
import { HttpSandboxAgentClient } from '../workspace/infrastructure/http-sandbox-agent.client';
import { SandboxRepository } from '../sandboxes/domain/sandbox.repository';
import { PrismaSandboxRepository } from '../sandboxes/infrastructure/prisma-sandbox.repository';
import { SessionRepository, MessageRepository } from './domain/session.repository';
import { PrismaSessionRepository } from './infrastructure/prisma-session.repository';
import { PrismaMessageRepository } from './infrastructure/prisma-message.repository';
import { CreateSessionUseCase } from './application/create-session.usecase';
import { SendMessageUseCase } from './application/send-message.usecase';
import { ListMessagesUseCase } from './application/list-messages.usecase';
import { ToolDispatcher } from './application/tool-dispatcher';
import { SessionsController } from './interfaces/http/sessions.controller';

@Module({
  imports: [AuthModule, ProjectsModule, SandboxesModule, WorkspaceModule, SupabaseModule],
  controllers: [SessionsController],
  providers: [
    { provide: SessionRepository, useClass: PrismaSessionRepository },
    { provide: MessageRepository, useClass: PrismaMessageRepository },
    { provide: SandboxRepository, useClass: PrismaSandboxRepository },
    { provide: SandboxAgentClient, useClass: HttpSandboxAgentClient },
    WriteFileUseCase,
    ReadFileUseCase,
    ListFilesUseCase,
    ExecCommandUseCase,
    ResolveActiveSandbox,
    ToolDispatcher,
    CreateSessionUseCase,
    SendMessageUseCase,
    ListMessagesUseCase,
  ],
})
export class SessionsModule {}
