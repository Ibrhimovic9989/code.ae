import type { AgentProvider, AgentCompletionRequest } from './providers/provider';
import type { AgentRunnerConfig, AgentStreamEvent, AgentMessage, AgentToolDefinition } from './types';

export interface RunnerInput {
  systemPrompt: string;
  messages: AgentMessage[];
  tools?: AgentToolDefinition[];
}

export class CodeAeAgentRunner {
  constructor(
    private readonly provider: AgentProvider,
    private readonly config: AgentRunnerConfig,
  ) {}

  run(input: RunnerInput): AsyncGenerator<AgentStreamEvent> {
    const req: AgentCompletionRequest = {
      systemPrompt: input.systemPrompt,
      messages: input.messages,
      ...(input.tools ? { tools: input.tools } : {}),
      ...(this.config.abortSignal ? { abortSignal: this.config.abortSignal } : {}),
    };
    return this.provider.stream(req);
  }
}
