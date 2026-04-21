import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ForbiddenError, NotFoundError, ValidationError } from '@code-ae/shared';
import {
  AzureOpenAIProvider,
  CodeAeAgentRunner,
  buildSystemPrompt,
  type AgentMessage,
  type AgentStreamEvent,
} from '@code-ae/agent-runtime';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { SessionRepository, MessageRepository } from '../domain/session.repository';
import { MessageEntity, type MessageToolCall } from '../domain/message.entity';
import { ToolDispatcher } from './tool-dispatcher';
import { AGENT_TOOLS } from './agent-tools';
import type { AppConfig } from '../../../config/app.config';

export type SessionStreamEvent =
  | { type: 'assistant-text'; text: string }
  | { type: 'tool-call'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool-result'; id: string; ok: boolean; output: unknown }
  | { type: 'turn-complete'; stopReason: string }
  | { type: 'error'; error: string };

@Injectable()
export class SendMessageUseCase {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly deployment: string;
  private readonly apiVersion: string;
  private readonly maxTurns = 8;

  constructor(
    private readonly projects: ProjectRepository,
    private readonly sessions: SessionRepository,
    private readonly messages: MessageRepository,
    private readonly dispatcher: ToolDispatcher,
    config: ConfigService<AppConfig, true>,
  ) {
    this.endpoint = config.get('AZURE_OPENAI_ENDPOINT', { infer: true });
    this.apiKey = config.get('AZURE_OPENAI_API_KEY', { infer: true });
    this.deployment = config.get('AZURE_OPENAI_DEPLOYMENT', { infer: true });
    this.apiVersion = config.get('AZURE_OPENAI_API_VERSION', { infer: true });
  }

  async *execute(
    sessionId: string,
    ownerId: string,
    userContent: string,
  ): AsyncGenerator<SessionStreamEvent> {
    if (!userContent.trim()) throw new ValidationError('Message content is required');

    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundError('Session', sessionId);
    const project = await this.projects.findById(session.projectId);
    if (!project) throw new NotFoundError('Project', session.projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your session');

    // Persist user message, bump activity timestamp.
    await this.messages.append(
      MessageEntity.create({
        id: randomUUID(),
        sessionId: session.id,
        role: 'user',
        content: userContent,
        toolCalls: null,
        toolCallId: null,
        createdAt: new Date(),
      }),
    );
    session.touch();
    await this.sessions.save(session);

    // Build provider + runner once per send.
    const provider = new AzureOpenAIProvider({
      endpoint: this.endpoint,
      apiKey: this.apiKey,
      deployment: this.deployment,
      apiVersion: this.apiVersion,
    });
    const runner = new CodeAeAgentRunner(provider, {
      sessionId: session.id,
      projectId: project.id,
      workingDirectory: '/home/workspace/project',
    });

    // Convert persisted history to agent-runtime messages.
    const history = await this.messages.listBySession(session.id);
    const agentMessages: AgentMessage[] = history.map((m) => this.toAgentMessage(m));

    const systemPrompt = buildSystemPrompt({
      projectName: project.slug,
      projectTemplate: 'next-nest-monorepo',
      userLocale: (project as unknown as { ownerId: string } & { locale?: 'ar' | 'en' }).locale ?? 'ar',
      hasBackend: true,
      hasFrontend: true,
    });

    let assistantTextBuffer = '';
    let pendingToolCalls: MessageToolCall[] = [];

    for (let turn = 0; turn < this.maxTurns; turn++) {
      assistantTextBuffer = '';
      pendingToolCalls = [];

      const stream = runner.run({ systemPrompt, messages: agentMessages, tools: AGENT_TOOLS });

      for await (const ev of stream) {
        const out = this.translate(ev);
        if (!out) continue;

        if (out.type === 'assistant-text') {
          assistantTextBuffer += out.text;
          yield out;
        } else if (out.type === 'tool-call') {
          pendingToolCalls.push({ id: out.id, name: out.name, input: out.input });
          yield out;
        } else if (out.type === 'turn-complete') {
          yield out;
        } else if (out.type === 'error') {
          yield out;
          return;
        }
      }

      // Persist the assistant turn (text + tool calls).
      const assistantMessage = MessageEntity.create({
        id: randomUUID(),
        sessionId: session.id,
        role: 'assistant',
        content: assistantTextBuffer,
        toolCalls: pendingToolCalls.length > 0 ? pendingToolCalls : null,
        toolCallId: null,
        createdAt: new Date(),
      });
      await this.messages.append(assistantMessage);
      agentMessages.push(this.toAgentMessage(assistantMessage));

      if (pendingToolCalls.length === 0) {
        // No more tools -> terminal turn.
        session.touch();
        await this.sessions.save(session);
        return;
      }

      // Execute each tool, persist result, feed back to model.
      for (const call of pendingToolCalls) {
        const result = await this.dispatcher.dispatch(call.name, call.input, {
          projectId: project.id,
          ownerId,
        });
        yield { type: 'tool-result', id: call.id, ok: result.ok, output: result.output };

        const resultMessage = MessageEntity.create({
          id: randomUUID(),
          sessionId: session.id,
          role: 'tool',
          content: JSON.stringify(result.output),
          toolCalls: null,
          toolCallId: call.id,
          createdAt: new Date(),
        });
        await this.messages.append(resultMessage);
        agentMessages.push({
          role: 'tool',
          content: JSON.stringify(result.output),
          toolCallId: call.id,
        });
      }
    }

    yield { type: 'error', error: `Max turns (${this.maxTurns}) exceeded` };
    session.touch();
    await this.sessions.save(session);
  }

  private translate(ev: AgentStreamEvent): SessionStreamEvent | null {
    switch (ev.type) {
      case 'assistant-text':
        return { type: 'assistant-text', text: ev.text };
      case 'tool-call':
        return { type: 'tool-call', id: ev.id, name: ev.name, input: ev.input };
      case 'turn-complete':
        return { type: 'turn-complete', stopReason: ev.stopReason };
      case 'error':
        return { type: 'error', error: ev.error };
      case 'tool-result':
        return null; // provider-reported tool-result not used (we dispatch ourselves)
    }
  }

  private toAgentMessage(m: MessageEntity): AgentMessage {
    const obj = m.toObject();
    if (obj.role === 'tool') {
      return {
        role: 'tool',
        content: obj.content,
        toolCallId: obj.toolCallId ?? '',
      };
    }
    if (obj.role === 'assistant' && obj.toolCalls && obj.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: obj.content,
        toolCalls: obj.toolCalls,
      };
    }
    return {
      role: obj.role === 'system' ? 'system' : obj.role === 'user' ? 'user' : 'assistant',
      content: obj.content,
    };
  }
}
