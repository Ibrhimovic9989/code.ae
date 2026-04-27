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
  const [mode, setMode] = useState<'plan' | 'build'>('build');
  // Reasoning tier — Standard for everyday tasks, Smart for complex ones.
  // We deliberately avoid surfacing model names anywhere in the UI; the
  // user picks intent ("how hard is this task?"), not a specific model.
  const [tier, setTier] = useState<'standard' | 'smart'>('standard');
  // Pending image attachments for the next message. Stored as data URLs so
  // they're sent inline; nothing is uploaded until the user actually submits.
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  async function attachFiles(files: FileList | File[] | null) {
    if (!files) return;
    const list = Array.from(files);
    const accepted: string[] = [];
    for (const f of list) {
      if (!f.type.startsWith('image/')) continue;
      // Hard cap per file at 4 MB so we don't blow context with full-res
      // photos. The model gets the original bytes — no client-side resize.
      if (f.size > 4 * 1024 * 1024) continue;
      accepted.push(await fileToDataUrl(f));
      if (images.length + accepted.length >= 6) break; // server caps at 6
    }
    if (accepted.length > 0) setImages((prev) => [...prev, ...accepted].slice(0, 6));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (!value.trim() && images.length === 0) return;
    onSend({
      content: value,
      mode,
      tier,
      ...(images.length > 0 ? { images } : {}),
    });
    setValue('');
    setImages([]);
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
    <div className="flex h-full flex-col bg-[rgb(var(--surface-0))]">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-5 sm:py-5">
          {turns.length === 0 ? (
            <p className="mt-10 text-center text-[13px] text-neutral-500 sm:mt-12">
              {t('workspace.placeholder')}
            </p>
          ) : (
            <div className="flex flex-col gap-5 sm:gap-6">
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
        className="border-t border-white/5 bg-[rgb(var(--surface-0))] p-2.5 sm:p-3"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ModeToggle value={mode} onChange={setMode} disabled={sending} />
              <TierToggle value={tier} onChange={setTier} disabled={sending} />
            </div>
            {mode === 'plan' ? (
              <span className="hidden text-[11px] text-neutral-500 sm:inline">
                Plan mode — agent writes a plan, doesn&apos;t edit files.
              </span>
            ) : tier === 'smart' ? (
              <span className="hidden text-[11px] text-neutral-500 sm:inline">
                Smart — slower, deeper reasoning for complex tasks.
              </span>
            ) : null}
          </div>

          {/* Image attachments preview row */}
          {images.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {images.map((src, i) => (
                <div
                  key={i}
                  className="group relative h-16 w-16 overflow-hidden rounded-md border border-white/10 bg-white/[0.03]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove attachment"
                  >
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void attachFiles(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || sending || images.length >= 6}
              title="Attach images (paste also works)"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-neutral-400 transition-colors hover:border-white/30 hover:bg-white/[0.04] hover:text-neutral-200 disabled:opacity-40"
              aria-label="Attach images"
            >
              <svg viewBox="0 0 18 18" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path
                  d="M14.4 8.5l-5.5 5.5a3.5 3.5 0 0 1-5-5l6.5-6.5a2.4 2.4 0 0 1 3.4 3.4L7.5 12.3a1.3 1.3 0 0 1-1.8-1.8l5.3-5.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                const files: File[] = [];
                for (const item of items) {
                  if (item.kind === 'file') {
                    const f = item.getAsFile();
                    if (f && f.type.startsWith('image/')) files.push(f);
                  }
                }
                if (files.length > 0) {
                  e.preventDefault();
                  void attachFiles(files);
                }
              }}
              placeholder={
                mode === 'plan'
                  ? 'Describe what you want planned…'
                  : t('workspace.placeholder')
              }
              disabled={disabled || sending}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void onSubmit(e as unknown as FormEvent);
                }
              }}
              className="flex-1 resize-none rounded-md border border-white/10 bg-white/[0.02] px-3 py-2.5 text-[14px] leading-relaxed text-neutral-100 placeholder:text-neutral-500 focus:border-white/30 focus:bg-white/[0.04] focus:outline-none disabled:opacity-50"
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="shrink-0 self-stretch"
              disabled={disabled || sending || (!value.trim() && images.length === 0)}
            >
              {sending ? <Spinner /> : mode === 'plan' ? 'Plan' : t('workspace.send')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function ModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: 'plan' | 'build';
  onChange: (v: 'plan' | 'build') => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        'inline-flex rounded-md border border-white/10 bg-white/[0.02] p-0.5 text-[11.5px] font-medium',
        disabled && 'opacity-50',
      )}
      role="tablist"
      aria-label="Chat mode"
    >
      {(['build', 'plan'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={value === m}
          disabled={disabled}
          onClick={() => onChange(m)}
          className={cn(
            'flex h-6 items-center gap-1.5 rounded px-2 transition-colors',
            value === m
              ? 'bg-white text-neutral-900'
              : 'text-neutral-400 hover:text-white',
          )}
          title={
            m === 'plan'
              ? 'Plan mode — read-only exploration + a written plan'
              : 'Build mode — agent edits files and runs commands'
          }
        >
          {m === 'plan' ? <PlanIcon /> : <BuildIcon />}
          <span>{m === 'plan' ? 'Plan' : 'Build'}</span>
        </button>
      ))}
    </div>
  );
}

function TierToggle({
  value,
  onChange,
  disabled,
}: {
  value: 'standard' | 'smart';
  onChange: (v: 'standard' | 'smart') => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        'inline-flex rounded-md border border-white/10 bg-white/[0.02] p-0.5 text-[11.5px] font-medium',
        disabled && 'opacity-50',
      )}
      role="tablist"
      aria-label="Reasoning tier"
    >
      {(['standard', 'smart'] as const).map((tier) => (
        <button
          key={tier}
          type="button"
          role="tab"
          aria-selected={value === tier}
          disabled={disabled}
          onClick={() => onChange(tier)}
          className={cn(
            'flex h-6 items-center gap-1.5 rounded px-2 transition-colors',
            value === tier
              ? tier === 'smart'
                ? 'bg-brand-400 text-neutral-900'
                : 'bg-white text-neutral-900'
              : 'text-neutral-400 hover:text-white',
          )}
          title={
            tier === 'smart'
              ? 'Smart — deeper reasoning, slower responses. Use for complex tasks.'
              : 'Standard — fast everyday responses.'
          }
        >
          {tier === 'smart' ? <SmartIcon /> : <StandardIcon />}
          <span>{tier === 'smart' ? 'Smart' : 'Standard'}</span>
        </button>
      ))}
    </div>
  );
}

function StandardIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 7l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SmartIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path
        d="M7 1.5l1.4 3 3.1.4-2.3 2.2.6 3.1L7 8.7l-2.8 1.5.6-3.1L2.5 4.9l3.1-.4L7 1.5z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BuildIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 11l4.5-4.5M8 6l3-3 1 1-3 3M6.5 6.5l1 1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlanIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="2" width="8" height="10" rx="1" />
      <path d="M5 5h4M5 7h4M5 9h2" strokeLinecap="round" />
    </svg>
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
