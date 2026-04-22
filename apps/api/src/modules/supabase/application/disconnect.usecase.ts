import { Injectable } from '@nestjs/common';
import { SupabaseIntegrationRepository } from '../domain/supabase-integration.repository';

@Injectable()
export class DisconnectSupabaseUseCase {
  constructor(private readonly repo: SupabaseIntegrationRepository) {}

  async execute(userId: string): Promise<void> {
    await this.repo.delete(userId);
  }
}
