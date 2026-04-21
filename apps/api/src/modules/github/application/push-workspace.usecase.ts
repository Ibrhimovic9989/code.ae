import { Injectable } from '@nestjs/common';
import { Octokit } from 'octokit';
import { ForbiddenError, NotFoundError, SandboxError, ValidationError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { ExecCommandUseCase } from '../../workspace/application/exec-command.usecase';
import { GitHubIntegrationRepository } from '../domain/github-integration.repository';

export interface PushWorkspaceInput {
  projectId: string;
  ownerId: string;
  repoName?: string;
  privateRepo?: boolean;
  commitMessage?: string;
}

export interface PushWorkspaceResult {
  owner: string;
  repo: string;
  url: string;
  stdout: string;
  stderr: string;
}

@Injectable()
export class PushWorkspaceUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly github: GitHubIntegrationRepository,
    private readonly exec: ExecCommandUseCase,
  ) {}

  async execute(input: PushWorkspaceInput): Promise<PushWorkspaceResult> {
    const project = await this.projects.findById(input.projectId);
    if (!project) throw new NotFoundError('Project', input.projectId);
    if (project.ownerId !== input.ownerId) throw new ForbiddenError('Not your project');

    const integration = await this.github.findByUserId(input.ownerId);
    if (!integration) throw new ValidationError('GitHub account not connected');

    const repoName = (input.repoName ?? project.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const octokit = new Octokit({ auth: integration.accessToken });

    let owner = integration.githubLogin;
    try {
      const { data } = await octokit.rest.repos.get({ owner, repo: repoName });
      owner = data.owner.login;
    } catch {
      const projectProps = project.toObject();
      const { data } = await octokit.rest.repos.createForAuthenticatedUser({
        name: repoName,
        private: input.privateRepo ?? true,
        auto_init: false,
        description: projectProps.description ?? `Built with Code.ae`,
      });
      owner = data.owner.login;
    }

    const message = input.commitMessage ?? `code.ae push ${new Date().toISOString()}`;
    const escapedMsg = message.replace(/"/g, '\\"');
    const remoteUrl = `https://x-access-token:${integration.accessToken}@github.com/${owner}/${repoName}.git`;

    // Without this .gitignore, `git add -A` snapshots the entire node_modules
    // tree (200-500 MB) which times out GitHub's push endpoint with HTTP 408.
    // We only write it if the user's project doesn't already have one.
    const defaultGitignore = [
      'node_modules/',
      '.next/',
      'dist/',
      'build/',
      'out/',
      'coverage/',
      '*.tsbuildinfo',
      '',
      '.env',
      '.env.local',
      '.env.*.local',
      '',
      '*.log',
      '.DS_Store',
      'Thumbs.db',
      '',
      '.turbo/',
      '.cache/',
    ].join('\\n');

    const script = [
      'set -e',
      'cd /home/workspace/project',
      `[ -f .gitignore ] || printf '%b' "${defaultGitignore}" > .gitignore`,
      '[ -d .git ] || git init -q',
      'git config user.email "noreply@code.ae"',
      `git config user.name "${integration.githubLogin}"`,
      // Bump buffer so large legitimate commits don't hit 408 either.
      'git config http.postBuffer 524288000',
      // Untrack anything that used to be staged but is now gitignored.
      'git rm -r --cached --ignore-unmatch -q . >/dev/null 2>&1 || true',
      'git add -A',
      `(git diff --cached --quiet || git commit -q -m "${escapedMsg}")`,
      '(git branch -M main 2>/dev/null || true)',
      `(git remote set-url origin "${remoteUrl}" 2>/dev/null || git remote add origin "${remoteUrl}")`,
      'git push -u origin main 2>&1',
    ].join(' && ');

    const result = await this.exec.execute(input.projectId, input.ownerId, {
      command: script,
      cwd: '/home/workspace/project',
      timeoutMs: 300_000,
    });

    if (result.exitCode !== 0) {
      throw new SandboxError(
        `git push failed (exit ${result.exitCode}):\n${result.stderr || result.stdout}`,
      );
    }

    // Persist repo URL on the project
    project.linkGithub(`https://github.com/${owner}/${repoName}`);
    await this.projects.save(project);

    return {
      owner,
      repo: repoName,
      url: `https://github.com/${owner}/${repoName}`,
      stdout: result.stdout.replace(new RegExp(integration.accessToken, 'g'), '***'),
      stderr: result.stderr.replace(new RegExp(integration.accessToken, 'g'), '***'),
    };
  }
}
