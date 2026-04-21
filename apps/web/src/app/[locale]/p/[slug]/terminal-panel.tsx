'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import '@xterm/xterm/css/xterm.css';
import { api } from '../../../../lib/api-client';
import { parseSseStream } from '../../../../lib/sse-client';

interface TerminalPanelProps {
  projectId: string | null;
  sandboxReady: boolean;
}

export function TerminalPanel({ projectId, sandboxReady }: TerminalPanelProps) {
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

    (async () => {
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
        import('@xterm/addon-web-links'),
      ]);
      if (cancelled || !containerRef.current) return;

      const term = new Terminal({
        convertEol: true,
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        theme: {
          background: '#0a0a0a',
          foreground: '#e5e5e5',
          cursor: '#14b8a6',
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.loadAddon(new WebLinksAddon());
      term.open(containerRef.current);
      fit.fit();

      const prompt = () => term.write('\x1b[1;36m$\x1b[0m ');

      term.writeln('\x1b[2mcode.ae terminal — type a command and press Enter\x1b[0m');
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
            // backspace
            if (lineBufferRef.current.length > 0) {
              lineBufferRef.current = lineBufferRef.current.slice(0, -1);
              term.write('\b \b');
            }
          } else if (code === 0x03) {
            // Ctrl+C
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

      const ro = new ResizeObserver(() => fit.fit());
      ro.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      termRef.current?.term.dispose();
      termRef.current = null;
    };
  }, [booted, runCommand]);

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
        <span>{t('workspace.terminal')}</span>
        <span className="text-neutral-600">{sandboxReady ? 'connected' : 'waiting…'}</span>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden px-2 py-1"
        dir="ltr"
      />
    </div>
  );
}
