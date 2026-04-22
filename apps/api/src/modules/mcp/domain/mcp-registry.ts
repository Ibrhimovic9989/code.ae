import type { AgentToolDefinition } from '@code-ae/agent-runtime';

export interface McpToolCallResult {
  ok: boolean;
  output: unknown;
}

/** Per-call scope so the registry can surface project-specific MCP servers (e.g. Supabase per linked project). */
export interface McpScope {
  projectId?: string;
}

/**
 * Abstracts the live collection of MCP servers available to the agent.
 * Hides process management + tool-name namespacing from callers.
 */
export abstract class McpRegistry {
  abstract listTools(scope?: McpScope): AgentToolDefinition[];
  abstract isMcpToolName(name: string): boolean;
  abstract callTool(
    name: string,
    input: Record<string, unknown>,
    scope?: McpScope,
  ): Promise<McpToolCallResult>;

  /**
   * Ensure a Supabase MCP server is running for the given project, using the
   * caller's PAT and the linked Supabase project ref. Idempotent: reuses an
   * existing connection unless the token or ref changed.
   */
  abstract ensureSupabaseServer(projectId: string, accessToken: string, projectRef: string): Promise<void>;

  /** Stop and forget all project-scoped servers for the given project. */
  abstract unregisterProjectServers(projectId: string): Promise<void>;
}
