import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { JsonRpcNotification, JsonRpcResponse, McpServerSpec } from './types';

export type NotificationHandler = (n: JsonRpcNotification) => void;

/**
 * Newline-delimited JSON-RPC 2.0 over the child process's stdio.
 * One shared process per server spec, re-used across all requests.
 */
export class StdioMcpTransport {
  private readonly proc: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, (res: JsonRpcResponse) => void>();
  private readonly notificationHandlers: NotificationHandler[] = [];
  private buffer = '';
  private nextId = 1;
  private closedReason: string | null = null;

  constructor(spec: McpServerSpec) {
    this.proc = spawn(spec.command, spec.args, {
      env: { ...process.env, ...(spec.env ?? {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stdout.on('data', this.onStdout);
    this.proc.stderr.on('data', (chunk: Buffer) => {
      // MCP servers often log to stderr. Surface it but don't treat as an error.
      // eslint-disable-next-line no-console
      console.warn(`[mcp:${spec.id}] ${chunk.toString('utf-8').trimEnd()}`);
    });
    this.proc.on('exit', (code, signal) => {
      this.closedReason = `exited code=${code} signal=${signal}`;
      for (const resolve of this.pending.values()) {
        resolve({
          jsonrpc: '2.0',
          id: -1,
          error: { code: -32000, message: `MCP server ${spec.id} ${this.closedReason}` },
        });
      }
      this.pending.clear();
    });
  }

  onNotification(handler: NotificationHandler): void {
    this.notificationHandlers.push(handler);
  }

  async request(method: string, params?: unknown, timeoutMs = 30_000): Promise<unknown> {
    if (this.closedReason) throw new Error(`Transport closed: ${this.closedReason}`);

    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, (res) => {
        clearTimeout(timer);
        if (res.error) reject(new Error(`${res.error.code}: ${res.error.message}`));
        else resolve(res.result);
      });

      this.proc.stdin.write(payload + '\n');
    });
  }

  notify(method: string, params?: unknown): void {
    if (this.closedReason) return;
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params });
    this.proc.stdin.write(payload + '\n');
  }

  close(): void {
    if (this.closedReason) return;
    this.closedReason = 'explicit close';
    this.proc.kill('SIGTERM');
    setTimeout(() => {
      if (!this.proc.killed) this.proc.kill('SIGKILL');
    }, 2000).unref();
  }

  private readonly onStdout = (chunk: Buffer): void => {
    this.buffer += chunk.toString('utf-8');
    let newlineIdx: number;
    while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIdx).trim();
      this.buffer = this.buffer.slice(newlineIdx + 1);
      if (!line) continue;

      try {
        const msg = JSON.parse(line) as JsonRpcResponse | JsonRpcNotification;
        if ('id' in msg && typeof msg.id === 'number') {
          const handler = this.pending.get(msg.id);
          if (handler) {
            this.pending.delete(msg.id);
            handler(msg as JsonRpcResponse);
          }
        } else if ('method' in msg) {
          for (const h of this.notificationHandlers) h(msg as JsonRpcNotification);
        }
      } catch {
        // eslint-disable-next-line no-console
        console.warn(`[mcp] invalid JSON-RPC line: ${line.slice(0, 200)}`);
      }
    }
  };
}
