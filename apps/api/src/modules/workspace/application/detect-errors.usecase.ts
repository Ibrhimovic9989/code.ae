import { Injectable } from '@nestjs/common';
import { SandboxAgentClient } from '../domain/sandbox-agent.client';
import { ResolveActiveSandbox } from './resolve-active-sandbox';

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
  ) {}

  async execute(projectId: string, ownerId: string): Promise<DetectErrorsResult> {
    const endpoint = await this.resolve.execute(projectId, ownerId);

    // Single shell call: probe + tail + capture status.
    const script = `
set +e
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000 2>/dev/null || echo "000")
BODY=$(curl -s --max-time 3 http://localhost:3000 2>/dev/null)
echo "CAE_STATUS=$STATUS"
echo "CAE_BODY_START"
echo "$BODY" | head -c 4000
echo ""
echo "CAE_BODY_END"
echo "CAE_LOG_START"
tail -120 /tmp/dev.log 2>/dev/null
echo "CAE_LOG_END"
`;

    // Send script raw — the sandbox-agent already wraps it in `bash -lc`.
    // (Double-wrapping broke the heal recipe; same bug class here.)
    const res = await this.agent.exec(endpoint, {
      command: script,
      cwd: '.',
      timeoutMs: 15_000,
    });

    const stdout = res.stdout ?? '';
    const status = this.extractInt(stdout, /CAE_STATUS=(\d+)/);
    const body = this.extractBetween(stdout, 'CAE_BODY_START', 'CAE_BODY_END');
    const log = this.extractBetween(stdout, 'CAE_LOG_START', 'CAE_LOG_END');

    const errors = this.classify(body, log, status);

    return {
      errors,
      logTail: log.trim(),
      previewStatus: status,
    };
  }

  private classify(body: string, log: string, status: number | null): DetectedError[] {
    const out: DetectedError[] = [];
    const seen = new Set<string>();
    const push = (err: Omit<DetectedError, 'fingerprint'>) => {
      const fp = this.fingerprint(err.kind, err.message, err.file);
      if (seen.has(fp)) return;
      seen.add(fp);
      out.push({ ...err, fingerprint: fp });
    };

    // Runtime errors Next emits to dev.log (most reliable signal).
    // Example: " ⨯ [Error: ENOENT: no such file or directory, open '/.../app-paths-manifest.json']"
    const enoentRe = /ENOENT: no such file or directory, open '([^']+)'/g;
    let m: RegExpExecArray | null;
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

    // Module not found — in body (Next renders an overlay HTML) or log.
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
