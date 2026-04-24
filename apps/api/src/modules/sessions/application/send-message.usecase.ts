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
    // Two OpenAI invariants we must guard before handing history to the
    // provider — persisted rows drift from either over time and a single
    // violation kills the whole chat with a 400:
    //   (a) every assistant.tool_calls[i].id needs a matching tool message
    //       immediately following (else "did not have response messages")
    //   (b) every tool message's toolCallId must refer to an id emitted by
    //       the most recent assistant.tool_calls block (else "must be a
    //       response to a preceeding message with 'tool_calls'")
    // Rewrite the history walker to enforce BOTH. The pattern: track the set
    // of open (unanswered) ids the next tool messages are allowed to respond
    // to; drop orphans; splice synthetic "abandoned" responses for gaps.
    const agentMessages: AgentMessage[] = [];
    const openToolCallIds = new Set<string>();
    for (const m of history) {
      if (!m) continue;
      const obj = m.toObject();

      if (obj.role === 'tool') {
        // Drop orphan tool messages — they have no preceding assistant with
        // a matching tool_call id. Keeping them would violate invariant (b).
        if (obj.toolCallId && openToolCallIds.has(obj.toolCallId)) {
          agentMessages.push(this.toAgentMessage(m));
          openToolCallIds.delete(obj.toolCallId);
        }
        continue;
      }

      // Any non-tool message ends the tool-response block — synthesize
      // responses for any still-open tool_call ids so invariant (a) holds.
      if (openToolCallIds.size > 0) {
        for (const id of openToolCallIds) {
          agentMessages.push({
            role: 'tool',
            toolCallId: id,
            content: JSON.stringify({ abandoned: true, reason: 'no response persisted' }),
          });
        }
        openToolCallIds.clear();
      }

      agentMessages.push(this.toAgentMessage(m));

      if (obj.role === 'assistant' && obj.toolCalls && obj.toolCalls.length > 0) {
        for (const call of obj.toolCalls) openToolCallIds.add(call.id);
      }
    }
    // Trailing unanswered tool_calls at the very end of history.
    if (openToolCallIds.size > 0) {
      for (const id of openToolCallIds) {
        agentMessages.push({
          role: 'tool',
          toolCallId: id,
          content: JSON.stringify({ abandoned: true, reason: 'no response persisted' }),
        });
      }
    }

    // ---- Context-window trimming --------------------------------------
    // Long sessions accumulate large tool results (bun install logs, file
    // reads, dev.log tails) that blow past the model's input limit. Cap
    // individual tool contents, then if the rough char total still exceeds
    // a soft budget, drop the oldest conversational turns while preserving
    // tool-call / tool-response adjacency.
    trimAgentMessagesForContext(agentMessages);

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
 * Soft ceiling on the rough character total we hand to the model. The
 * Azure OpenAI deployment caps at 272k input tokens; 4 chars ≈ 1 token
 * is a conservative rule of thumb, so we keep well under the limit
 * (800k chars ≈ 200k tokens) to leave room for the system prompt, tool
 * schemas, and the streaming response buffer.
 */
const SOFT_CHAR_BUDGET = 800_000;
const MAX_TOOL_CONTENT_CHARS = 8_000;

/**
 * In-place trim:
 *   1. Cap every tool message's content at MAX_TOOL_CONTENT_CHARS — tool
 *      outputs (bun install, file reads, dev.log) are the #1 bloat source.
 *   2. If the total char count still exceeds SOFT_CHAR_BUDGET, drop the
 *      oldest messages — but never sever an assistant.tool_calls block
 *      from its tool responses. We drop in (assistant → tool*) chunks.
 */
function trimAgentMessagesForContext(messages: AgentMessage[]): void {
  for (const m of messages) {
    if (m.role === 'tool' && typeof m.content === 'string' && m.content.length > MAX_TOOL_CONTENT_CHARS) {
      m.content =
        m.content.slice(0, MAX_TOOL_CONTENT_CHARS) +
        `\n…[truncated ${m.content.length - MAX_TOOL_CONTENT_CHARS} chars]`;
    }
  }

  const byteCount = (): number => {
    let n = 0;
    for (const m of messages) {
      if (typeof m.content === 'string') n += m.content.length;
      if (m.role === 'assistant' && 'toolCalls' in m && m.toolCalls) {
        for (const tc of m.toolCalls) n += JSON.stringify(tc.input).length + tc.name.length + 32;
      }
    }
    return n;
  };

  while (byteCount() > SOFT_CHAR_BUDGET && messages.length > 8) {
    // Drop a full turn-chunk starting from index 0. A chunk is:
    // user (optional) → assistant → tool* → ... until next user OR end.
    // Simplest: advance past the first non-tool message and any trailing
    // tool messages belonging to it.
    messages.shift();
    while (messages.length > 0 && messages[0] && messages[0].role === 'tool') {
      messages.shift();
    }
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
