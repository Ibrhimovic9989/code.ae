'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button, Spinner } from '../../../../components/ui';
import type { ChatTurn, ChatToolCall, SendInput } from './use-session-stream';
import { AskUserForm } from './ask-user-form';
import { cn } from '../../../../lib/utils';

interface ChatPanelProps {
  turns: ChatTurn[];
  onSend: (input: string | SendInput) => void;
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

  function handleAnswer(answer: { callId: string; choices: string[]; text: string }) {
    onSend({
      content: '',
      toolResponses: [
        { id: answer.callId, content: { choices: answer.choices, text: answer.text } },
      ],
    });
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-950">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-5">
          {turns.length === 0 ? (
            <p className="mt-12 text-center text-[13px] text-neutral-500">
              {t('workspace.placeholder')}
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {turns.map((turn, i) => (
                <TurnView key={i} turn={turn} onAnswer={handleAnswer} sending={sending} />
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-neutral-200 bg-white p-3 dark:border-neutral-900 dark:bg-neutral-950"
      >
        <div className="mx-auto flex max-w-3xl gap-2">
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
            className="flex-1 resize-none rounded-md border border-neutral-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600 dark:focus:border-neutral-600"
          />
          <Button type="submit" variant="primary" disabled={disabled || sending || !value.trim()}>
            {sending ? <Spinner /> : t('workspace.send')}
          </Button>
        </div>
      </form>
    </div>
  );
}

interface TurnViewProps {
  turn: ChatTurn;
  onAnswer: (answer: { callId: string; choices: string[]; text: string }) => void;
  sending: boolean;
}

function TurnView({ turn, onAnswer, sending }: TurnViewProps) {
  const isUser = turn.role === 'user';

  const hasBubbleContent =
    Boolean(turn.text) || (turn.pending && turn.toolCalls.length === 0 && !turn.askUser);

  return (
    <div className="flex flex-col gap-2.5">
      {hasBubbleContent ? (
        <div className="flex gap-3">
          <div
            className={cn(
              'mt-1 h-5 w-5 shrink-0 rounded-full text-[10px] font-semibold flex items-center justify-center select-none',
              turn.autoFix
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                : isUser
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'border border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
            )}
            aria-hidden="true"
          >
            {turn.autoFix ? '⚙' : isUser ? 'Y' : 'A'}
          </div>
          <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-neutral-900 dark:text-neutral-100">
            {turn.autoFix ? (
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                auto-fix agent
              </div>
            ) : null}
            {turn.text ? (
              isUser ? (
                <div className="whitespace-pre-wrap">{turn.text}</div>
              ) : (
                <MarkdownBubble text={turn.text} />
              )
            ) : turn.pending ? (
              <Spinner className="text-neutral-400" />
            ) : null}
          </div>
        </div>
      ) : null}

      {turn.toolCalls.length > 0 ? (
        <div className="flex flex-col gap-1.5 ps-8">
          {turn.toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} call={tc} />
          ))}
        </div>
      ) : null}

      {turn.askUser ? (
        <div className="ps-8">
          <AskUserForm ask={turn.askUser} onSubmit={onAnswer} disabled={sending} />
        </div>
      ) : null}
    </div>
  );
}

function MarkdownBubble({ text }: { text: string }) {
  return (
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none prose-p:my-2 prose-headings:mt-4 prose-headings:mb-1.5 prose-headings:font-semibold prose-headings:tracking-tight prose-pre:my-2 prose-pre:bg-neutral-50 prose-pre:border prose-pre:border-neutral-200 dark:prose-pre:bg-neutral-900 dark:prose-pre:border-neutral-800 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:before:content-none prose-code:after:content-none prose-code:font-normal prose-strong:font-semibold prose-hr:my-4 prose-hr:border-neutral-200 dark:prose-hr:border-neutral-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a
              {...props}
              target="_blank"
              rel="noopener"
              className="text-brand-600 underline underline-offset-2 decoration-brand-600/40 hover:decoration-brand-600 dark:text-brand-400"
            />
          ),
          code: ({ className, children, ...props }) => {
            const inline = !className;
            return inline ? (
              <code
                className="rounded border border-neutral-200 bg-neutral-50 px-1 py-0.5 font-mono text-[11.5px] text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                {...props}
              >
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function ToolCallCard({ call }: { call: ChatToolCall }) {
  const statusDot =
    call.status === 'pending'
      ? 'bg-amber-500'
      : call.status === 'ok'
        ? 'bg-emerald-500'
        : 'bg-red-500';

  return (
    <details className="group rounded-md border border-neutral-200 bg-neutral-50 text-[12px] open:bg-white dark:border-neutral-800 dark:bg-neutral-950/50 dark:open:bg-neutral-950">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-900/50">
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', statusDot)} />
        <span className="font-mono text-[11.5px] text-neutral-700 dark:text-neutral-300">
          {call.name}
        </span>
        <span className="font-mono text-[11px] text-neutral-400 truncate" dir="ltr">
          {summarizeInput(call.input)}
        </span>
        <svg
          className="ms-auto h-3 w-3 shrink-0 text-neutral-400 transition-transform group-open:rotate-90"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="border-t border-neutral-200 dark:border-neutral-800">
        <pre
          dir="ltr"
          className="max-h-40 overflow-auto px-2.5 py-2 font-mono text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-300"
        >
          {JSON.stringify(call.input, null, 2)}
        </pre>
        {call.status !== 'pending' ? (
          <pre
            dir="ltr"
            className="max-h-40 overflow-auto border-t border-neutral-200 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-neutral-700 dark:border-neutral-800 dark:text-neutral-300"
          >
            {typeof call.output === 'string' ? call.output : JSON.stringify(call.output, null, 2)}
          </pre>
        ) : null}
      </div>
    </details>
  );
}

function summarizeInput(input: Record<string, unknown>): string {
  if (typeof input['path'] === 'string') return String(input['path']);
  if (typeof input['command'] === 'string') return String(input['command']).slice(0, 60);
  if (typeof input['query'] === 'string') return String(input['query']).slice(0, 60);
  if (typeof input['name'] === 'string') return String(input['name']);
  return '';
}
