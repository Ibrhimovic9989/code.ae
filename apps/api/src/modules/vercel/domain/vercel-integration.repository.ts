import type { VercelIntegrationEntity } from './vercel-integration.entity';

export abstract class VercelIntegrationRepository {
  abstract findByUserId(userId: string): Promise<VercelIntegrationEntity | null>;
  abstract save(entity: VercelIntegrationEntity): Promise<void>;
  abstract delete(userId: string): Promise<void>;
}
