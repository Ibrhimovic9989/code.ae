import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SandboxError, type Sandbox, type SandboxSpec } from '@code-ae/shared';
import { OrchestratorClient } from '../domain/orchestrator-client';
import type { AppConfig } from '../../../config/app.config';

@Injectable()
export class HttpOrchestratorClient extends OrchestratorClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService<AppConfig, true>) {
    super();
    this.baseUrl = config.get('ORCHESTRATOR_URL', { infer: true });
  }

  async createSandbox(spec: SandboxSpec): Promise<Sandbox> {
    const res = await fetch(`${this.baseUrl}/sandboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
    });
    if (!res.ok) {
      throw new SandboxError(`Orchestrator create failed (${res.status}): ${await res.text()}`);
    }
    const body = (await res.json()) as { sandbox: Sandbox };
    return this.normalizeDates(body.sandbox);
  }

  async getSandbox(id: string): Promise<Sandbox | null> {
    const res = await fetch(`${this.baseUrl}/sandboxes/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new SandboxError(`Orchestrator get failed (${res.status}): ${await res.text()}`);
    }
    const body = (await res.json()) as { sandbox: Sandbox };
    return this.normalizeDates(body.sandbox);
  }

  async stopSandbox(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sandboxes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 404) {
      throw new SandboxError(`Orchestrator stop failed (${res.status}): ${await res.text()}`);
    }
  }

  private normalizeDates(raw: Sandbox): Sandbox {
    return {
      ...raw,
      createdAt: new Date(raw.createdAt),
      ...(raw.stoppedAt ? { stoppedAt: new Date(raw.stoppedAt) } : {}),
    };
  }
}
