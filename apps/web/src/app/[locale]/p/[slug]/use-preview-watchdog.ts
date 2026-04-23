'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../../../lib/api-client';

export type WatchdogState = 'idle' | 'probing' | 'healing' | 'healthy' | 'degraded' | 'stuck';

interface UsePreviewWatchdogArgs {
  projectId: string | null;
  previewUrl: string | null;
  /** When true, watchdog is active. Pause when the Preview tab is hidden. */
  enabled: boolean;
  /** Probe cadence while healthy (ms). Default 30s. */
  probeIntervalMs?: number;
  /** Max consecutive heal failures before we surface the issue. Default 3. */
  maxFailures?: number;
}

interface UsePreviewWatchdogResult {
  state: WatchdogState;
  /** Last heal attempt result, if any. */
  lastHeal: { healed: boolean; tookSeconds: number; reason?: string } | null;
  /** Increments on each successful heal — consumers can use it as a remount key for the iframe. */
  healedNonce: number;
  /** Manual trigger. Use sparingly — the watchdog already runs on a schedule. */
  healNow: () => Promise<void>;
}

/**
 * The preview watchdog. Runs silently while the user has the workspace open:
 *
 *  1. Probes the preview URL every N seconds (via the iframe's load/error events
 *     plus a periodic HEAD through the browser — same-origin checks aren't
 *     possible cross-origin, so we rely on the iframe reporting success and
 *     otherwise assume unhealthy).
 *  2. On unhealthy detection, calls POST /projects/:id/preview/heal which runs
 *     the full recipe inside the sandbox (port-kill via /proc, .next reset,
 *     detached bun run dev, 120s warm-up probe).
 *  3. On a successful heal, bumps `healedNonce` so the iframe remounts and the
 *     user sees a freshly-compiled page with zero clicks.
 *  4. After `maxFailures` consecutive heal attempts that still don't recover,
 *     state goes to `stuck` and we stop auto-retrying — the UI surfaces a
 *     single prompt asking the user to restart the sandbox.
 *
 * Per the CUX rule: users never see raw shell diagnostics; the watchdog
 * handles recovery silently and only escalates when the recipe itself fails.
 */
export function usePreviewWatchdog({
  projectId,
  previewUrl,
  enabled,
  probeIntervalMs = 30_000,
  maxFailures = 3,
}: UsePreviewWatchdogArgs): UsePreviewWatchdogResult {
  const [state, setState] = useState<WatchdogState>('idle');
  const [healedNonce, setHealedNonce] = useState(0);
  const [lastHeal, setLastHeal] = useState<UsePreviewWatchdogResult['lastHeal']>(null);
  const failuresRef = useRef(0);
  const healingRef = useRef(false);

  const healNow = useCallback(async () => {
    if (!projectId || healingRef.current) return;
    healingRef.current = true;
    setState('healing');
    try {
      const res = await api.healPreview(projectId);
      setLastHeal(res);
      if (res.healed) {
        failuresRef.current = 0;
        setState('healthy');
        setHealedNonce((n) => n + 1);
      } else {
        failuresRef.current += 1;
        setState(failuresRef.current >= maxFailures ? 'stuck' : 'degraded');
      }
    } catch {
      failuresRef.current += 1;
      setState(failuresRef.current >= maxFailures ? 'stuck' : 'degraded');
    } finally {
      healingRef.current = false;
    }
  }, [projectId, maxFailures]);

  // Initial load: if the preview URL exists but the iframe never reports healthy
  // within a grace period, kick off a heal. After that, run on a cadence.
  useEffect(() => {
    if (!enabled || !projectId || !previewUrl) {
      setState('idle');
      return;
    }

    let cancelled = false;
    let probeTimer: ReturnType<typeof setTimeout> | null = null;

    // Cross-origin iframes can't report load errors cleanly, so we ask the
    // backend to probe the sandbox from inside the container (no CORS,
    // accurate). Use the read-only /preview/errors endpoint first; only call
    // heal if the probe shows the preview is actually broken. Heal is
    // destructive — it kills port 3000 and relaunches — so running it on a
    // healthy sandbox used to surface false "port-stuck" failures.
    const probe = async () => {
      if (cancelled || healingRef.current || !projectId) return;
      setState('probing');
      try {
        const { errors, previewStatus } = await api.detectPreviewErrors(projectId);
        if (cancelled) return;
        const healthy = previewStatus === 200 && errors.length === 0;
        if (healthy) {
          failuresRef.current = 0;
          setState('healthy');
        } else {
          await healNow();
        }
      } catch (err) {
        // Auth failures (401/403 from a stale cookie, refresh race) tell us
        // nothing about the preview itself — don't escalate to a destructive
        // heal on them. Every other probe failure (network, 5xx from the
        // sandbox, timeout) IS a signal to heal.
        const status = err instanceof ApiError ? err.status : 0;
        if (status === 401 || status === 403) {
          setState('idle');
        } else if (!cancelled) {
          await healNow();
        }
      }
      if (cancelled) return;
      probeTimer = setTimeout(probe, probeIntervalMs);
    };

    // Small delay on mount so the sandbox has a beat to settle.
    probeTimer = setTimeout(probe, 3_000);

    return () => {
      cancelled = true;
      if (probeTimer) clearTimeout(probeTimer);
    };
  }, [enabled, projectId, previewUrl, healNow, probeIntervalMs]);

  return { state, lastHeal, healedNonce, healNow };
}
