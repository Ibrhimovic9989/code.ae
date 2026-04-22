import type { SupabaseIntegrationEntity } from './supabase-integration.entity';

export abstract class SupabaseIntegrationRepository {
  abstract findByUserId(userId: string): Promise<SupabaseIntegrationEntity | null>;
  abstract save(entity: SupabaseIntegrationEntity): Promise<void>;
  abstract delete(userId: string): Promise<void>;
}
