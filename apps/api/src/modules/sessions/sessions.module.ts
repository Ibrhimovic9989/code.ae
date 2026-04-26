import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { SandboxesModule } from '../sandboxes/sandboxes.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SupabaseModule } from '../supabase/supabase.module';
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
    // ToolDispatcher consumes WriteFileUseCase / ReadFileUseCase /
    // ListFilesUseCase / ExecCommandUseCase / ResolveActiveSandbox from
    // WorkspaceModule's exports — DO NOT re-provide them here. Re-providing
    // creates a duplicate instance that bypasses WorkspaceModule's
    // WorkspaceFileStoreModule import, which made WriteFileUseCase fail to
    // resolve its WorkspaceFileStore dep at startup.
    ToolDispatcher,
    CreateSessionUseCase,
    SendMessageUseCase,
    ListMessagesUseCase,
  ],
})
export class SessionsModule {}
