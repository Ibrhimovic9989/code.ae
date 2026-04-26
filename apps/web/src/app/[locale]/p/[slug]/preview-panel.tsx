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
  /** Whether the project is linked to GitHub (makes restart non-destructive). */
  githubLinked?: boolean;
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

export function PreviewPanel({
  projectId,
  previewUrl,
  viewport = 'desktop',
  githubLinked = false,
}: Props) {
  const [manualNonce, setManualNonce] = useState(0);
  const [restarting, setRestarting] = useState(false);
  // After a restart, the new container takes ~45–75s before the dev server
  // comes up. During that grace window we hide the iframe and show a "Starting
  // container" state instead of letting the user see the proxy's
  // fetch-failed / 502 body.
  const [startingUntil, setStartingUntil] = useState<number>(0);
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

  // Clear the starting-grace window once it elapses so the iframe reappears
  // without requiring another interaction.
  useEffect(() => {
    if (startingUntil === 0) return;
    const left = startingUntil - Date.now();
    if (left <= 0) {
      setStartingUntil(0);
      return;
    }
    const t = setTimeout(() => setStartingUntil(0), left);
    return () => clearTimeout(t);
  }, [startingUntil]);

  const isStarting = restarting || (startingUntil > 0 && Date.now() < startingUntil);

  async function restartSandbox() {
    if (!projectId || restarting) return;

    // Restart destroys the sandbox container. If the project isn't linked to
    // GitHub, every unpushed file in the workspace is lost for good —
    // the sandbox has no persistent volume. Scream about this before the
    // user clicks through.
    const confirmMsg = githubLinked
      ? 'Restart the sandbox?\n\nWe\'ll stop the current container and spin up a fresh one, then auto-restore your files from GitHub (latest pushed state). Takes ~60–90 seconds. Any files not pushed to GitHub will be lost.'
      : '⚠ DATA LOSS WARNING\n\nThis project is NOT connected to GitHub. Restarting the sandbox will permanently delete ALL files in your workspace — there is no persistent storage.\n\nConnect GitHub and push first if you want to keep your work.\n\nProceed anyway?';
    if (!window.confirm(confirmMsg)) return;

    setRestarting(true);
    setStartingUntil(Date.now() + 120_000);
    const toastId = 'sandbox-restart';
    toast.loading('Stopping sandbox…', { id: toastId });
    try {
      try {
        await api.stopSandbox(projectId);
      } catch (err) {
        // stop can fail if the sandbox is already gone — proceed to start anyway.
        console.warn('[restart] stopSandbox failed (continuing):', err);
      }
      toast.loading('Starting fresh sandbox…', { id: toastId });
      const started = await api.startSandbox(projectId);
      console.info('[restart] new sandbox:', started);

      if (githubLinked) {
        // Fresh sandbox = empty workspace. Pull the latest pushed state from
        // GitHub so restart isn't destructive. Needs the sandbox agent to be
        // reachable, so we retry until it is (or give up after ~60s).
        toast.loading('Restoring files from GitHub…', { id: toastId });
        const restored = await restoreWithRetry(projectId);
        if (restored.restored) {
          toast.success(
            `Restored ${restored.filesRestored ?? 0} files. Starting dev server…`,
            { id: toastId, duration: 5000 },
          );
        } else {
          toast.error(
            `Restore failed (${restored.reason ?? 'unknown'}). Sandbox is empty.`,
            { id: toastId, duration: 8000 },
          );
        }
      } else {
        toast.success('Sandbox restarted. Waiting for the dev server to come up…', {
          id: toastId,
          duration: 6000,
        });
      }

      setManualNonce((n) => n + 1);
    } catch (err) {
      toast.error(
        `Restart failed: ${err instanceof Error ? err.message : String(err)}`,
        { id: toastId, duration: 8000 },
      );
      // Restart failed — drop the overlay so the user can see what's actually
      // on the iframe side.
      setStartingUntil(0);
    } finally {
      setRestarting(false);
    }
  }

  // Prefer the HTTPS proxy URL in the chrome — that's the URL the iframe
  // actually loads, AND the only one where browser features that require a
  // secure context (window.crypto.subtle, geolocation, service workers) work.
  // Showing the raw http://sbx-...:3000 URL would mislead users (and the
  // chat agent) into hitting an HTTP origin that breaks Supabase PKCE auth
  // with WebCrypto-not-supported / 422 signup errors.
  const displayUrl = iframeSrc
    ? stripProtocol(iframeSrc.split('?')[0] ?? iframeSrc)
    : previewUrl
      ? stripProtocol(previewUrl)
      : 'localhost:3000';
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
            disabled={!projectId || watchdogState === 'healing' || restarting}
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
          <IconButton
            title={restarting ? 'Restarting sandbox…' : 'Restart sandbox (stop + fresh container)'}
            onClick={restartSandbox}
            disabled={!projectId || restarting}
          >
            {restarting ? (
              <Spinner className="h-3 w-3" />
            ) : (
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path
                  d="M11 3.5V6H8.5M11 6A4.5 4.5 0 1 0 10.2 9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect x="4" y="5" width="5" height="4" rx="0.5" fill="currentColor" />
              </svg>
            )}
          </IconButton>
          {previewUrl ? (
            <IconButton
              title="Open in new tab (HTTPS — secure-context features like Supabase PKCE work here)"
              onClick={() => window.open(iframeSrc ?? previewUrl, '_blank', 'noopener')}
            >
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
        {isStarting ? (
          <StartingContainer />
        ) : previewUrl ? (
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

/**
 * After a fresh sandbox is created the agent container takes 10-30s to finish
 * booting. `restoreFromGitHub` depends on the agent being reachable, so retry
 * the call until it either succeeds or the overall attempt window elapses.
 */
async function restoreWithRetry(
  projectId: string,
): Promise<{ restored: boolean; reason?: string; filesRestored?: number }> {
  const deadline = Date.now() + 60_000;
  let lastErr: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await api.restoreFromGitHub(projectId);
      console.info('[restart] restoreFromGitHub:', res);
      // `sandbox-unreachable` means the agent isn't up yet — keep retrying.
      if (res.reason === 'sandbox-unreachable') {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      console.warn('[restart] restore attempt threw:', err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return {
    restored: false,
    reason: lastErr instanceof Error ? lastErr.message : 'timeout',
  };
}

function StartingContainer() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-neutral-100 p-8 dark:bg-neutral-950">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.4] [background-image:linear-gradient(rgba(128,128,128,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(128,128,128,0.08)_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <div className="relative flex flex-col items-center gap-3">
        <Spinner className="h-5 w-5 text-neutral-400" />
        <div className="text-center">
          <div className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
            Starting a fresh container
          </div>
          <div className="mt-1 text-[11.5px] text-neutral-400 dark:text-neutral-600">
            This takes 45–75 seconds. The dev server will be online shortly.
          </div>
        </div>
      </div>
    </div>
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
