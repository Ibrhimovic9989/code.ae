import type { AgentStreamEvent, AgentToolDefinition, AgentMessage } from '../types';

export interface AgentProviderConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion?: string;
}

export interface AgentCompletionRequest {
  systemPrompt: string;
  messages: AgentMessage[];
  tools?: AgentToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
}

export abstract class AgentProvider {
  abstract readonly name: string;
  abstract stream(request: AgentCompletionRequest): AsyncGenerator<AgentStreamEvent>;
}
