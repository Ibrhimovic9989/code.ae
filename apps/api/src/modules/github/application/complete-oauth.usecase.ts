import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { SandboxError, ValidationError } from '@code-ae/shared';
import { Octokit } from 'octokit';
import { GitHubIntegrationEntity } from '../domain/github-integration.entity';
import { GitHubIntegrationRepository } from '../domain/github-integration.repository';
import type { AppConfig } from '../../../config/app.config';

const TOKEN_URL = 'https://github.com/login/oauth/access_token';

@Injectable()
export class CompleteGitHubOAuthUseCase {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly repo: GitHubIntegrationRepository,
  ) {}

  async execute(code: string, state: string, currentUserId: string): Promise<GitHubIntegrationEntity> {
    const [, stateUserId] = state.split('.');
    if (!stateUserId || stateUserId !== currentUserId) {
      throw new ValidationError('OAuth state/user mismatch');
    }

    const clientId = this.config.get('GITHUB_OAUTH_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('GITHUB_OAUTH_CLIENT_SECRET', { infer: true });
    const redirect = this.config.get('GITHUB_OAUTH_REDIRECT_URL', { infer: true });
    if (!clientId || !clientSecret) throw new SandboxError('GitHub OAuth not configured');

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirect,
      }),
    });
    if (!tokenRes.ok) throw new SandboxError(`GitHub token exchange failed: ${tokenRes.status}`);
    const tokenBody = (await tokenRes.json()) as {
      access_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenBody.access_token) {
      throw new SandboxError(`GitHub token exchange error: ${tokenBody.error_description ?? tokenBody.error ?? 'no token'}`);
    }

    const octokit = new Octokit({ auth: tokenBody.access_token });
    const { data: me } = await octokit.rest.users.getAuthenticated();

    const existing = await this.repo.findByUserId(currentUserId);
    if (existing) {
      existing.rotate(tokenBody.access_token, tokenBody.scope ?? 'repo');
      await this.repo.save(existing);
      return existing;
    }

    const now = new Date();
    const entity = GitHubIntegrationEntity.create({
      id: randomUUID(),
      userId: currentUserId,
      githubLogin: me.login,
      githubId: me.id,
      accessToken: tokenBody.access_token,
      scopes: tokenBody.scope ?? 'repo',
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.save(entity);
    return entity;
  }
}
