import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ValidationError } from '@code-ae/shared';
import { SupabaseIntegrationEntity } from '../domain/supabase-integration.entity';
import { SupabaseIntegrationRepository } from '../domain/supabase-integration.repository';
import { SupabaseApiClient } from '../infrastructure/supabase-api.client';

export const ConnectSupabaseSchema = z.object({
  accessToken: z.string().min(10).max(500),
});

@Injectable()
export class ConnectSupabaseUseCase {
  constructor(
    private readonly repo: SupabaseIntegrationRepository,
    private readonly api: SupabaseApiClient,
  ) {}

  async execute(userId: string, raw: unknown): Promise<SupabaseIntegrationEntity> {
    const parsed = ConnectSupabaseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid Supabase token input', parsed.error.flatten().fieldErrors);
    }
    const { accessToken } = parsed.data;

    // Probe auth — throws on invalid token.
    await this.api.getOrganizations(accessToken);

    const existing = await this.repo.findByUserId(userId);
    if (existing) {
      existing.rotate(accessToken, null);
      await this.repo.save(existing);
      return existing;
    }

    const now = new Date();
    const entity = SupabaseIntegrationEntity.create({
      id: randomUUID(),
      userId,
      accessToken,
      supabaseEmail: null,
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.save(entity);
    return entity;
  }
}
