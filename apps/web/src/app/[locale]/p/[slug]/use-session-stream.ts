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

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  toolCalls: ChatToolCall[];
  pending: boolean;
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
      const { session } = await api.createSession(p.id);
      setSession(session);
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
    async (content: string) => {
      if (!session || !content.trim()) return;
      setSending(true);

      setTurns((prev) => [
        ...prev,
        { role: 'user', text: content, toolCalls: [], pending: false },
        { role: 'assistant', text: '', toolCalls: [], pending: true },
      ]);

      try {
        const res = await api.streamMessage(session.id, content, locale);
        if (!res.ok && res.status !== 200) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        for await (const ev of parseSseStream(res)) {
          const payload = ev.data as { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown>; ok?: boolean; output?: unknown; stopReason?: string; error?: string };
          setTurns((prev) => updateLastAssistant(prev, ev.event, payload));
        }
      } catch (err) {
        setTurns((prev) => updateLastAssistant(prev, 'error', { type: 'error', error: err instanceof Error ? err.message : String(err) }));
      } finally {
        setTurns((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') last.pending = false;
          return next;
        });
        setSending(false);
      }
    },
    [session, locale],
  );

  return { project, session, status, error, turns, sending, send };
}

function updateLastAssistant(
  prev: ChatTurn[],
  eventType: string,
  payload: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown>; ok?: boolean; output?: unknown; stopReason?: string; error?: string },
): ChatTurn[] {
  const next = [...prev];
  const last = next[next.length - 1];
  if (!last || last.role !== 'assistant') return next;
  const updated: ChatTurn = { ...last, toolCalls: [...last.toolCalls] };

  switch (eventType) {
    case 'assistant-text':
      updated.text = updated.text + (payload.text ?? '');
      break;
    case 'tool-call':
      updated.toolCalls.push({
        id: payload.id ?? crypto.randomUUID(),
        name: payload.name ?? 'unknown',
        input: payload.input ?? {},
        status: 'pending',
        output: null,
      });
      break;
    case 'tool-result': {
      const idx = updated.toolCalls.findIndex((tc) => tc.id === payload.id);
      if (idx >= 0) {
        const target = updated.toolCalls[idx];
        if (target) {
          updated.toolCalls[idx] = {
            ...target,
            status: payload.ok ? 'ok' : 'failed',
            output: payload.output,
          };
        }
      }
      break;
    }
    case 'error':
      updated.text = updated.text + `\n\n[error] ${payload.error ?? ''}`;
      break;
    case 'turn-complete':
    default:
      break;
  }

  next[next.length - 1] = updated;
  return next;
}
