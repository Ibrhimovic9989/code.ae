import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ForbiddenError, NotFoundError, ValidationError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { UpsertSecretUseCase } from '../../secrets/application/upsert-secret.usecase';
import { McpRegistry } from '../../mcp/domain/mcp-registry';
import { SupabaseIntegrationRepository } from '../domain/supabase-integration.repository';
import { SupabaseApiClient } from '../infrastructure/supabase-api.client';

export const LinkSupabaseProjectSchema = z.object({
  supabaseProjectRef: z.string().min(1).max(60),
  dbPassword: z.string().min(1).max(200).optional(),
});

export interface LinkSupabaseProjectResult {
  projectId: string;
  supabaseProjectRef: string;
  supabaseUrl: string;
  secretsWritten: string[];
}

@Injectable()
export class LinkSupabaseProjectUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly repo: SupabaseIntegrationRepository,
    private readonly api: SupabaseApiClient,
    private readonly upsertSecret: UpsertSecretUseCase,
    private readonly mcp: McpRegistry,
  ) {}

  async execute(projectId: string, ownerId: string, raw: unknown): Promise<LinkSupabaseProjectResult> {
    const parsed = LinkSupabaseProjectSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid link input', parsed.error.flatten().fieldErrors);
    }
    const { supabaseProjectRef, dbPassword } = parsed.data;

    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your project');

    const integration = await this.repo.findByUserId(ownerId);
    if (!integration) throw new ValidationError('Connect Supabase first');

    // Confirm the ref exists and fetch keys.
    const supaProject = await this.api.getProject(integration.accessToken, supabaseProjectRef);
    const { anon, serviceRole } = await this.api.getApiKeys(integration.accessToken, supabaseProjectRef);
    const supabaseUrl = this.api.projectUrl(supabaseProjectRef);

    // Write secrets to development scope so sandbox dev servers pick them up.
    const secretsWritten: string[] = [];
    await this.upsertSecret.execute(projectId, ownerId, {
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      value: supabaseUrl,
      scope: 'development',
    });
    secretsWritten.push('NEXT_PUBLIC_SUPABASE_URL');

    if (anon) {
      await this.upsertSecret.execute(projectId, ownerId, {
        key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        value: anon,
        scope: 'development',
      });
      secretsWritten.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    if (serviceRole) {
      await this.upsertSecret.execute(projectId, ownerId, {
        key: 'SUPABASE_SERVICE_ROLE_KEY',
        value: serviceRole,
        scope: 'development',
      });
      secretsWritten.push('SUPABASE_SERVICE_ROLE_KEY');
    }
    if (dbPassword) {
      // Pooler connection string — Supabase's recommended format for serverless/Next.js.
      // Transaction pooler on port 6543 for app code.
      const encoded = encodeURIComponent(dbPassword);
      const databaseUrl = `postgresql://postgres.${supabaseProjectRef}:${encoded}@aws-0-${supaProject.region}.pooler.supabase.com:6543/postgres`;
      await this.upsertSecret.execute(projectId, ownerId, {
        key: 'DATABASE_URL',
        value: databaseUrl,
        scope: 'development',
      });
      secretsWritten.push('DATABASE_URL');
    }

    project.linkSupabase(supabaseProjectRef);
    await this.projects.save(project);

    // Pre-warm the MCP server so the first agent message doesn't pay the
    // 30-90s npx download tax. Fire-and-forget: link still succeeds on failure.
    void this.mcp.ensureSupabaseServer(projectId, integration.accessToken, supabaseProjectRef);

    return {
      projectId,
      supabaseProjectRef,
      supabaseUrl,
      secretsWritten,
    };
  }
}
