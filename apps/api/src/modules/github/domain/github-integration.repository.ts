import type { GitHubIntegrationEntity } from './github-integration.entity';

export abstract class GitHubIntegrationRepository {
  abstract findByUserId(userId: string): Promise<GitHubIntegrationEntity | null>;
  abstract save(entity: GitHubIntegrationEntity): Promise<void>;
  abstract delete(userId: string): Promise<void>;
}
