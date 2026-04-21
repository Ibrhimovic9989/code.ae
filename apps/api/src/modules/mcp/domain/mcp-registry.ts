import type { AgentToolDefinition } from '@code-ae/agent-runtime';

export interface McpToolCallResult {
  ok: boolean;
  output: unknown;
}

/**
 * Abstracts the live collection of MCP servers available to the agent.
 * Hides process management + tool-name namespacing from callers.
 */
export abstract class McpRegistry {
  abstract listTools(): AgentToolDefinition[];
  abstract isMcpToolName(name: string): boolean;
  abstract callTool(name: string, input: Record<string, unknown>): Promise<McpToolCallResult>;
}
