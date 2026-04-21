import { AzureOpenAI } from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { AgentProvider, type AgentCompletionRequest, type AgentProviderConfig } from './provider';
import type { AgentStreamEvent } from '../types';

export class AzureOpenAIProvider extends AgentProvider {
  readonly name = 'azure-openai';
  private readonly client: AzureOpenAI;
  private readonly deployment: string;

  constructor(config: AgentProviderConfig) {
    super();
    this.client = new AzureOpenAI({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      apiVersion: config.apiVersion ?? '2025-04-01-preview',
      deployment: config.deployment,
    });
    this.deployment = config.deployment;
  }

  async *stream(request: AgentCompletionRequest): AsyncGenerator<AgentStreamEvent> {
    try {
      const openaiMessages = this.toOpenAIMessages(request);
      const tools = this.toOpenAITools(request.tools);

      const stream = await this.client.chat.completions.create({
        model: this.deployment,
        messages: openaiMessages,
        ...(tools.length > 0 ? { tools } : {}),
        max_completion_tokens: request.maxTokens ?? 8192,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        stream: true,
      });

      const activeToolCalls = new Map<number, { id: string; name: string; args: string }>();
      let finishReason = 'stop';

      for await (const chunk of stream) {
        if (request.abortSignal?.aborted) {
          yield { type: 'error', error: 'aborted' };
          return;
        }

        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;
        if (delta?.content) {
          yield { type: 'assistant-text', text: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            const existing = activeToolCalls.get(idx) ?? { id: '', name: '', args: '' };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.args += tc.function.arguments;
            activeToolCalls.set(idx, existing);
          }
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }

      for (const tc of activeToolCalls.values()) {
        let parsedInput: Record<string, unknown> = {};
        try {
          parsedInput = tc.args ? (JSON.parse(tc.args) as Record<string, unknown>) : {};
        } catch {
          yield { type: 'error', error: `Malformed tool arguments for ${tc.name}: ${tc.args}` };
          continue;
        }
        yield { type: 'tool-call', id: tc.id, name: tc.name, input: parsedInput };
      }

      yield { type: 'turn-complete', stopReason: finishReason };
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err.message : String(err) };
    }
  }

  private toOpenAIMessages(request: AgentCompletionRequest): ChatCompletionMessageParam[] {
    const msgs: ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt },
    ];

    for (const m of request.messages) {
      if (m.role === 'tool') {
        msgs.push({
          role: 'tool',
          tool_call_id: m.toolCallId ?? '',
          content: m.content,
        });
        continue;
      }

      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        msgs.push({
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.input) },
          })),
        });
        continue;
      }

      if (m.role === 'user' || m.role === 'assistant' || m.role === 'system') {
        msgs.push({ role: m.role, content: m.content });
      }
    }

    return msgs;
  }

  private toOpenAITools(defs: AgentCompletionRequest['tools']): ChatCompletionTool[] {
    if (!defs) return [];
    return defs.map((d) => ({
      type: 'function',
      function: {
        name: d.name,
        description: d.description,
        parameters: d.parameters as Record<string, unknown>,
      },
    }));
  }
}
