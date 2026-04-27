import { Injectable, Logger } from '@nestjs/common';
import { SandboxAgentClient } from '../domain/sandbox-agent.client';
import { ResolveActiveSandbox } from './resolve-active-sandbox';
import { SandboxRepository } from '../../sandboxes/domain/sandbox.repository';

/** Mirrors the watchdog grace in detect-errors. Heal must NOT run mid-compile. */
const COLD_START_GRACE_MS = 90_000;

export interface HealPreviewResult {
  healed: boolean;
  tookSeconds: number;
  reason?: string;
  /** Condensed log (last ~60 lines of dev.log + probe result). Not shown by default. */
  detail: string;
}

/**
 * The single entry-point for "make the preview work again." Encapsulates the
 * entire recipe we painstakingly debugged with one user:
 *   - Find and kill any process holding port 3000 via /proc/net/tcp (no lsof).
 *   - Clear Next.js's .next cache so a stale errored compilation can't persist.
 *   - Detach-launch `bun run dev` with setsid+nohup so it survives this RPC.
 *   - GET-probe for up to 120s, rejecting 200 responses that carry compile-error
 *     markers (Next serves its error overlay with HTTP 200).
 *
 * Called by the client watchdog whenever the preview iframe is unhealthy, and
 * by the chat agent when the user reports "preview broken." Users should never
 * need to click a "start dev server" button — this runs automatically.
 */
@Injectable()
export class HealPreviewUseCase {
  private readonly logger = new Logger(HealPreviewUseCase.name);

  constructor(
    private readonly resolve: ResolveActiveSandbox,
    private readonly agent: SandboxAgentClient,
    private readonly sandboxes: SandboxRepository,
  ) {}

  async execute(projectId: string, ownerId: string): Promise<HealPreviewResult> {
    const started = Date.now();
    const endpoint = await this.resolve.execute(projectId, ownerId);

    // Cold-start gate: while Next.js is mid-first-compile (no manifests yet
    // by design), running the destructive recipe blows away the very
    // .next/ directory Next is writing into. Refuse to heal during the
    // grace window — the watchdog should already be skipping us here, but
    // belt-and-suspenders if a manual click slipped through.
    const sandbox = await this.sandboxes.findActiveByProject(projectId);
    if (sandbox) {
      const ageMs = Date.now() - sandbox.toObject().createdAt.getTime();
      if (ageMs < COLD_START_GRACE_MS) {
        this.logger.log(
          `heal: skipped — sandbox is in cold-start grace (${COLD_START_GRACE_MS - ageMs}ms left) project=${projectId}`,
        );
        return {
          healed: true,
          tookSeconds: 0,
          detail: `cold-start grace — Next.js is still doing its first compile. No-op.`,
        };
      }
    }

    // Single source of truth: /usr/local/bin/code-ae-heal in the sandbox
    // image. The API doesn't carry a duplicate inline recipe — if a sandbox
    // is somehow missing the script, the user's restart-sandbox button gives
    // them a fresh container with it; we don't try to backfill silently.
    const res = await this.agent.exec(endpoint, {
      command: 'code-ae-heal',
      cwd: '.',
      timeoutMs: 220_000,
    });

    const out = (res.stdout ?? '') + (res.stderr ? `\n[stderr]\n${res.stderr}` : '');
    // Match the LAST CAE_RESULT marker in the output — the recipe may emit
    // several if it's diagnostic (e.g. writing CAE_RESULT at top AND end) and
    // we want the final verdict. Use a global match, take the last.
    const markers = Array.from(out.matchAll(/CAE_RESULT=([a-z0-9_-]+)/gi)).map(
      (m) => m[1]?.toLowerCase() ?? '',
    );
    const verdict = markers[markers.length - 1] ?? '';
    const healed = verdict === 'healed';
    const reason = healed
      ? undefined
      : verdict === 'port-stuck'
        ? 'port-3000-permanently-occupied'
        : verdict === 'install-failed'
          ? 'install-failed'
          : verdict === 'timeout'
            ? 'compile-timeout'
            : verdict === 'no-workspace'
              ? 'workspace-missing'
              : verdict === 'no-package-json'
                ? 'no-package-json'
                : 'unknown';

    const detail = this.extractTail(out, 80);

    if (!healed) {
      this.logger.warn(
        `Heal failed for project ${projectId}: ${reason} (verdict='${verdict}', stdoutLen=${(res.stdout ?? '').length}, stderrLen=${(res.stderr ?? '').length})`,
      );
    }

    return {
      healed,
      tookSeconds: Math.round((Date.now() - started) / 1000),
      ...(reason ? { reason } : {}),
      detail,
    };
  }

  private extractTail(out: string, lines: number): string {
    const split = out.split('\n');
    return split.slice(Math.max(0, split.length - lines)).join('\n');
  }
}
