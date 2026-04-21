import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpClient, type McpServerSpec, type McpToolSchema } from '@code-ae/mcp-client';
import type { AgentToolDefinition } from '@code-ae/agent-runtime';
import type { AppConfig } from '../../../config/app.config';
import { McpRegistry, type McpToolCallResult } from '../domain/mcp-registry';

const PREFIX = 'mcp__';

interface ConnectedServer {
  id: string;
  client: McpClient;
  tools: McpToolSchema[];
}

@Injectable()
export class DefaultMcpRegistry extends McpRegistry implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DefaultMcpRegistry.name);
  private readonly servers: ConnectedServer[] = [];

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    super();
  }

  onModuleInit(): void {
    // Fire-and-forget: MCP servers (npx-hosted ones in particular) can take
    // 30-90s to download + initialize on first run. We don't block Nest's
    // boot on that; tools become available once the handshake completes.
    const magicKey = this.config.get('MAGIC_MCP_API_KEY', { infer: true });
    if (magicKey) {
      void this.register({
        id: 'magic',
        command: 'npx',
        args: ['-y', '@21st-dev/magic@latest', `API_KEY="${magicKey}"`],
      });
    } else {
      this.logger.log('MAGIC_MCP_API_KEY not set — 21st.dev Magic MCP disabled');
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const s of this.servers) s.client.close();
  }

  listTools(): AgentToolDefinition[] {
    const out: AgentToolDefinition[] = [];
    for (const s of this.servers) {
      for (const t of s.tools) {
        out.push({
          name: `${PREFIX}${s.id}__${t.name}`,
          description: t.description ?? `[${s.id}] ${t.name}`,
          parameters: (t.inputSchema ?? {
            type: 'object',
            properties: {},
            additionalProperties: true,
          }) as Record<string, unknown>,
        });
      }
    }
    return out;
  }

  isMcpToolName(name: string): boolean {
    return name.startsWith(PREFIX);
  }

  async callTool(name: string, input: Record<string, unknown>): Promise<McpToolCallResult> {
    if (!this.isMcpToolName(name)) {
      return { ok: false, output: { error: `Not an MCP tool: ${name}` } };
    }
    const suffix = name.slice(PREFIX.length);
    const sep = suffix.indexOf('__');
    if (sep < 0) return { ok: false, output: { error: `Malformed MCP tool name: ${name}` } };
    const serverId = suffix.slice(0, sep);
    const toolName = suffix.slice(sep + 2);

    const server = this.servers.find((s) => s.id === serverId);
    if (!server) return { ok: false, output: { error: `Unknown MCP server: ${serverId}` } };

    try {
      const result = await server.client.callTool(toolName, input);
      const text = result.content
        .map((c) => {
          if (c.type === 'text') return c.text;
          if (c.type === 'image') return `[image ${c.mimeType}]`;
          if (c.type === 'resource') return c.resource.text ?? `[resource ${c.resource.uri}]`;
          return '';
        })
        .join('\n');
      return { ok: !result.isError, output: { text } };
    } catch (err) {
      return {
        ok: false,
        output: { error: err instanceof Error ? err.message : String(err) },
      };
    }
  }

  private async register(spec: McpServerSpec): Promise<void> {
    try {
      const client = new McpClient(spec);
      await client.initialize();
      const tools = await client.listTools();
      this.servers.push({ id: spec.id, client, tools });
      this.logger.log(`MCP: connected ${spec.id} (${tools.length} tools)`);
    } catch (err) {
      this.logger.warn(
        `MCP: failed to connect ${spec.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
