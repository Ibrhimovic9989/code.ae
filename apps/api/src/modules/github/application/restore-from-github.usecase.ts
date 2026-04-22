import { Injectable, Logger } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { GitHubIntegrationRepository } from '../domain/github-integration.repository';
import { ResolveActiveSandbox } from '../../workspace/application/resolve-active-sandbox';
import { SandboxAgentClient } from '../../workspace/domain/sandbox-agent.client';

export interface RestoreResult {
  restored: boolean;
  reason?: 'not-empty' | 'no-repo' | 'no-integration' | 'sandbox-unreachable' | 'clone-failed';
  message?: string;
  filesRestored?: number;
}

/**
 * Safety net: when a sandbox is fresh/empty and the project has a GitHub repo,
 * pull the latest pushed state into the workspace. Prevents "restart wiped my work".
 *
 * Idempotent: bails out if the workspace already has files.
 */
@Injectable()
export class RestoreFromGitHubUseCase {
  private readonly logger = new Logger(RestoreFromGitHubUseCase.name);

  constructor(
    private readonly projects: ProjectRepository,
    private readonly integrations: GitHubIntegrationRepository,
    private readonly resolveSandbox: ResolveActiveSandbox,
    private readonly agent: SandboxAgentClient,
  ) {}

  async execute(projectId: string, ownerId: string): Promise<RestoreResult> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your project');

    const props = project.toObject();
    if (!props.githubRepoUrl) return { restored: false, reason: 'no-repo' };

    const integration = await this.integrations.findByUserId(ownerId);
    if (!integration) return { restored: false, reason: 'no-integration' };

    // Must have an active sandbox + reachable agent. Callers should only invoke
    // this once the sandbox is ready; still, be defensive.
    let endpoint;
    try {
      endpoint = await this.resolveSandbox.execute(projectId, ownerId);
    } catch {
      return { restored: false, reason: 'sandbox-unreachable' };
    }

    // Only restore when the workspace is genuinely empty.
    let existing;
    try {
      existing = await this.agent.listFiles(endpoint, '.');
    } catch {
      return { restored: false, reason: 'sandbox-unreachable' };
    }
    if (existing.entries.length > 0) return { restored: false, reason: 'not-empty' };

    const ghMatch = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(props.githubRepoUrl);
    if (!ghMatch) return { restored: false, reason: 'no-repo' };
    const owner = ghMatch[1];
    const repo = ghMatch[2];

    const token = integration.accessToken;
    const remote = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;

    // Clone into /tmp and copy contents (including .git so user can push again).
    // Single shell command — simpler than orchestrating multiple exec calls.
    const script = [
      'set -e',
      'rm -rf /tmp/cae-restore',
      `git clone --depth=1 "${remote}" /tmp/cae-restore`,
      'shopt -s dotglob 2>/dev/null || true',
      'cp -a /tmp/cae-restore/. .',
      'rm -rf /tmp/cae-restore',
    ].join(' && ');

    try {
      const res = await this.agent.exec(endpoint, {
        command: `bash -lc '${script.replace(/'/g, "'\\''")}'`,
        cwd: '.',
      });
      if (res.exitCode !== 0) {
        const stderr = (res.stderr ?? '').replace(new RegExp(token, 'g'), '***');
        this.logger.warn(`Restore failed for project ${projectId}: ${stderr.slice(0, 500)}`);
        return { restored: false, reason: 'clone-failed', message: stderr.slice(0, 500) };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.replace(new RegExp(token, 'g'), '***') : String(err);
      this.logger.warn(`Restore failed for project ${projectId}: ${msg}`);
      return { restored: false, reason: 'clone-failed', message: msg };
    }

    const after = await this.agent.listFiles(endpoint, '.');
    return { restored: true, filesRestored: after.entries.length };
  }
}
