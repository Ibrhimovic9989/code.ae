import { Injectable } from '@nestjs/common';
import { SandboxAgentClient } from '../domain/sandbox-agent.client';
import { ResolveActiveSandbox } from './resolve-active-sandbox';
import { SandboxRepository } from '../../sandboxes/domain/sandbox.repository';

/**
 * Cold-start grace window. For the first N seconds after a sandbox is
 * created, Next.js's first-route compile is in flight and `routes-manifest.json`
 * legitimately doesn't exist yet — the watchdog must NOT classify that as an
 * error or the chat agent gets spammed with auto-fix prompts that interrupt
 * the very compile that's about to write the manifest.
 */
const COLD_START_GRACE_MS = 90_000;

export type DetectedErrorKind =
  | 'module-not-found'
  | 'failed-to-compile'
  | 'syntax-error'
  | 'type-error'
  | 'unhandled-runtime'
  | 'enoent-manifest'
  | 'internal-server-error'
  | 'unknown';

export interface DetectedError {
  kind: DetectedErrorKind;
  message: string;
  /** File path if the error references one. */
  file?: string;
  /** Short fingerprint (hash-like) so the client can dedupe already-reported errors. */
  fingerprint: string;
}

export interface DetectErrorsResult {
  /** Most-recent first. Empty when the preview is healthy. */
  errors: DetectedError[];
  /** The raw dev.log tail we scraped (last 120 lines). Useful for debug modal. */
  logTail: string;
  /** Probe status at the time of detection. */
  previewStatus: number | null;
  /**
   * True when we suppressed errors because the sandbox is still inside its
   * cold-start grace window. The watchdog uses this to avoid firing
   * auto-fix prompts at the chat agent during the first compile.
   */
  coldStart?: boolean;
  /** Approximate ms remaining in the grace window, when coldStart is true. */
  coldStartUntilMs?: number;
}

/**
 * Scrapes the sandbox's dev.log + probes the preview URL to classify current
 * errors into stable, machine-readable `DetectedError`s. Called on a cadence by
 * the client-side error watchdog; the watchdog then asks the chat agent to fix.
 *
 * Pure read — does not touch the workspace, does not restart anything.
 */
@Injectable()
export class DetectErrorsUseCase {
  constructor(
    private readonly resolve: ResolveActiveSandbox,
    private readonly agent: SandboxAgentClient,
    private readonly sandboxes: SandboxRepository,
  ) {}

  async execute(projectId: string, ownerId: string): Promise<DetectErrorsResult> {
    const endpoint = await this.resolve.execute(projectId, ownerId);

    // Cold-start grace check happens BEFORE the agent probe — if we're
    // still in the grace window, return a healthy-shaped response immediately
    // so the watchdog doesn't fire heal mid-compile.
    const sandbox = await this.sandboxes.findActiveByProject(projectId);
    if (sandbox) {
      const ageMs = Date.now() - sandbox.toObject().createdAt.getTime();
      if (ageMs < COLD_START_GRACE_MS) {
        return {
          errors: [],
          logTail: '',
          previewStatus: null,
          coldStart: true,
          coldStartUntilMs: COLD_START_GRACE_MS - ageMs,
        };
      }
    }

    // Single source of truth: the baked /usr/local/bin/code-ae-detect-errors
    // script in the sandbox image. Emits CAE_STATUS, CAE_STACK,
    // CAE_BODY_*, CAE_LOG_* markers we parse below.
    const res = await this.agent.exec(endpoint, {
      command: 'code-ae-detect-errors',
      cwd: '.',
      timeoutMs: 15_000,
    });

    const stdout = res.stdout ?? '';
    const status = this.extractInt(stdout, /CAE_STATUS=(\d+)/);
    const stackMatch = /CAE_STACK=([a-z0-9-]+)/i.exec(stdout);
    const stack = (stackMatch?.[1] ?? 'unknown') as
      | 'vite-react'
      | 'next'
      | 'unknown'
      | 'no-workspace';
    const body = this.extractBetween(stdout, 'CAE_BODY_START', 'CAE_BODY_END');
    const log = this.extractBetween(stdout, 'CAE_LOG_START', 'CAE_LOG_END');

    const errors = this.classify(body, log, status, stack);

    return {
      errors,
      logTail: log.trim(),
      previewStatus: status,
    };
  }

