'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Spinner } from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import { cn } from '../../../../lib/utils';
import { usePreviewWatchdog } from './use-preview-watchdog';

export type ViewportSize = 'desktop' | 'tablet' | 'mobile';

interface Props {
  projectId: string | null;
  previewUrl: string | null;
  viewport?: ViewportSize;
}

const VIEWPORT_WIDTHS: Record<ViewportSize, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
};

/**
 * Browsers block HTTP iframes inside HTTPS pages (mixed content). Sandboxes
 * run on plain HTTP at ACI, so we route the iframe through the API's HTTPS
 * proxy (`/api/v1/preview/:projectId/`). The short-lived access token is
 * attached once as a query param — the proxy sets a scoped cookie so that
 * follow-up asset requests authenticate without URL pollution.
 */
function useProxiedPreviewUrl(projectId: string | null, previewUrl: string | null): string | null {
  if (!projectId || !previewUrl) return null;
  const apiBase = api.baseUrl; // e.g. https://code-ae-api.*.azurecontainerapps.io/api/v1
  const token = api.token;
  if (!apiBase.startsWith('https://') || !token) {
    // Dev/localhost falls back to the raw URL. Mixed-content only applies to
    // https parent + http iframe, so localhost-over-http is fine.
    return previewUrl;
  }
  return `${apiBase}/preview/${projectId}/?t=${encodeURIComponent(token)}`;
}

export function PreviewPanel({ projectId, previewUrl, viewport = 'desktop' }: Props) {
  const [manualNonce, setManualNonce] = useState(0);
  const iframeSrc = useProxiedPreviewUrl(projectId, previewUrl);

  // Silent watchdog: probes the preview health via the backend heal endpoint,
  // auto-recovers on failure, bumps healedNonce on successful heal so the
  // iframe remounts and users see a fresh page with zero interaction.
  const { state: watchdogState, lastHeal, healedNonce, healNow } = usePreviewWatchdog({
    projectId,
    previewUrl,
    enabled: Boolean(previewUrl && projectId),
  });
  const nonce = healedNonce + manualNonce;

  // Surface a terminal failure (watchdog gave up after N retries) as a one-time toast.
  useEffect(() => {
    if (watchdogState === 'stuck' && lastHeal?.reason) {
      toast.error(
        `Preview isn't recovering (${lastHeal.reason}). Try restarting the sandbox.`,
        { duration: 10_000, id: 'preview-stuck' },
      );
    }
  }, [watchdogState, lastHeal]);

  async function manualHeal() {
    await healNow();
    setManualNonce((n) => n + 1);
  }

  const displayUrl = previewUrl ? stripProtocol(previewUrl) : 'localhost:3000';
  const iframeWidth = VIEWPORT_WIDTHS[viewport];
  const constrained = viewport !== 'desktop';

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-950">
      {/* Browser chrome */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50/80 px-3 backdrop-blur dark:border-neutral-900 dark:bg-neutral-950/80">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-800" />
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-800" />
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-800" />
        </div>

        <div
          className={cn(
            'mx-2 flex h-6 flex-1 items-center gap-2 rounded-md border px-2.5 font-mono text-[11.5px]',
            previewUrl
              ? 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
              : 'border-dashed border-neutral-200 bg-transparent text-neutral-400 dark:border-neutral-800 dark:text-neutral-600',
          )}
          dir="ltr"
        >
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              previewUrl
                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                : 'bg-neutral-300 dark:bg-neutral-700',
            )}
          />
          <span className="truncate">{displayUrl}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <WatchdogChip state={watchdogState} />
          <IconButton
            title={watchdogState === 'healing' ? 'Healing…' : 'Force heal'}
            onClick={manualHeal}
            disabled={!projectId || watchdogState === 'healing'}
          >
            {watchdogState === 'healing' ? (
              <Spinner className="h-3 w-3" />
            ) : (
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M11.5 3v2.5H9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11 6a4 4 0 1 0-.5 3" strokeLinecap="round" />
              </svg>
            )}
          </IconButton>
          {previewUrl ? (
            <IconButton title="Open in new tab" onClick={() => window.open(previewUrl, '_blank', 'noopener')}>
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 3H3v8h8V9M8 3h3v3M11 3l-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </IconButton>
          ) : null}
        </div>
      </div>

      {/* Viewport */}
      <div
        className={cn(
          'relative flex-1 overflow-auto',
          constrained
            ? 'flex items-start justify-center bg-neutral-100 p-6 dark:bg-neutral-950'
            : 'bg-white dark:bg-black',
        )}
      >
        {previewUrl ? (
          <div
            className={cn(
              'h-full',
              constrained && 'rounded-md border border-neutral-200 bg-white shadow-[0_4px_30px_rgba(0,0,0,0.08)] overflow-hidden dark:border-neutral-800 dark:bg-black dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)]',
            )}
            style={{ width: iframeWidth, maxWidth: '100%' }}
          >
            <iframe
              key={nonce}
              src={iframeSrc ?? previewUrl}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-forms allow-same-origin"
              dir="ltr"
            />
          </div>
        ) : (
          <EmptyPreview />
        )}
      </div>
    </div>
  );
}

function WatchdogChip({ state }: { state: 'idle' | 'probing' | 'healing' | 'healthy' | 'degraded' | 'stuck' }) {
  const map = {
    idle: { dot: 'bg-neutral-500', text: 'idle' },
    probing: { dot: 'bg-sky-500', text: 'probing' },
    healing: { dot: 'bg-amber-500 animate-pulse', text: 'auto-healing' },
    healthy: { dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.6)]', text: 'healthy' },
    degraded: { dot: 'bg-amber-500', text: 'retrying' },
    stuck: { dot: 'bg-red-500', text: 'needs restart' },
  } as const;
  const { dot, text } = map[state];
  return (
    <div className="flex h-6 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 text-[10.5px] font-medium text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      <span>{text}</span>
    </div>
  );
}

function IconButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-500 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
    >
      {children}
    </button>
  );
}

function EmptyPreview() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.4] [background-image:linear-gradient(rgba(128,128,128,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(128,128,128,0.08)_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <div className="relative flex flex-col items-center gap-3">
        <svg viewBox="0 0 48 48" className="h-12 w-12 text-neutral-300 dark:text-neutral-700" fill="none">
          <rect x="6" y="10" width="36" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 18h36" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="10" cy="14" r="1" fill="currentColor" />
          <circle cx="13" cy="14" r="1" fill="currentColor" />
          <circle cx="16" cy="14" r="1" fill="currentColor" />
        </svg>
        <div className="text-center">
          <div className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
            Waiting for dev server
          </div>
          <div className="mt-1 text-[11.5px] text-neutral-400 dark:text-neutral-600">
            Press <span className="font-mono">▶</span> to start, or the agent will.
          </div>
        </div>
      </div>
    </div>
  );
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, '');
}
