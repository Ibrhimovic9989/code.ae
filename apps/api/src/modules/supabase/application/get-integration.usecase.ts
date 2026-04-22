import { Injectable } from '@nestjs/common';
import type { SupabaseIntegrationEntity } from '../domain/supabase-integration.entity';
import { SupabaseIntegrationRepository } from '../domain/supabase-integration.repository';

@Injectable()
export class GetSupabaseIntegrationUseCase {
  constructor(private readonly repo: SupabaseIntegrationRepository) {}

  execute(userId: string): Promise<SupabaseIntegrationEntity | null> {
    return this.repo.findByUserId(userId);
  }
}
