'use client';

import { useEffect, useRef } from 'react';
import { api } from '../../../../lib/api-client';

type SendInput = import('./use-session-stream').SendInput;

interface UseErrorWatcherArgs {
  projectId: string | null;
  sandboxReady: boolean;
  /** Don't fire watcher while the chat agent is already running a turn. */
  agentBusy: boolean;
  /**
   * Called with a synthetic user message when an error is detected. The session
   * stream consumer will route this to the chat agent, which then uses its
   * tools to repair the code.
   */
  onAutoFixRequested: (input: SendInput) => void;
  /** Probe cadence. Default 12s — balances responsiveness vs sandbox load. */
  intervalMs?: number;
  /** Don't re-submit the same error more than once every N ms. */
  dedupeTtlMs?: number;
}

/**
 * The error-watcher agent. Runs while the workspace is open:
 *
 *  1. Every 12s, asks the backend to scrape /tmp/dev.log + probe the preview
 *     and classify any errors.
 *  2. On a new error (fingerprint not seen recently), composes a terse
 *     "fix this" message and hands it to the chat agent via onAutoFixRequested.
 *  3. Dedupes by fingerprint for 60s so the agent isn't spammed with the same
 *     error every tick while it's still working on the fix.
 *
 * The chat agent sees this as a regular user turn (with a hint that it was
 * auto-generated) and uses read_file/write_file/exec to resolve — user watches
 * the fix unfold in chat.
 */
export function useErrorWatcher({
  projectId,
  sandboxReady,
  agentBusy,
  onAutoFixRequested,
  intervalMs = 12_000,
  // Widened from 60s to 10min. Same-fingerprint resubmissions were firing
  // while the agent was stuck on a corrupted turn (OpenAI 400), spamming the
  // chat with identical auto-fix messages every 12s.
  dedupeTtlMs = 600_000,
}: UseErrorWatcherArgs): void {
  // Map fingerprint -> timestamp last submitted. Survives across probes.
  const submittedRef = useRef<Map<string, number>>(new Map());
  // Belt-and-suspenders: also remember the last composed prompt text so that
  // if the fingerprint hash ever differs across sessions for the same root
  // error (e.g. the file path shifts), we still don't spam the chat.
  const lastPromptRef = useRef<{ text: string; ts: number } | null>(null);
  const agentBusyRef = useRef(agentBusy);
  agentBusyRef.current = agentBusy;

  useEffect(() => {
    if (!projectId || !sandboxReady) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      // Skip this probe if the agent is mid-turn — queue for the next cycle.
      if (!agentBusyRef.current) {
        try {
          const { errors } = await api.detectPreviewErrors(projectId);
          if (cancelled) return;
          const now = Date.now();
          const submitted = submittedRef.current;

          // Garbage-collect stale entries
          for (const [fp, ts] of submitted) {
            if (now - ts > dedupeTtlMs) submitted.delete(fp);
          }

          // Find the first fresh error — we only submit one per tick to avoid
          // overloading the agent's context with parallel error chatter.
          const fresh = errors.find((e) => !submitted.has(e.fingerprint));
          if (fresh) {
            const prompt = composePrompt(fresh);
            // Second dedupe gate: exact-text match within the same TTL.
            const last = lastPromptRef.current;
            if (last && last.text === prompt && now - last.ts < dedupeTtlMs) {
              submitted.set(fresh.fingerprint, now);
            } else {
              submitted.set(fresh.fingerprint, now);
              lastPromptRef.current = { text: prompt, ts: now };
              onAutoFixRequested({ content: prompt, meta: { autoFix: fresh.fingerprint } });
            }
          }
        } catch {
          /* transient — next tick retries */
        }
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    // Start after a beat so the workspace can settle after mount
    timer = setTimeout(tick, 4_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, sandboxReady, onAutoFixRequested, intervalMs, dedupeTtlMs]);
}

function composePrompt(err: {
  kind: string;
  message: string;
  file?: string;
}): string {
  const fileHint = err.file ? `\nAffected path: ${err.file}` : '';
  switch (err.kind) {
    case 'module-not-found':
      return `Auto-fix: the dev server reports **${err.message}**. If this is an npm package, install it with \`bun add <pkg>\` and clear \`.next\`. If it's a path alias, verify \`tsconfig.json\` \`paths\` or switch to a relative import.${fileHint}`;
    case 'failed-to-compile':
      return `Auto-fix: the dev server is failing to compile.\n\n\`\`\`\n${err.message}\n\`\`\`\n\nRead the offending file, resolve the error, and save.${fileHint}`;
    case 'syntax-error':
      return `Auto-fix: syntax error detected — **${err.message}**.${fileHint} Read the file, fix the syntax, and save.`;
    case 'type-error':
      return `Auto-fix: TypeScript error — ${err.message}.${fileHint} Read the file and resolve the type mismatch.`;
    case 'unhandled-runtime':
      return `Auto-fix: unhandled runtime error in the preview.\n\n\`\`\`\n${err.message}\n\`\`\`\n\nInspect \`/tmp/dev.log\` and the relevant source files, then fix.`;
    case 'enoent-manifest':
      return `Auto-fix: Next.js is missing build manifests (\`${err.file ?? '.next/...'}\`). This usually means a stale \`.next\` cache — remove it and restart the dev server via the built-in heal.`;
    case 'internal-server-error':
      return `Auto-fix: preview is returning 500. Cause excerpt: ${err.message}. Tail \`/tmp/dev.log\`, identify the root cause, and fix.`;
    default:
      return `Auto-fix: dev server error — ${err.message}.${fileHint} Diagnose via \`cat /tmp/dev.log\` and repair.`;
  }
}
