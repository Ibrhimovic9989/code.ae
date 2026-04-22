import { All, Controller, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { JwtAuthService } from '../../../auth/infrastructure/jwt.service';
import { ResolveActiveSandbox } from '../../application/resolve-active-sandbox';

/**
 * HTTPS proxy for sandbox previews. Sandboxes live on plain HTTP at ACI —
 * browsers refuse to iframe that inside an HTTPS parent (mixed content).
 * This route terminates HTTPS at the API and forwards to the internal
 * sandbox URL, so the iframe can be `<iframe src="https://api/.../preview/<id>/?t=<jwt>">`.
 *
 * Auth: iframes can't send Authorization headers, so we accept the user's
 * access token via `?t=<jwt>` once, then issue a short-lived cookie scoped to
 * this path so follow-up asset requests (Next's /_next/static/*) don't need
 * the query string appended to every URL.
 *
 * WebSocket upgrades (Next's HMR) aren't handled — iframe HMR is a nice-to-have;
 * full reload works.
 */
@Controller('preview')
export class PreviewProxyController {
  private static readonly COOKIE_NAME = 'cae_preview';

  constructor(
    private readonly jwt: JwtAuthService,
    private readonly resolve: ResolveActiveSandbox,
  ) {}

  @All(':projectId/*')
  async handle(
    @Param('projectId') projectId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    // 1. Authenticate — query ?t=<jwt> or the cookie we set on first hit.
    const query = req.query as Record<string, string | undefined>;
    const tokenFromQuery = query['t'];
    const tokenFromCookie = this.readCookie(req.headers.cookie, PreviewProxyController.COOKIE_NAME);
    const token = tokenFromQuery ?? tokenFromCookie;
    if (!token) {
      reply.status(401).send({ error: 'Missing preview token' });
      return;
    }
    let payload;
    try {
      payload = this.jwt.verifyAccessToken(token);
    } catch {
      reply.status(401).send({ error: 'Invalid preview token' });
      return;
    }

    // 2. Resolve the active sandbox + authorization check baked into the call.
    let sandbox;
    try {
      sandbox = await this.resolve.execute(projectId, payload.sub);
    } catch (err) {
      reply.status(404).send({ error: err instanceof Error ? err.message : 'Sandbox not found' });
      return;
    }

    // Sandbox preview URL lives on the ACI entity — resolve.execute only
    // returns the agent endpoint, not the preview URL. Reconstruct from the
    // agent URL: agent is on port 4200, preview on 3000, same host.
    const agentBase = sandbox.baseUrl;
    const host = new URL(agentBase).host.replace(/:\d+$/, '');
    const previewOrigin = `http://${host}:3000`;

    // 3. Strip the /preview/:projectId prefix, keep the rest.
    const rawUrl = req.url ?? '/';
    const prefix = `/api/v1/preview/${projectId}`;
    let rest = rawUrl.startsWith(prefix) ? rawUrl.slice(prefix.length) : rawUrl;
    if (!rest.startsWith('/')) rest = '/' + rest;
    // Strip our own ?t= query so it's not forwarded.
    rest = rest.replace(/([?&])t=[^&]*&?/, (_m, p1) => (p1 === '?' ? '?' : ''));
    rest = rest.replace(/[?&]$/, '');

    const targetUrl = `${previewOrigin}${rest}`;

    // 4. Set the short-lived preview cookie on first query-auth hit so the
    //    iframe's asset requests (no query) still authenticate.
    if (tokenFromQuery && !tokenFromCookie) {
      reply.raw.setHeader(
        'Set-Cookie',
        [
          `${PreviewProxyController.COOKIE_NAME}=${tokenFromQuery}`,
          'Path=/api/v1/preview',
          'HttpOnly',
          'Secure',
          'SameSite=None',
          'Max-Age=900', // 15 min, matches access token TTL
        ].join('; '),
      );
    }

    // 5. Forward the request. Strip headers that break proxying.
    const upstreamHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v === undefined) continue;
      const key = k.toLowerCase();
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(key)) continue;
      upstreamHeaders[key] = Array.isArray(v) ? v.join(', ') : String(v);
    }
    upstreamHeaders['host'] = new URL(previewOrigin).host;

    const body =
      req.method !== 'GET' && req.method !== 'HEAD' ? (req.body as Buffer | string | undefined) : undefined;

    let upstream: Response;
    try {
      const init: RequestInit = {
        method: req.method,
        headers: upstreamHeaders,
        redirect: 'manual',
      };
      if (body !== undefined) {
        (init as { body: Buffer | string }).body = body as Buffer | string;
      }
      upstream = await fetch(targetUrl, init);
    } catch (err) {
      reply
        .status(502)
        .send({ error: `Preview upstream unreachable: ${err instanceof Error ? err.message : err}` });
      return;
    }

    // 6. Copy response. Drop hop-by-hop headers.
    const raw = reply.raw;
    raw.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (['content-encoding', 'transfer-encoding', 'connection'].includes(k)) return;
      raw.setHeader(key, value);
    });
    // Ensure our Set-Cookie from step 4 isn't wiped if upstream didn't send headers
    if (!upstream.headers.get('set-cookie') && tokenFromQuery && !tokenFromCookie) {
      raw.setHeader(
        'Set-Cookie',
        [
          `${PreviewProxyController.COOKIE_NAME}=${tokenFromQuery}`,
          'Path=/api/v1/preview',
          'HttpOnly',
          'Secure',
          'SameSite=None',
          'Max-Age=900',
        ].join('; '),
      );
    }

    if (!upstream.body) {
      raw.end();
      return;
    }

    // When the upstream returns HTML or JS, rewrite absolute URL paths so that
    // `/_next/*` etc. resolve through the proxy instead of the API origin.
    const contentType = (upstream.headers.get('content-type') ?? '').toLowerCase();
    const needsRewrite =
      contentType.includes('text/html') ||
      contentType.includes('application/javascript') ||
      contentType.includes('text/javascript') ||
      contentType.includes('text/css');

    if (needsRewrite) {
      // Buffer the full body so we can string-replace.
      const chunks: Uint8Array[] = [];
      const reader = upstream.body.getReader();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      const body = buf.toString('utf8');
      const prefix = `/api/v1/preview/${projectId}`;
      const rewritten = this.rewriteAbsolutePaths(body, prefix);
      const rewrittenBuf = Buffer.from(rewritten, 'utf8');
      // Drop Content-Length if we changed size; Content-Type intact.
      raw.removeHeader('content-length');
      raw.end(rewrittenBuf);
      return;
    }

    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        raw.write(value);
      }
    } finally {
      raw.end();
    }
  }

  /**
   * Rewrite absolute-path URLs that Next dev emits in HTML / JS / CSS so they
   * resolve through the proxy instead of the API origin.
   *
   * Covers the common Next.js static-chunk references. Skips already-prefixed
   * paths and external URLs.
   */
  private rewriteAbsolutePaths(body: string, prefix: string): string {
    // Already-prefixed guard — idempotent.
    const isProxyPrefixed = (url: string) => url.startsWith(prefix);

    // HTML attributes: src="/foo" href="/foo" action="/foo"
    body = body.replace(
      /\b(src|href|action|data-src|poster)=("|')\/([^"'/][^"']*)\2/g,
      (_m, attr, quote, rest) => {
        const full = '/' + rest;
        if (isProxyPrefixed(full)) return `${attr}=${quote}${full}${quote}`;
        return `${attr}=${quote}${prefix}${full}${quote}`;
      },
    );
    // srcset entries
    body = body.replace(
      /\b(srcset|imagesrcset)=("|')([^"']+)\2/g,
      (_m, attr, quote, value: string) => {
        const rewritten = value
          .split(',')
          .map((entry) => {
            const trimmed = entry.trim();
            if (!trimmed.startsWith('/') || trimmed.startsWith(prefix) || trimmed.startsWith('//'))
              return entry;
            return ' ' + prefix + trimmed;
          })
          .join(',');
        return `${attr}=${quote}${rewritten}${quote}`;
      },
    );
    // JS/JSON literal paths that start with /_next/
    body = body.replace(/(["'`])\/(_next\/)/g, (_m, quote, next) => `${quote}${prefix}/${next}`);
    // JS/JSON webpack hot-update paths + runtime config
    body = body.replace(/(["'`])\/(__nextjs_original-stack-frame|__nextjs_source-map|__nextjs_font)/g,
      (_m, quote, rest) => `${quote}${prefix}/${rest}`,
    );
    // CSS url(/...)
    body = body.replace(/url\((['"]?)\/([^'")]+)\1\)/g, (m, quote, rest) => {
      const full = '/' + rest;
      if (isProxyPrefixed(full) || full.startsWith('//')) return m;
      return `url(${quote}${prefix}${full}${quote})`;
    });
    return body;
  }

  private readCookie(cookieHeader: string | undefined, name: string): string | undefined {
    if (!cookieHeader) return undefined;
    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const [k, ...rest] = part.trim().split('=');
      if (k === name) return rest.join('=');
    }
    return undefined;
  }
}
