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
import { buildAgentTools } from './agent-tools';
import { McpRegistry } from '../../mcp/domain/mcp-registry';
import { SupabaseIntegrationRepository } from '../../supabase/domain/supabase-integration.repository';
import type { AppConfig } from '../../../config/app.config';

export type SessionStreamEvent =
  | { type: 'assistant-text'; text: string }
  | { type: 'tool-call'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool-result'; id: string; ok: boolean; output: unknown }
  | { type: 'awaiting-input'; id: string; question: string; options: Array<{ label: string; description?: string }>; allowMultiple: boolean; allowFreeText: boolean }
  | { type: 'turn-complete'; stopReason: string }
  | { type: 'error'; error: string };

export interface ToolResponseInput {
  /** The tool_call_id emitted by the model in the previous turn. */
  id: string;
  /** The content to send back as the tool_result. Opaque JSON-serializable payload. */
  content: unknown;
}

@Injectable()
export class SendMessageUseCase {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly deployment: string;
  private readonly apiVersion: string;
  private readonly maxTurns = 20;

  constructor(
    private readonly projects: ProjectRepository,
    private readonly sessions: SessionRepository,
    private readonly messages: MessageRepository,
    private readonly dispatcher: ToolDispatcher,
    private readonly mcp: McpRegistry,
    private readonly supabase: SupabaseIntegrationRepository,
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
    userLocale: 'ar' | 'en' = 'ar',
    toolResponses: ToolResponseInput[] = [],
    mode: 'plan' | 'build' = 'build',
  ): AsyncGenerator<SessionStreamEvent> {
    if (!userContent.trim() && toolResponses.length === 0) {
      throw new ValidationError('Either message content or tool responses required');
    }

    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundError('Session', sessionId);
    const project = await this.projects.findById(session.projectId);
    if (!project) throw new NotFoundError('Project', session.projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your session');

    // 1. Persist any tool responses BEFORE the new user message so the assistant
    //    turn that requested them is immediately followed by its answers.
    for (const resp of toolResponses) {
      const content = typeof resp.content === 'string' ? resp.content : JSON.stringify(resp.content);
      await this.messages.append(
        MessageEntity.create({
          id: randomUUID(),
          sessionId: session.id,
          role: 'tool',
          content,
          toolCalls: null,
          toolCallId: resp.id,
          createdAt: new Date(),
        }),
      );
    }

    // 2. Persist the new user message (may be empty — form submission without extra text).
    if (userContent.trim()) {
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
    }
    session.touch();
    await this.sessions.save(session);

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

    const history = await this.messages.listBySession(session.id);
    const agentMessages: AgentMessage[] = history.map((m) => this.toAgentMessage(m));

    const projectObj = project.toObject();

    const systemPrompt = buildSystemPrompt({
      projectName: project.slug,
      projectTemplate: 'next-nest-monorepo',
      userLocale,
      hasBackend: true,
      hasFrontend: true,
      supabaseLinked: Boolean(projectObj.supabaseProjectRef),
      mode,
    });

    // If the project has Supabase linked and the user has a PAT on file, make
    // sure the per-project Supabase MCP server is up. Fire-and-forget: failures
    // shouldn't block the agent loop — tools simply won't be available.
    if (projectObj.supabaseProjectRef) {
      const integration = await this.supabase.findByUserId(ownerId);
      if (integration) {
        await this.mcp.ensureSupabaseServer(
          project.id,
          integration.accessToken,
          projectObj.supabaseProjectRef,
        );
      }
    }

    let assistantTextBuffer = '';
    let pendingToolCalls: MessageToolCall[] = [];

    for (let turn = 0; turn < this.maxTurns; turn++) {
      assistantTextBuffer = '';
      pendingToolCalls = [];

      const allTools = buildAgentTools(this.mcp.listTools({ projectId: project.id }));
      // In plan mode, restrict the tool surface to read-only operations so
      // the agent literally cannot edit files or run commands — it has to
      // write a plan. Allow-list rather than deny-list: every new mutating
      // tool is opt-out by default.
      const tools =
        mode === 'plan'
          ? allTools.filter((tool) => isPlanModeAllowed(tool.name))
          : allTools;
      const stream = runner.run({ systemPrompt, messages: agentMessages, tools });

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
        session.touch();
        await this.sessions.save(session);
        return;
      }

      // Check for ask_user: if present, halt the loop and wait for the user to
      // submit answers via toolResponses on the next POST.
      const askUserCall = pendingToolCalls.find((c) => c.name === 'ask_user');
      if (askUserCall) {
        const input = askUserCall.input as {
          question?: string;
          options?: Array<{ label: string; description?: string }>;
          allowMultiple?: boolean;
          allowFreeText?: boolean;
        };
        yield {
          type: 'awaiting-input',
          id: askUserCall.id,
          question: input.question ?? '',
          options: input.options ?? [],
          allowMultiple: Boolean(input.allowMultiple),
          allowFreeText: input.allowFreeText !== false,
        };
        session.touch();
        await this.sessions.save(session);
        return;
      }

      // Execute each non-pending tool, persist result, feed back to model.
      for (const call of pendingToolCalls) {
        const result = await this.dispatcher.dispatch(call.name, call.input, {
          projectId: project.id,
          ownerId,
        });
        if (result.pending) continue; // should not happen outside ask_user

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
        return null;
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

/**
 * Plan mode allow-list. Read-only tools only — the agent is expected to write
 * a plan in prose, not mutate anything. New mutating tools are opt-out by
 * default; to let one run in plan mode, add its name here.
 */
function isPlanModeAllowed(toolName: string): boolean {
  if (toolName === 'read_file' || toolName === 'list_files' || toolName === 'ask_user') {
    return true;
  }
  // MCP supabase introspection is safe (list_tables, list_extensions, etc.);
  // execute_sql and apply_migration are mutating — block them.
  if (toolName.startsWith('mcp__supabase__')) {
    const leaf = toolName.slice('mcp__supabase__'.length);
    return leaf.startsWith('list_') || leaf.startsWith('get_') || leaf === 'generate_typescript_types';
  }
  return false;
}
