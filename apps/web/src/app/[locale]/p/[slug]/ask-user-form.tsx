'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '../../../../components/ui';
import { cn } from '../../../../lib/utils';
import type { PendingAskUser } from './use-session-stream';

interface AskUserFormProps {
  ask: PendingAskUser;
  onSubmit: (answer: { callId: string; choices: string[]; text: string }) => void;
  disabled?: boolean;
}

export function AskUserForm({ ask, onSubmit, disabled = false }: AskUserFormProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');

  if (!ask.awaiting) {
    // Collapsed view — show the question + chosen answer.
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
        <p className="text-neutral-700 dark:text-neutral-300">{ask.question}</p>
        {ask.answer && (ask.answer.choices.length > 0 || ask.answer.text) ? (
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {ask.answer.choices.map((c) => (
              <span
                key={c}
                className="rounded-full bg-brand-600/10 px-2 py-0.5 font-medium text-brand-700 dark:text-brand-300"
              >
                {c}
              </span>
            ))}
            {ask.answer.text ? (
              <span className="text-neutral-500 italic">"{ask.answer.text}"</span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function toggle(label: string) {
    if (ask.allowMultiple) {
      setSelected((prev) =>
        prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
      );
    } else {
      setSelected([label]);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (disabled) return;
    if (selected.length === 0 && !text.trim()) return;
    onSubmit({ callId: ask.callId, choices: selected, text: text.trim() });
  }

  const canSubmit = !disabled && (selected.length > 0 || text.trim().length > 0);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-brand-500/40 bg-brand-50/50 p-3 text-sm dark:border-brand-500/30 dark:bg-brand-950/20"
    >
      <p className="font-medium text-neutral-900 dark:text-neutral-50">{ask.question}</p>

      <div className="flex flex-wrap gap-2">
        {ask.options.map((opt) => {
          const active = selected.includes(opt.label);
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => toggle(opt.label)}
              className={cn(
                'group rounded-lg border px-3 py-2 text-start transition',
                active
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-neutral-300 bg-white hover:border-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-brand-400',
              )}
            >
              <span className="block text-sm font-medium">{opt.label}</span>
              {opt.description ? (
                <span
                  className={cn(
                    'mt-0.5 block text-[11px]',
                    active ? 'text-white/80' : 'text-neutral-500 dark:text-neutral-400',
                  )}
                >
                  {opt.description}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {ask.allowFreeText ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Anything else…"
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
        />
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit}>
          Send answer
        </Button>
      </div>
    </form>
  );
}
