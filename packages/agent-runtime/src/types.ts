export interface AgentRunnerConfig {
  sessionId: string;
  projectId: string;
  workingDirectory: string;
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';
  maxTurns?: number;
  abortSignal?: AbortSignal;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: AgentToolCall[];
  toolCallId?: string;
  /**
   * Optional inline images attached to a user message. Each entry is a full
   * data URL (`data:image/png;base64,…`) or an https URL. Provider serializes
   * these as multimodal content parts. Ignored on non-user roles.
   */
  images?: string[];
}

export interface AgentToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type AgentStreamEvent =
  | { type: 'assistant-text'; text: string }
  | { type: 'tool-call'; name: string; input: Record<string, unknown>; id: string }
  | { type: 'tool-result'; id: string; output: unknown; isError: boolean }
  | { type: 'turn-complete'; stopReason: string }
  | { type: 'error'; error: string };
