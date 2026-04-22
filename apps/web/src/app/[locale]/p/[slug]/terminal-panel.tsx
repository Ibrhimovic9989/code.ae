'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import '@xterm/xterm/css/xterm.css';
import { api } from '../../../../lib/api-client';
import { parseSseStream } from '../../../../lib/sse-client';
import { cn } from '../../../../lib/utils';

interface TerminalPanelProps {
  projectId: string | null;
  sandboxReady: boolean;
  onClose?: () => void;
}

export function TerminalPanel({ projectId, sandboxReady, onClose }: TerminalPanelProps) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<{
    term: import('@xterm/xterm').Terminal;
    fit: import('@xterm/addon-fit').FitAddon;
    writeLine: (text: string) => void;
    prompt: () => void;
  } | null>(null);
  const lineBufferRef = useRef<string>('');
  const runningRef = useRef<boolean>(false);
  const [booted, setBooted] = useState(false);

  const runCommand = useCallback(
    async (command: string) => {
      if (!projectId || !termRef.current) return;
      const term = termRef.current;
      runningRef.current = true;
      try {
        const res = await api.streamExec(projectId, command);
        for await (const ev of parseSseStream(res)) {
          const data = ev.data as { chunk?: string; exitCode?: number | null; message?: string };
          if (ev.event === 'stdout' || ev.event === 'stderr') {
            term.term.write((data.chunk ?? '').replace(/\n/g, '\r\n'));
          } else if (ev.event === 'exit') {
            if (data.exitCode !== 0 && data.exitCode !== null) {
              term.term.write(`\r\n\x1b[31m[exit ${data.exitCode}]\x1b[0m`);
            }
          } else if (ev.event === 'error') {
            term.term.write(`\r\n\x1b[31m[error] ${data.message ?? ''}\x1b[0m`);
          }
        }
      } catch (err) {
        term.term.write(`\r\n\x1b[31m[error] ${err instanceof Error ? err.message : String(err)}\x1b[0m`);
      } finally {
        runningRef.current = false;
        term.term.write('\r\n');
        term.prompt();
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (booted || !containerRef.current) return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let disposeFn: (() => void) | null = null;

    (async () => {
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
        import('@xterm/addon-web-links'),
      ]);
      if (cancelled || !containerRef.current) return;

      // Wait until the container actually has non-zero dimensions before calling
      // term.open(). Opening into a 0-sized container leaves xterm's internal
      // render service un-initialised, and its internal ResizeObserver then
      // throws "Cannot read properties of undefined (reading 'dimensions')"
      // on the next resize event.
      await waitForDimensions(containerRef.current);
      if (cancelled || !containerRef.current) return;

      const term = new Terminal({
        convertEol: true,
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 12.5,
        fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
        letterSpacing: 0,
        lineHeight: 1.4,
        theme: {
          background: '#0a0a0a',
          foreground: '#e5e5e5',
          cursor: '#2dd4bf',
          selectionBackground: '#ffffff18',
          black: '#0a0a0a',
          brightBlack: '#525252',
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.loadAddon(new WebLinksAddon());
      term.open(containerRef.current);

      const safeFit = () => {
        const el = containerRef.current;
        if (!termRef.current || !el) return;
        if (el.offsetWidth === 0 || el.offsetHeight === 0) return;
        try {
          fit.fit();
        } catch {
          /* xterm internals not ready — next tick will retry */
        }
      };

      const prompt = () => term.write('\x1b[38;2;45;212;191m❯\x1b[0m ');

      term.writeln('\x1b[2mcode.ae · bash · type a command\x1b[0m');
      prompt();

      const writeLine = (text: string) => term.writeln(text);

      term.onData((input) => {
        if (runningRef.current) return;
        for (const ch of input) {
          const code = ch.charCodeAt(0);
          if (ch === '\r') {
            const cmd = lineBufferRef.current.trim();
            term.write('\r\n');
            lineBufferRef.current = '';
            if (cmd) void runCommand(cmd);
            else prompt();
          } else if (code === 0x7f) {
            if (lineBufferRef.current.length > 0) {
              lineBufferRef.current = lineBufferRef.current.slice(0, -1);
              term.write('\b \b');
            }
          } else if (code === 0x03) {
            term.write('^C\r\n');
            lineBufferRef.current = '';
            prompt();
          } else if (code >= 32 && code < 127) {
            lineBufferRef.current += ch;
            term.write(ch);
          }
        }
      });

      termRef.current = { term, fit, writeLine, prompt };
      setBooted(true);
      requestAnimationFrame(safeFit);
      setTimeout(() => {
        try {
          term.focus();
        } catch {
          /* noop */
        }
      }, 50);

      ro = new ResizeObserver(() => safeFit());
      ro.observe(containerRef.current);

      disposeFn = () => {
        ro?.disconnect();
        ro = null;
        try {
          term.dispose();
        } catch {
          /* noop */
        }
      };
    })();

    return () => {
      cancelled = true;
      disposeFn?.();
      termRef.current = null;
    };
  }, [booted, runCommand]);

  return (
    <div className="relative flex h-full flex-col bg-[#0a0a0a]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/[0.03] to-transparent"
      />
      <div className="relative flex h-7 shrink-0 items-center justify-between border-b border-neutral-900 bg-neutral-950/80 px-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              sandboxReady ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-amber-400',
            )}
          />
          <span className="label-caps text-neutral-300">{t('workspace.terminal')}</span>
          <span className="font-mono text-[10.5px] text-neutral-500">bash</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10.5px] text-neutral-500">
            {sandboxReady ? 'connected' : 'waiting…'}
          </span>
          {onClose ? (
            <button
              onClick={onClose}
              title="Close terminal"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden px-2 py-1.5 cursor-text"
        dir="ltr"
        onClick={() => termRef.current?.term.focus()}
      />
    </div>
  );
}

async function waitForDimensions(el: HTMLElement, timeoutMs = 2000): Promise<void> {
  if (el.offsetWidth > 0 && el.offsetHeight > 0) return;
  return new Promise<void>((resolve) => {
    const start = Date.now();
    const check = () => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}
