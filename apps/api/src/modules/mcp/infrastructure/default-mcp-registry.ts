import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpClient, type McpServerSpec, type McpToolSchema } from '@code-ae/mcp-client';
import type { AgentToolDefinition } from '@code-ae/agent-runtime';
import type { AppConfig } from '../../../config/app.config';
import { McpRegistry, type McpScope, type McpToolCallResult } from '../domain/mcp-registry';

const PREFIX = 'mcp__';
const SUPABASE_SERVER_ID = 'supabase';

interface ConnectedServer {
  id: string;
  client: McpClient;
  tools: McpToolSchema[];
}

interface ProjectServer extends ConnectedServer {
  /** Signature derived from the (projectRef + token prefix) so rotations trigger reconnect. */
  signature: string;
}

@Injectable()
export class DefaultMcpRegistry extends McpRegistry implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DefaultMcpRegistry.name);
  private readonly globalServers: ConnectedServer[] = [];
  /** Key: `${projectId}:${serverId}`. */
  private readonly projectServers = new Map<string, ProjectServer>();

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    super();
  }

  onModuleInit(): void {
    const magicKey = this.config.get('MAGIC_MCP_API_KEY', { infer: true });
    if (magicKey) {
      void this.registerGlobal({
        id: 'magic',
        command: 'npx',
        args: ['-y', '@21st-dev/magic@latest', `API_KEY="${magicKey}"`],
      });
    } else {
      this.logger.log('MAGIC_MCP_API_KEY not set — 21st.dev Magic MCP disabled');
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const s of this.globalServers) s.client.close();
    for (const s of this.projectServers.values()) s.client.close();
  }

  listTools(scope?: McpScope): AgentToolDefinition[] {
    const out: AgentToolDefinition[] = [];
    for (const s of this.globalServers) this.appendTools(out, s);
    if (scope?.projectId) {
      for (const [key, s] of this.projectServers) {
        if (key.startsWith(`${scope.projectId}:`)) this.appendTools(out, s);
      }
    }
    return out;
  }

  isMcpToolName(name: string): boolean {
    return name.startsWith(PREFIX);
  }

  async callTool(
    name: string,
    input: Record<string, unknown>,
    scope?: McpScope,
  ): Promise<McpToolCallResult> {
    if (!this.isMcpToolName(name)) {
      return { ok: false, output: { error: `Not an MCP tool: ${name}` } };
    }
    const suffix = name.slice(PREFIX.length);
    const sep = suffix.indexOf('__');
    if (sep < 0) return { ok: false, output: { error: `Malformed MCP tool name: ${name}` } };
    const serverId = suffix.slice(0, sep);
    const toolName = suffix.slice(sep + 2);

    const server =
      (scope?.projectId ? this.projectServers.get(`${scope.projectId}:${serverId}`) : undefined) ??
      this.globalServers.find((s) => s.id === serverId);
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

  async ensureSupabaseServer(projectId: string, accessToken: string, projectRef: string): Promise<void> {
    const key = `${projectId}:${SUPABASE_SERVER_ID}`;
    const signature = `${projectRef}:${accessToken.slice(0, 8)}`;
    const existing = this.projectServers.get(key);
    if (existing && existing.signature === signature) return;
    if (existing) existing.client.close();

    try {
      const spec: McpServerSpec = {
        id: SUPABASE_SERVER_ID,
        command: 'npx',
        args: ['-y', '@supabase/mcp-server-supabase@latest', `--project-ref=${projectRef}`],
        env: { SUPABASE_ACCESS_TOKEN: accessToken },
      };
      const client = new McpClient(spec);
      await client.initialize();
      const tools = await client.listTools();
      this.projectServers.set(key, { id: SUPABASE_SERVER_ID, client, tools, signature });
      this.logger.log(`MCP: connected supabase for project ${projectId} (${tools.length} tools)`);
    } catch (err) {
      this.logger.warn(
        `MCP: failed to connect supabase for project ${projectId}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  async unregisterProjectServers(projectId: string): Promise<void> {
    for (const [key, server] of this.projectServers) {
      if (key.startsWith(`${projectId}:`)) {
        server.client.close();
        this.projectServers.delete(key);
      }
    }
  }

  private appendTools(out: AgentToolDefinition[], s: ConnectedServer): void {
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

  private async registerGlobal(spec: McpServerSpec): Promise<void> {
    try {
      const client = new McpClient(spec);
      await client.initialize();
      const tools = await client.listTools();
      this.globalServers.push({ id: spec.id, client, tools });
      this.logger.log(`MCP: connected ${spec.id} (${tools.length} tools)`);
    } catch (err) {
      this.logger.warn(
        `MCP: failed to connect ${spec.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
