'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import '@xterm/xterm/css/xterm.css';
import { api } from '../../../../lib/api-client';
import { cn } from '../../../../lib/utils';

interface TerminalPanelProps {
  projectId: string | null;
  sandboxReady: boolean;
  onClose?: () => void;
  /**
   * Optional stream of text lines to write into the terminal as read-only
   * activity (e.g. commands the agent is running). Each unique line is
   * printed once. Does not participate in the interactive pty stream.
   */
  agentActivity?: string[];
}

type Status = 'idle' | 'connecting' | 'connected' | 'disconnected';

/**
 * Interactive terminal backed by a WebSocket pty on the sandbox. Each mounted
 * panel opens one pty (bash, persistent state), proxied through the API.
 *
 * The sizing dance matters: xterm's renderer panics on a zero-sized container
 * and its ResizeObserver then throws forever. We defer `term.open()` until
 * the container actually has non-zero dimensions, and keep refitting via our
 * own ResizeObserver. See the earlier "Cannot read properties of undefined
 * (reading 'dimensions')" incident.
 */
export function TerminalPanel({
  projectId,
  sandboxReady,
  onClose,
  agentActivity,
}: TerminalPanelProps) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import('@xterm/xterm').Terminal | null>(null);
  const fitRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const activityShownRef = useRef<Set<string>>(new Set());

  // --- Boot xterm and open the WS pty ------------------------------------
  useEffect(() => {
    if (!projectId || !sandboxReady) return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    (async () => {
      if (!containerRef.current) return;
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
        import('@xterm/addon-web-links'),
      ]);
      if (cancelled || !containerRef.current) return;

      // Wait for the container to have real dimensions before opening. This is
      // the fix for "terminal says connected but looks empty" — a zero-height
      // grid cell or a drawer that hasn't animated in yet leaves xterm's
      // renderer in an un-paintable state.
      await waitForDimensions(containerRef.current);
      if (cancelled || !containerRef.current) return;

      const term = new Terminal({
        convertEol: false,
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 12.5,
        fontFamily:
          'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
        letterSpacing: 0,
        lineHeight: 1.4,
        theme: {
          background: '#0a0a0a',
          foreground: '#e5e5e5',
          cursor: '#2dd4bf',
          selectionBackground: '#ffffff22',
          black: '#0a0a0a',
          brightBlack: '#525252',
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.loadAddon(new WebLinksAddon());
      term.open(containerRef.current);
      termRef.current = term;
      fitRef.current = fit;

      const safeFit = () => {
        const el = containerRef.current;
        if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
        try {
          fit.fit();
        } catch {
          /* xterm internals not ready yet */
        }
      };

      // First fit on next paint so xterm has a chance to measure.
      requestAnimationFrame(safeFit);
      ro = new ResizeObserver(() => {
        safeFit();
        sendResize();
      });
      ro.observe(containerRef.current);

      term.writeln('\x1b[2mcode.ae · bash · persistent shell\x1b[0m');

      openPty();

      function sendResize() {
        const ws = wsRef.current;
        const t = termRef.current;
        if (!ws || !t || ws.readyState !== WebSocket.OPEN) return;
        try {
          ws.send(JSON.stringify({ type: 'resize', cols: t.cols, rows: t.rows }));
        } catch {
          /* ignore */
        }
      }

      function openPty() {
        const url = api.ptyWebSocketUrl(projectId!);
        if (!url) {
          term.writeln('\x1b[31m[not authenticated]\x1b[0m');
          setStatus('disconnected');
          return;
        }
        setStatus('connecting');
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setStatus('connected');
          sendResize();
          // Nudge the shell to render its prompt immediately instead of
          // waiting for a keystroke.
          try {
            ws.send(JSON.stringify({ type: 'input', data: '\n' }));
          } catch {
            /* ignore */
          }
        };
        ws.onmessage = (ev) => {
          let msg: { type?: string; data?: string; code?: number };
          try {
            msg = JSON.parse(String(ev.data));
          } catch {
            return;
          }
          if (msg.type === 'output' && typeof msg.data === 'string') {
            term.write(msg.data);
          } else if (msg.type === 'exit') {
            term.write(`\r\n\x1b[33m[shell exited, code=${msg.code ?? 0}]\x1b[0m\r\n`);
          }
        };
        ws.onclose = () => {
          setStatus('disconnected');
        };
        ws.onerror = () => {
          setStatus('disconnected');
        };
      }

      term.onData((input) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        try {
          ws.send(JSON.stringify({ type: 'input', data: input }));
        } catch {
          /* ignore */
        }
      });
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
      try {
        termRef.current?.dispose();
      } catch {
        /* ignore */
      }
      termRef.current = null;
      fitRef.current = null;
    };
  }, [projectId, sandboxReady]);

  // --- Mirror agent activity lines in dim style --------------------------
  useEffect(() => {
    const term = termRef.current;
    if (!term || !agentActivity) return;
    for (const line of agentActivity) {
      if (activityShownRef.current.has(line)) continue;
      activityShownRef.current.add(line);
      // Print on a fresh line so we don't stomp the user's in-progress input.
      term.write(`\r\n\x1b[2m· ${line}\x1b[0m\r\n`);
    }
  }, [agentActivity]);

  const statusLabel =
    status === 'connected'
      ? 'connected'
      : status === 'connecting'
        ? 'connecting…'
        : status === 'disconnected'
          ? 'disconnected'
          : sandboxReady
            ? 'idle'
            : 'waiting…';

  const dotClass = cn('h-1.5 w-1.5 rounded-full', {
    'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]': status === 'connected',
    'bg-amber-400 animate-pulse': status === 'connecting' || (!sandboxReady && status === 'idle'),
    'bg-red-400': status === 'disconnected',
    'bg-neutral-500': status === 'idle' && sandboxReady,
  });

  return (
    <div className="relative flex h-full flex-col bg-[#0a0a0a]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/[0.03] to-transparent"
      />
      <div className="relative flex h-7 shrink-0 items-center justify-between border-b border-neutral-900 bg-neutral-950/80 px-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className={dotClass} />
          <span className="label-caps text-neutral-300">{t('workspace.terminal')}</span>
          <span className="font-mono text-[10.5px] text-neutral-500">bash</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10.5px] text-neutral-500">{statusLabel}</span>
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
        onClick={() => termRef.current?.focus()}
      />
    </div>
  );
}

async function waitForDimensions(el: HTMLElement, timeoutMs = 3000): Promise<void> {
  if (el.offsetWidth > 0 && el.offsetHeight > 0) return;
  return new Promise<void>((resolve) => {
    const start = Date.now();
    const check = () => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) return resolve();
      if (Date.now() - start > timeoutMs) return resolve();
      requestAnimationFrame(check);
    };
    check();
  });
}
