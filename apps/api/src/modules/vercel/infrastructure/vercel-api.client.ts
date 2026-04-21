import { Injectable } from '@nestjs/common';
import { SandboxError } from '@code-ae/shared';

const API_BASE = 'https://api.vercel.com';

export interface VercelUser {
  id: string;
  username: string;
  email?: string;
}

export interface VercelDeployment {
  uid: string;
  url: string;
  state: 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED' | 'QUEUED' | 'INITIALIZING';
  createdAt: number;
  target?: string;
  meta?: Record<string, string>;
}

export interface VercelProject {
  id: string;
  name: string;
  framework?: string;
  link?: { type: string; repo: string; repoId: number };
}

@Injectable()
export class VercelApiClient {
  async getAuthenticatedUser(token: string): Promise<VercelUser> {
    const res = await this.call(token, '/v2/user', {});
    const body = res as { user: VercelUser };
    if (!body.user) throw new SandboxError('Vercel /v2/user returned no user');
    return body.user;
  }

  async findProjectByName(token: string, teamId: string | null, name: string): Promise<VercelProject | null> {
    const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
    const res = await this.callRaw(token, `/v10/projects/${encodeURIComponent(name)}${qs}`, {});
    if (res.status === 404) return null;
    if (!res.ok) await this.throwApiError(res);
    return (await res.json()) as VercelProject;
  }

  async createProject(
    token: string,
    teamId: string | null,
    input: {
      name: string;
      framework?: string;
      gitRepository?: { type: 'github'; repo: string };
      rootDirectory?: string;
    },
  ): Promise<VercelProject> {
    const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
    const res = await this.call(token, `/v11/projects${qs}`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res as VercelProject;
  }

  async createDeployment(
    token: string,
    teamId: string | null,
    input: {
      name: string;
      gitSource: { type: 'github'; repoId?: number; repo?: string; ref: string };
      target?: 'production' | 'staging';
      projectSettings?: Record<string, unknown>;
    },
  ): Promise<VercelDeployment> {
    const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
    const res = await this.call(token, `/v13/deployments${qs}`, {
      method: 'POST',
      body: JSON.stringify({ ...input, target: input.target ?? 'production' }),
    });
    return res as VercelDeployment;
  }

  async getDeployment(token: string, teamId: string | null, deploymentId: string): Promise<VercelDeployment> {
    const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
    const res = await this.call(token, `/v13/deployments/${encodeURIComponent(deploymentId)}${qs}`, {});
    return res as VercelDeployment;
  }

  async listDeployments(
    token: string,
    teamId: string | null,
    projectId: string,
    limit = 1,
  ): Promise<VercelDeployment[]> {
    const params = new URLSearchParams({ projectId, limit: String(limit) });
    if (teamId) params.set('teamId', teamId);
    const res = await this.call(token, `/v6/deployments?${params.toString()}`, {});
    return ((res as { deployments: VercelDeployment[] }).deployments ?? []);
  }

  private async call(token: string, path: string, init: RequestInit): Promise<unknown> {
    const res = await this.callRaw(token, path, init);
    if (!res.ok) await this.throwApiError(res);
    return res.json();
  }

  private async callRaw(token: string, path: string, init: RequestInit): Promise<Response> {
    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  }

  private async throwApiError(res: Response): Promise<never> {
    const text = await res.text();
    throw new SandboxError(`Vercel API ${res.status}: ${text.slice(0, 500)}`);
  }
}
