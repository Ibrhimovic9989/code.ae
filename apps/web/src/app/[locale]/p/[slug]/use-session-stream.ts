'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, Session } from '@code-ae/shared';
import { api } from '../../../../lib/api-client';
import { parseSseStream } from '../../../../lib/sse-client';

export interface ChatToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'ok' | 'failed';
  output: unknown;
}

export interface PendingAskUser {
  callId: string;
  question: string;
  options: Array<{ label: string; description?: string }>;
  allowMultiple: boolean;
  allowFreeText: boolean;
  awaiting: boolean;
  answer?: { choices: string[]; text: string };
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  toolCalls: ChatToolCall[];
  askUser: PendingAskUser | null;
  pending: boolean;
  /**
   * Marks turns initiated by the error-watcher agent (not the human). Lets
   * the chat panel render them with a distinctive "auto-fix" badge instead of
   * the regular user bubble.
   */
  autoFix?: boolean;
}

export interface SendInput {
  content?: string;
  toolResponses?: Array<{ id: string; content: unknown }>;
  /** Client-side metadata — never serialized to the API. */
  meta?: { autoFix?: string };
}

export function useSessionStream(
  projectSlug: string,
  ready: boolean = true,
  locale: 'ar' | 'en' = 'ar',
) {
  const [project, setProject] = useState<Project | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [lastTurnAt, setLastTurnAt] = useState<number>(0);
  const initialized = useRef(false);

  const bootstrap = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;
    setStatus('starting');
    try {
      const { projects } = await api.listProjects();
      const p = projects.find((x) => x.slug === projectSlug);
      if (!p) throw new Error('Project not found');
      setProject(p);
      // createSession is idempotent per project — it returns the existing
      // active session if one exists, otherwise spins up a new sandbox. So on
      // every page load we get the same session id back, and we can hydrate
      // the chat UI from its stored message history.
      const { session } = await api.createSession(p.id);
      setSession(session);
      try {
        const { messages } = await api.listMessages(session.id);
        const hydrated = hydrateTurnsFromHistory(messages);
        if (hydrated.length > 0) setTurns(hydrated);
      } catch {
        /* history load failures shouldn't block the chat from starting */
      }
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [projectSlug]);

  useEffect(() => {
    if (!ready) return;
    void bootstrap();
  }, [bootstrap, ready]);

  const send = useCallback(
    async (input: string | SendInput) => {
      if (!session) return;
      const normalized: SendInput = typeof input === 'string' ? { content: input } : input;
      const content = normalized.content ?? '';
      const toolResponses = normalized.toolResponses ?? [];
      if (!content.trim() && toolResponses.length === 0) return;

      setSending(true);

      if (toolResponses.length > 0) {
        setTurns((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            const turn = next[i];
            if (turn && turn.askUser && turn.askUser.awaiting) {
              const resp = toolResponses.find((r) => r.id === turn.askUser!.callId);
              const answer = resp?.content as { choices?: string[]; text?: string } | undefined;
              next[i] = {
                ...turn,
                askUser: {
                  ...turn.askUser,
                  awaiting: false,
                  answer: { choices: answer?.choices ?? [], text: answer?.text ?? '' },
                },
              };
              break;
            }
          }
          return next;
        });
      }

      const isAutoFix = Boolean(normalized.meta?.autoFix);
      setTurns((prev) => {
        const next = [...prev];
        if (content.trim()) {
          next.push({
            role: 'user',
            text: content,
            toolCalls: [],
            askUser: null,
            pending: false,
            autoFix: isAutoFix,
          });
        }
        next.push({ role: 'assistant', text: '', toolCalls: [], askUser: null, pending: true });
        return next;
      });

      try {
        const res = await api.streamMessage(session.id, content, locale, toolResponses);
        if (!res.ok && res.status !== 200) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        for await (const ev of parseSseStream(res)) {
          const payload = ev.data as Record<string, unknown>;
          setTurns((prev) => updateLastAssistant(prev, ev.event, payload));
        }
      } catch (err) {
        setTurns((prev) =>
          updateLastAssistant(prev, 'error', {
            type: 'error',
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        setTurns((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') last.pending = false;
          return next;
        });
        setSending(false);
        setLastTurnAt(Date.now());
      }
    },
    [session, locale],
  );

  return { project, session, status, error, turns, sending, send, lastTurnAt };
}

function updateLastAssistant(
  prev: ChatTurn[],
  eventType: string,
  payload: Record<string, unknown>,
): ChatTurn[] {
  const next = [...prev];
  const last = next[next.length - 1];
  if (!last || last.role !== 'assistant') return next;
  const updated: ChatTurn = { ...last, toolCalls: [...last.toolCalls] };

  switch (eventType) {
    case 'assistant-text':
      updated.text = updated.text + String(payload['text'] ?? '');
      break;
    case 'tool-call': {
      const name = String(payload['name'] ?? 'unknown');
      if (name !== 'ask_user') {
        updated.toolCalls.push({
          id: String(payload['id'] ?? crypto.randomUUID()),
          name,
          input: (payload['input'] as Record<string, unknown> | undefined) ?? {},
          status: 'pending',
          output: null,
        });
      }
      break;
    }
    case 'tool-result': {
      const id = String(payload['id'] ?? '');
      const idx = updated.toolCalls.findIndex((tc) => tc.id === id);
      if (idx >= 0) {
        const target = updated.toolCalls[idx];
        if (target) {
          updated.toolCalls[idx] = {
            ...target,
            status: payload['ok'] ? 'ok' : 'failed',
            output: payload['output'] ?? null,
          };
        }
      }
      break;
    }
    case 'awaiting-input': {
      const options =
        (payload['options'] as Array<{ label: string; description?: string }> | undefined) ?? [];
      updated.askUser = {
        callId: String(payload['id'] ?? ''),
        question: String(payload['question'] ?? ''),
        options,
        allowMultiple: Boolean(payload['allowMultiple']),
        allowFreeText: payload['allowFreeText'] !== false,
        awaiting: true,
      };
      updated.pending = false;
      break;
    }
    case 'error':
      updated.text = updated.text + `\n\n[error] ${String(payload['error'] ?? '')}`;
      break;
    case 'turn-complete':
    default:
      break;
  }

  next[next.length - 1] = updated;
  return next;
}

/**
 * Convert the flat list of Message rows the API returns into the grouped
 * ChatTurn[] the chat panel renders. The DB shape is role-by-role; the UI
 * shape is one assistant turn per "assistant message + its tool results".
 * Tool results (role='tool') are matched back to the assistant turn that
 * issued them via toolCallId.
 */
function hydrateTurnsFromHistory(messages: Array<Record<string, unknown>>): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let lastAssistant: ChatTurn | null = null;

  for (const raw of messages) {
    const role = String(raw['role'] ?? '');
    const content = String(raw['content'] ?? '');

    if (role === 'user') {
      turns.push({ role: 'user', text: content, toolCalls: [], askUser: null, pending: false });
      lastAssistant = null;
      continue;
    }

    if (role === 'assistant') {
      const toolCallsRaw = raw['toolCalls'] as Array<{
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }> | null | undefined;
      const toolCalls: ChatToolCall[] = (toolCallsRaw ?? [])
        .filter((c) => c.name !== 'ask_user')
        .map((c) => ({
          id: String(c.id ?? ''),
          name: String(c.name ?? 'unknown'),
          input: c.input ?? {},
          status: 'pending',
          output: null,
        }));

      const askCall = (toolCallsRaw ?? []).find((c) => c.name === 'ask_user');
      const askUser: PendingAskUser | null = askCall
        ? {
            callId: String(askCall.id ?? ''),
            question: String((askCall.input as Record<string, unknown> | undefined)?.['question'] ?? ''),
            options:
              ((askCall.input as Record<string, unknown> | undefined)?.['options'] as Array<{
                label: string;
                description?: string;
              }>) ?? [],
            allowMultiple: Boolean(
              (askCall.input as Record<string, unknown> | undefined)?.['allowMultiple'],
            ),
            allowFreeText:
              (askCall.input as Record<string, unknown> | undefined)?.['allowFreeText'] !== false,
            awaiting: false, // historical turns are never still awaiting
          }
        : null;

      const turn: ChatTurn = {
        role: 'assistant',
        text: content,
        toolCalls,
        askUser,
        pending: false,
      };
      turns.push(turn);
      lastAssistant = turn;
      continue;
    }

    if (role === 'tool' && lastAssistant) {
      // Backfill the result onto the matching tool call on the last assistant turn.
      const callId = String(raw['toolCallId'] ?? '');
      const idx = lastAssistant.toolCalls.findIndex((tc) => tc.id === callId);
      let parsedOutput: unknown = content;
      try {
        parsedOutput = JSON.parse(content);
      } catch {
        /* leave as string */
      }
      if (idx >= 0) {
        const target = lastAssistant.toolCalls[idx];
        if (target) {
          const isFailed =
            (parsedOutput &&
              typeof parsedOutput === 'object' &&
              'ok' in (parsedOutput as Record<string, unknown>) &&
              (parsedOutput as Record<string, unknown>)['ok'] === false) ||
            false;
          lastAssistant.toolCalls[idx] = {
            ...target,
            status: isFailed ? 'failed' : 'ok',
            output: parsedOutput,
          };
        }
      } else if (lastAssistant.askUser && lastAssistant.askUser.callId === callId) {
        // Answer to a historical ask_user.
        const answer = parsedOutput as { choices?: string[]; text?: string } | undefined;
        lastAssistant.askUser = {
          ...lastAssistant.askUser,
          answer: { choices: answer?.choices ?? [], text: answer?.text ?? '' },
        };
      }
    }
  }

  return turns;
}
