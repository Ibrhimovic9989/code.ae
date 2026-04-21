import { Injectable } from '@nestjs/common';
import type { VercelIntegrationEntity } from '../domain/vercel-integration.entity';
import { VercelIntegrationRepository } from '../domain/vercel-integration.repository';

@Injectable()
export class GetVercelIntegrationUseCase {
  constructor(private readonly repo: VercelIntegrationRepository) {}

  execute(userId: string): Promise<VercelIntegrationEntity | null> {
    return this.repo.findByUserId(userId);
  }
}
