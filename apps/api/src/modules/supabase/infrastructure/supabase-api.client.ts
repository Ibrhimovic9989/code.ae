import { Injectable } from '@nestjs/common';
import { SandboxError } from '@code-ae/shared';

const API_BASE = 'https://api.supabase.com';

export interface SupabaseProject {
  id: string;
  ref: string;
  name: string;
  organization_id: string;
  region: string;
  status: string;
  created_at: string;
}

export interface SupabaseApiKey {
  name: 'anon' | 'service_role' | string;
  api_key: string;
}

export interface SupabaseOrganization {
  id: string;
  name: string;
  slug?: string;
}

@Injectable()
export class SupabaseApiClient {
  /** Validate the PAT by calling /v1/organizations. Returns org list (used as an auth probe). */
  async getOrganizations(token: string): Promise<SupabaseOrganization[]> {
    return (await this.call(token, '/v1/organizations', {})) as SupabaseOrganization[];
  }

  async listProjects(token: string): Promise<SupabaseProject[]> {
    return (await this.call(token, '/v1/projects', {})) as SupabaseProject[];
  }

  async getProject(token: string, ref: string): Promise<SupabaseProject> {
    return (await this.call(token, `/v1/projects/${encodeURIComponent(ref)}`, {})) as SupabaseProject;
  }

  /** Returns { anon, service_role } keys for a project. */
  async getApiKeys(token: string, ref: string): Promise<{ anon: string | null; serviceRole: string | null }> {
    const keys = (await this.call(
      token,
      `/v1/projects/${encodeURIComponent(ref)}/api-keys`,
      {},
    )) as SupabaseApiKey[];
    const anon = keys.find((k) => k.name === 'anon')?.api_key ?? null;
    const serviceRole = keys.find((k) => k.name === 'service_role')?.api_key ?? null;
    return { anon, serviceRole };
  }

  /** Build the public project URL (https://{ref}.supabase.co). */
  projectUrl(ref: string): string {
    return `https://${ref}.supabase.co`;
  }

  private async call(token: string, path: string, init: RequestInit): Promise<unknown> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new SandboxError(`Supabase API ${res.status}: ${text.slice(0, 500)}`);
    }
    return res.json();
  }
}
