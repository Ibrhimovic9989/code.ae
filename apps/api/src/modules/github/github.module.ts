import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { SandboxesModule } from '../sandboxes/sandboxes.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { GitHubIntegrationRepository } from './domain/github-integration.repository';
import { PrismaGitHubIntegrationRepository } from './infrastructure/prisma-github-integration.repository';
import { StartGitHubOAuthUseCase } from './application/start-oauth.usecase';
import { CompleteGitHubOAuthUseCase } from './application/complete-oauth.usecase';
import { GetGitHubIntegrationUseCase } from './application/get-integration.usecase';
import { PushWorkspaceUseCase } from './application/push-workspace.usecase';
import { RestoreFromGitHubUseCase } from './application/restore-from-github.usecase';
import { GitHubController } from './interfaces/http/github.controller';

@Module({
  imports: [AuthModule, ProjectsModule, SandboxesModule, WorkspaceModule],
  controllers: [GitHubController],
  providers: [
    { provide: GitHubIntegrationRepository, useClass: PrismaGitHubIntegrationRepository },
    StartGitHubOAuthUseCase,
    CompleteGitHubOAuthUseCase,
    GetGitHubIntegrationUseCase,
    PushWorkspaceUseCase,
    RestoreFromGitHubUseCase,
  ],
})
export class GitHubModule {}
