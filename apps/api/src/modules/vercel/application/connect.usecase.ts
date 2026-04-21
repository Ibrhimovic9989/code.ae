import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ValidationError } from '@code-ae/shared';
import { VercelIntegrationEntity } from '../domain/vercel-integration.entity';
import { VercelIntegrationRepository } from '../domain/vercel-integration.repository';
import { VercelApiClient } from '../infrastructure/vercel-api.client';

export const ConnectVercelSchema = z.object({
  accessToken: z.string().min(10).max(500),
  teamId: z.string().optional().nullable(),
});

@Injectable()
export class ConnectVercelUseCase {
  constructor(
    private readonly repo: VercelIntegrationRepository,
    private readonly api: VercelApiClient,
  ) {}

  async execute(userId: string, raw: unknown): Promise<VercelIntegrationEntity> {
    const parsed = ConnectVercelSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid Vercel token input', parsed.error.flatten().fieldErrors);
    }
    const { accessToken, teamId } = parsed.data;

    // Validate the token by fetching the Vercel user — throws if token is bad.
    const user = await this.api.getAuthenticatedUser(accessToken);

    const existing = await this.repo.findByUserId(userId);
    if (existing) {
      existing.rotate(accessToken, user.id, user.username, teamId ?? null);
      await this.repo.save(existing);
      return existing;
    }

    const now = new Date();
    const entity = VercelIntegrationEntity.create({
      id: randomUUID(),
      userId,
      accessToken,
      vercelUserId: user.id,
      vercelUsername: user.username,
      teamId: teamId ?? null,
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.save(entity);
    return entity;
  }
}
