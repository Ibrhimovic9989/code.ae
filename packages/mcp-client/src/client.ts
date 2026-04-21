import { StdioMcpTransport } from './stdio-transport';
import type { McpServerSpec, McpToolResult, McpToolSchema } from './types';

const PROTOCOL_VERSION = '2024-11-05';

export class McpClient {
  private readonly transport: StdioMcpTransport;
  private initialized = false;

  constructor(spec: McpServerSpec) {
    this.transport = new StdioMcpTransport(spec);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.transport.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      clientInfo: { name: 'code.ae', version: '0.1.0' },
    });
    // MCP requires the client to confirm readiness with a notification.
    this.transport.notify('notifications/initialized');
    this.initialized = true;
  }

  async listTools(): Promise<McpToolSchema[]> {
    if (!this.initialized) await this.initialize();
    const res = (await this.transport.request('tools/list')) as { tools: McpToolSchema[] };
    return res.tools ?? [];
  }

  async callTool(name: string, args: unknown, timeoutMs = 120_000): Promise<McpToolResult> {
    if (!this.initialized) await this.initialize();
    const res = (await this.transport.request(
      'tools/call',
      { name, arguments: args },
      timeoutMs,
    )) as McpToolResult;
    return res;
  }

  close(): void {
    this.transport.close();
  }
}
