import { Injectable } from '@nestjs/common';
import { SandboxError } from '@code-ae/shared';
import {
  SandboxAgentClient,
  type SandboxAgentEndpoint,
  type WriteFileInput,
  type ReadFileResult,
  type ListResult,
  type ExecInput,
  type ExecResult,
} from '../domain/sandbox-agent.client';

@Injectable()
export class HttpSandboxAgentClient extends SandboxAgentClient {
  async writeFile(
    ep: SandboxAgentEndpoint,
    input: WriteFileInput,
  ): Promise<{ path: string; bytes: number }> {
    return this.call(ep, '/fs/write', input);
  }

  readFile(ep: SandboxAgentEndpoint, path: string, encoding: 'utf-8' | 'base64' = 'utf-8'): Promise<ReadFileResult> {
    return this.call(ep, '/fs/read', { path, encoding });
  }

  listFiles(ep: SandboxAgentEndpoint, path: string): Promise<ListResult> {
    return this.call(ep, '/fs/list', { path });
  }

  async deleteFile(ep: SandboxAgentEndpoint, path: string, recursive: boolean): Promise<void> {
    await this.call(ep, '/fs/delete', { path, recursive });
  }

  async moveFile(ep: SandboxAgentEndpoint, from: string, to: string, overwrite: boolean): Promise<void> {
    await this.call(ep, '/fs/move', { from, to, overwrite });
  }

  exec(ep: SandboxAgentEndpoint, input: ExecInput): Promise<ExecResult> {
    return this.call(ep, '/shell/exec', input);
  }

  async execStream(ep: SandboxAgentEndpoint, input: ExecInput): Promise<Response> {
    const res = await fetch(`${ep.baseUrl}/shell/exec-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ep.token}`,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new SandboxError(`Sandbox agent /shell/exec-stream failed (${res.status}): ${await res.text()}`);
    }
    return res;
  }

  private async call<T>(ep: SandboxAgentEndpoint, path: string, body: unknown): Promise<T> {
    const res = await fetch(`${ep.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ep.token}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new SandboxError(`Sandbox agent ${path} failed (${res.status}): ${text}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new SandboxError(`Sandbox agent ${path} returned non-JSON: ${text.slice(0, 200)}`);
    }
  }
}
