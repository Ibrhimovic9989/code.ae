'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Spinner } from '../../../../components/ui';
import type { ChatTurn, ChatToolCall } from './use-session-stream';
import { cn } from '../../../../lib/utils';

interface ChatPanelProps {
  turns: ChatTurn[];
  onSend: (content: string) => void;
  sending: boolean;
  disabled: boolean;
}

export function ChatPanel({ turns, onSend, sending, disabled }: ChatPanelProps) {
  const t = useTranslations();
  const [value, setValue] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || sending) return;
    onSend(value);
    setValue('');
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-950">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {turns.length === 0 ? (
          <p className="text-center text-sm text-neutral-500 mt-12">{t('workspace.placeholder')}</p>
        ) : (
          turns.map((turn, i) => <TurnView key={i} turn={turn} />)
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
      >
        <div className="flex gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('workspace.placeholder')}
            disabled={disabled || sending}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void onSubmit(e as unknown as FormEvent);
              }
            }}
            className="flex-1 resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <Button type="submit" disabled={disabled || sending || !value.trim()}>
            {sending ? <Spinner /> : t('workspace.send')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function TurnView({ turn }: { turn: ChatTurn }) {
  const t = useTranslations();
  const isUser = turn.role === 'user';
  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[90%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap',
          isUser
            ? 'bg-brand-600 text-white'
            : 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50',
        )}
      >
        {turn.text || (turn.pending && turn.toolCalls.length === 0 ? <Spinner /> : null)}
      </div>
      {turn.toolCalls.length > 0 ? (
        <div className="flex w-full max-w-[90%] flex-col gap-2">
          {turn.toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} call={tc} labelCall={t('workspace.toolCall')} labelResult={t('workspace.toolResult')} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToolCallCard({ call, labelCall, labelResult }: { call: ChatToolCall; labelCall: string; labelResult: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-1.5 dark:border-neutral-800">
        <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{labelCall} · {call.name}</span>
        <span className={cn(
          'rounded px-1.5 py-0.5 text-[10px]',
          call.status === 'pending' ? 'bg-amber-100 text-amber-900' :
          call.status === 'ok' ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
        )}>
          {call.status}
        </span>
      </div>
      <pre dir="ltr" className="max-h-40 overflow-auto px-3 py-2 font-mono text-[11px] leading-tight text-neutral-700 dark:text-neutral-300">
{JSON.stringify(call.input, null, 2)}
      </pre>
      {call.status !== 'pending' ? (
        <details>
          <summary className="cursor-pointer border-t border-neutral-200 px-3 py-1.5 text-neutral-500 dark:border-neutral-800">{labelResult}</summary>
          <pre dir="ltr" className="max-h-40 overflow-auto px-3 py-2 font-mono text-[11px] leading-tight text-neutral-700 dark:text-neutral-300">
{typeof call.output === 'string' ? call.output : JSON.stringify(call.output, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