  private classify(
    body: string,
    log: string,
    status: number | null,
    stack: 'vite-react' | 'next' | 'unknown' | 'no-workspace',
  ): DetectedError[] {
    const out: DetectedError[] = [];
    const seen = new Set<string>();
    const push = (err: Omit<DetectedError, 'fingerprint'>) => {
      const fp = this.fingerprint(err.kind, err.message, err.file);
      if (seen.has(fp)) return;
      seen.add(fp);
      out.push({ ...err, fingerprint: fp });
    };

    let m: RegExpExecArray | null;

    // Next-specific: missing build manifest under .next/. Vite has no
    // equivalent on-disk artifact, so this check is gated to next.
    if (stack === 'next') {
      // Example: " ⨯ [Error: ENOENT: no such file or directory, open '/.../app-paths-manifest.json']"
      const enoentRe = /ENOENT: no such file or directory, open '([^']+\.next\/[^']+)'/g;
      while ((m = enoentRe.exec(log)) !== null) {
        const file = m[1];
        if (!file) continue;
        push({
          kind: 'enoent-manifest',
          message: `Missing manifest: ${file}`,
          file,
        });
        if (out.length >= 10) break;
      }
    }

    // Vite-specific: "[vite] Internal server error" + "Failed to resolve
    // import" patterns. These show up in /tmp/dev.log, not in the iframe
    // body (Vite returns 500 with the bare error).
    if (stack === 'vite-react') {
      if (/\[vite\] Internal server error/i.test(log)) {
        const excerpt = this.firstMatchContext(
          log,
          /\[vite\] Internal server error[\s\S]{0,400}/,
        );
        push({ kind: 'failed-to-compile', message: excerpt || 'Vite internal server error' });
      }
      const viteResolveRe = /Failed to resolve import "([^"]+)" from "([^"]+)"/g;
      while ((m = viteResolveRe.exec(log)) !== null) {
        const mod = m[1];
        const file = m[2];
        if (!mod) continue;
        push({
          kind: 'module-not-found',
          message: `Module not found: ${mod}`,
          ...(file ? { file } : {}),
        });
      }
      const viteTransformRe = /Transform failed with \d+ error(?:s)?:[\s\S]{0,200}/g;
      while ((m = viteTransformRe.exec(log)) !== null) {
        push({ kind: 'syntax-error', message: m[0].slice(0, 300) });
      }
    }

    // Module not found (Next form) — body or log. Skipped on Vite since
    // Vite uses "Failed to resolve import" handled above.
    if (stack !== 'vite-react') {
      const modRe = /Module not found: Can't resolve '([^']+)'/g;
      for (const haystack of [body, log]) {
        while ((m = modRe.exec(haystack)) !== null) {
          const mod = m[1];
          if (!mod) continue;
          push({
            kind: 'module-not-found',
            message: `Module not found: ${mod}`,
            file: mod,
          });
        }
      }
    }

    // Failed to compile — extract the block that follows
    if (/Failed to compile/i.test(log) || /Failed to compile/i.test(body)) {
      const excerpt = this.firstMatchContext(log + '\n' + body, /Failed to compile[\s\S]{0,400}/);
      push({
        kind: 'failed-to-compile',
        message: excerpt || 'Failed to compile',
      });
    }

    // Build Error overlay in the response body
    if (/Build Error/i.test(body) && !/Failed to compile/i.test(body)) {
      const excerpt = this.firstMatchContext(body, /Build Error[\s\S]{0,400}/);
      push({
        kind: 'failed-to-compile',
        message: excerpt || 'Build error',
      });
    }

    // Syntax error in dev.log: "SyntaxError: Unexpected token ...(/path/to/file.ts:42:10)"
    const syntaxRe = /SyntaxError: ([^\n]+)(?: \((.+?):(\d+):\d+\))?/g;
    while ((m = syntaxRe.exec(log)) !== null) {
      const msg = m[1];
      if (!msg) continue;
      push({
        kind: 'syntax-error',
        message: msg.slice(0, 300),
        ...(m[2] ? { file: m[2] } : {}),
      });
    }

    // TypeScript error: "./app/page.tsx:5:22 Type error: Property 'x' does not exist..."
    const tsRe = /((?:\.\/)?[\w./-]+\.tsx?):(\d+):\d+\s*\n\s*Type error: ([^\n]+)/g;
    while ((m = tsRe.exec(log)) !== null) {
      const file = m[1];
      const line = m[2];
      const msg = m[3];
      if (!file || !line || !msg) continue;
      push({
        kind: 'type-error',
        message: `Type error in ${file}:${line} — ${msg.slice(0, 200)}`,
        file,
      });
    }

    // Unhandled runtime error (React)
    if (/Unhandled Runtime Error/i.test(body)) {
      const excerpt = this.firstMatchContext(body, /Unhandled Runtime Error[\s\S]{0,300}/);
      push({
        kind: 'unhandled-runtime',
        message: excerpt || 'Unhandled runtime error in browser',
      });
    }

    // Internal server error with no other signal — last resort
    if (status === 500 && out.length === 0) {
      const excerpt = this.firstMatchContext(log, /⨯[\s\S]{0,300}/) || 'Preview returning 500 with no parseable cause';
      push({
        kind: 'internal-server-error',
        message: excerpt,
      });
    }

    return out;
  }

  private fingerprint(kind: string, message: string, file?: string): string {
    // Stable, short hash so the client can dedupe
    const raw = `${kind}|${file ?? ''}|${message.slice(0, 120)}`;
    let h = 0;
    for (let i = 0; i < raw.length; i++) {
      h = (h * 31 + raw.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  }

  private extractInt(s: string, re: RegExp): number | null {
    const m = re.exec(s);
    return m ? Number(m[1]) : null;
  }

  private extractBetween(s: string, start: string, end: string): string {
    const i = s.indexOf(start);
    const j = s.indexOf(end, i + start.length);
    if (i === -1 || j === -1) return '';
    return s.slice(i + start.length, j);
  }

  private firstMatchContext(s: string, re: RegExp): string {
    const m = re.exec(s);
    return m ? m[0].replace(/\s+/g, ' ').trim().slice(0, 400) : '';
  }
}
