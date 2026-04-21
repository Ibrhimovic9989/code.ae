import { Injectable } from '@nestjs/common';
import { VercelIntegrationRepository } from '../domain/vercel-integration.repository';

@Injectable()
export class DisconnectVercelUseCase {
  constructor(private readonly repo: VercelIntegrationRepository) {}

  async execute(userId: string): Promise<void> {
    await this.repo.delete(userId);
  }
}
