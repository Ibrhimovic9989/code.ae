import { Injectable } from '@nestjs/common';
import type { GitHubIntegrationEntity } from '../domain/github-integration.entity';
import { GitHubIntegrationRepository } from '../domain/github-integration.repository';

@Injectable()
export class GetGitHubIntegrationUseCase {
  constructor(private readonly repo: GitHubIntegrationRepository) {}

  execute(userId: string): Promise<GitHubIntegrationEntity | null> {
    return this.repo.findByUserId(userId);
  }
}
