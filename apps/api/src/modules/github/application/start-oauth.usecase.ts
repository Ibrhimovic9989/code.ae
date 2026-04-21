import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { SandboxError } from '@code-ae/shared';
import type { AppConfig } from '../../../config/app.config';

const AUTHORIZE = 'https://github.com/login/oauth/authorize';

@Injectable()
export class StartGitHubOAuthUseCase {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  execute(userId: string): { url: string; state: string } {
    const clientId = this.config.get('GITHUB_OAUTH_CLIENT_ID', { infer: true });
    const redirect = this.config.get('GITHUB_OAUTH_REDIRECT_URL', { infer: true });
    if (!clientId) throw new SandboxError('GITHUB_OAUTH_CLIENT_ID not configured');

    // Compact signed-ish state: random nonce + userId. We don't verify signatures since
    // the callback cross-checks userId against the current JWT's sub.
    const nonce = randomBytes(16).toString('hex');
    const state = `${nonce}.${userId}`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      scope: 'repo user:email',
      state,
      allow_signup: 'true',
    });

    return { url: `${AUTHORIZE}?${params.toString()}`, state };
  }
}
