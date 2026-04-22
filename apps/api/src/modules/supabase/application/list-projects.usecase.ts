import { Injectable } from '@nestjs/common';
import { ValidationError } from '@code-ae/shared';
import { SupabaseIntegrationRepository } from '../domain/supabase-integration.repository';
import { SupabaseApiClient, type SupabaseProject } from '../infrastructure/supabase-api.client';

@Injectable()
export class ListSupabaseProjectsUseCase {
  constructor(
    private readonly repo: SupabaseIntegrationRepository,
    private readonly api: SupabaseApiClient,
  ) {}

  async execute(userId: string): Promise<SupabaseProject[]> {
    const integration = await this.repo.findByUserId(userId);
    if (!integration) throw new ValidationError('Supabase not connected');
    return this.api.listProjects(integration.accessToken);
  }
}
