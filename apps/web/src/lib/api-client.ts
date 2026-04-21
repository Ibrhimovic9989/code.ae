import type { Project, Sandbox, Session } from '@code-ae/shared';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string | undefined, message: string) {
    super(message);
  }
}

export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  locale: 'ar' | 'en';
}

class ApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  get token(): string | null {
    return this.accessToken;
  }

  get baseUrl(): string {
    return API_URL;
  }

  async register(input: {
    email: string;
    password: string;
    displayName: string;
    locale?: 'ar' | 'en';
  }): Promise<{ user: ApiUser; accessToken: string }> {
    return this.request('/auth/register', { method: 'POST', body: input });
  }

  async login(input: { email: string; password: string }): Promise<{ user: ApiUser; accessToken: string }> {
    return this.request('/auth/login', { method: 'POST', body: input });
  }

  async refresh(): Promise<{ accessToken: string }> {
    return this.request('/auth/refresh', { method: 'POST' });
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
  }

  async me(): Promise<{ user: ApiUser }> {
    return this.request('/auth/me', { method: 'GET' });
  }

  async listProjects(): Promise<{ projects: Project[] }> {
    return this.request('/projects', { method: 'GET' });
  }

  async createProject(input: {
    slug: string;
    name: string;
    description?: string;
    template: string;
    visibility: 'private' | 'unlisted' | 'public';
  }): Promise<{ project: Project }> {
    return this.request('/projects', { method: 'POST', body: input });
  }

  async getSandbox(projectId: string): Promise<{ sandbox: Sandbox | null }> {
    return this.request(`/projects/${projectId}/sandbox`, { method: 'GET' });
  }

  async createSession(projectId: string): Promise<{ session: Session }> {
    return this.request(`/projects/${projectId}/sessions`, { method: 'POST' });
  }

  async listMessages(sessionId: string): Promise<{ messages: Array<Record<string, unknown>> }> {
    return this.request(`/sessions/${sessionId}/messages`, { method: 'GET' });
  }

  async listFiles(projectId: string, path = '.'): Promise<{
    path: string;
    entries: Array<{ name: string; type: 'file' | 'dir' | 'other' }>;
  }> {
    return this.request(`/projects/${projectId}/files/list?path=${encodeURIComponent(path)}`, {
      method: 'GET',
    });
  }

  async readFile(projectId: string, path: string): Promise<{ content: string; bytes: number }> {
    return this.request(
      `/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
      { method: 'GET' },
    );
  }

  async writeFile(projectId: string, path: string, content: string): Promise<{ bytes: number }> {
    return this.request(`/projects/${projectId}/files`, {
      method: 'POST',
      body: { path, content },
    });
  }

  async writeFileBase64(projectId: string, path: string, base64: string): Promise<{ bytes: number }> {
    return this.request(`/projects/${projectId}/files`, {
      method: 'POST',
      body: { path, content: base64, encoding: 'base64' },
    });
  }

  async moveFile(projectId: string, from: string, to: string, overwrite = false): Promise<void> {
    await this.request(`/projects/${projectId}/files/move`, {
      method: 'POST',
      body: { from, to, overwrite },
    });
  }

  async deleteFile(projectId: string, path: string, recursive = false): Promise<void> {
    await this.request(
      `/projects/${projectId}/files?path=${encodeURIComponent(path)}&recursive=${recursive}`,
      { method: 'DELETE' },
    );
  }

  async listSecrets(
    projectId: string,
    scope?: 'development' | 'production',
  ): Promise<{ secrets: Array<{ id: string; key: string; scope: string; createdAt: string; updatedAt: string }> }> {
    const q = scope ? `?scope=${scope}` : '';
    return this.request(`/projects/${projectId}/secrets${q}`, { method: 'GET' });
  }

  async upsertSecret(
    projectId: string,
    input: { key: string; value: string; scope: 'development' | 'production' },
  ): Promise<{ secret: { id: string; key: string; scope: string } }> {
    return this.request(`/projects/${projectId}/secrets`, { method: 'POST', body: input });
  }

  async deleteSecret(secretId: string): Promise<void> {
    await this.request(`/secrets/${secretId}`, { method: 'DELETE' });
  }

  async getGitHubIntegration(): Promise<{
    integration: { githubLogin: string; scopes: string; connectedAt: string } | null;
  }> {
    return this.request('/auth/github', { method: 'GET' });
  }

  async startGitHubOAuth(): Promise<{ url: string; state: string }> {
    return this.request('/auth/github/start', { method: 'GET' });
  }

  async pushToGitHub(
    projectId: string,
    input: { repoName?: string; privateRepo?: boolean; commitMessage?: string } = {},
  ): Promise<{ ok: boolean; owner: string; repo: string; url: string; stdout: string; stderr: string }> {
    return this.request(`/projects/${projectId}/github/push`, { method: 'POST', body: input });
  }

  async getVercelIntegration(): Promise<{
    integration: { vercelUsername: string; teamId: string | null; connectedAt: string } | null;
  }> {
    return this.request('/auth/vercel', { method: 'GET' });
  }

  async connectVercel(accessToken: string, teamId?: string): Promise<{ integration: { vercelUsername: string } }> {
    return this.request('/auth/vercel/connect', {
      method: 'POST',
      body: { accessToken, ...(teamId ? { teamId } : {}) },
    });
  }

  async disconnectVercel(): Promise<void> {
    await this.request('/auth/vercel', { method: 'DELETE' });
  }

  async publishProject(
    projectId: string,
  ): Promise<{ projectId: string; projectName: string; deploymentId: string; deploymentUrl: string; state: string }> {
    return this.request(`/projects/${projectId}/publish`, { method: 'POST' });
  }

  async getLatestDeployment(
    projectId: string,
  ): Promise<{ deployment: { uid: string; url: string; state: string; createdAt: number } | null }> {
    return this.request(`/projects/${projectId}/deployment`, { method: 'GET' });
  }

  streamMessage(
    sessionId: string,
    content: string,
    locale?: 'ar' | 'en',
    toolResponses?: Array<{ id: string; content: unknown }>,
  ): Promise<Response> {
    return fetch(`${API_URL}/sessions/${sessionId}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify({
        content,
        ...(locale ? { locale } : {}),
        ...(toolResponses && toolResponses.length > 0 ? { toolResponses } : {}),
      }),
    });
  }

  streamExec(projectId: string, command: string, cwd = '.'): Promise<Response> {
    return fetch(`${API_URL}/projects/${projectId}/exec/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify({ command, cwd }),
    });
  }

  private async request<T>(path: string, opts: { method: string; body?: unknown }): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      method: opts.method,
      credentials: 'include',
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* non-json */
    }

    if (!res.ok) {
      const err = (parsed as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(res.status, err?.code, err?.message ?? text ?? `HTTP ${res.status}`);
    }
    return parsed as T;
  }
}

export const api = new ApiClient();
