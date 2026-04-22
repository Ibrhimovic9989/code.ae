import type { INestApplication } from '@nestjs/common';
import { WebSocket } from 'ws';
import { JwtAuthService } from '../../../auth/infrastructure/jwt.service';
import { ResolveActiveSandbox } from '../../application/resolve-active-sandbox';

// Loose shape for a Fastify instance with @fastify/websocket registered.
// We avoid importing Fastify types here because NestJS's platform-fastify
// bundles its own divergent copy; this file is only called from main.ts
// where the underlying instance is known to be WS-capable.
interface WsFastify {
  get: (
    route: string,
    opts: { websocket: true },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (connection: any, request: any) => void | Promise<void>,
  ) => unknown;
}

/**
 * WebSocket proxy: browser ↔ this API ↔ sandbox-agent pty.
 *
 * The browser can't set Authorization headers on a WebSocket handshake, so we
 * accept the user's access JWT as `?t=<jwt>`. We verify, resolve the project
 * owner's active sandbox, then open an upstream WS to `<agent>/shell/pty`
 * with the sandbox agent token, and pipe raw frames both ways.
 *
 * Mounted outside the Nest HTTP pipeline because controllers can't terminate
 * WS upgrades on the Fastify adapter — we grab DI services directly.
 */
export async function registerPtyProxy(
  nestApp: INestApplication,
  fastify: WsFastify,
): Promise<void> {
  const jwt = nestApp.get(JwtAuthService);
  const resolveSandbox = nestApp.get(ResolveActiveSandbox);

  fastify.get(
    '/api/v1/projects/:projectId/pty',
    { websocket: true },
    async (connection, req) => {
      const client = connection as unknown as WebSocket;
      const projectId: string = req.params?.projectId;
      const token: string | undefined = req.query?.t;

      if (!token) {
        safeClose(client, 4401, 'missing-token');
        return;
      }

      let userId: string;
      try {
        const payload = jwt.verifyAccessToken(token);
        userId = payload.sub;
      } catch {
        safeClose(client, 4401, 'invalid-token');
        return;
      }

      let endpoint;
      try {
        endpoint = await resolveSandbox.execute(projectId, userId);
      } catch (err) {
        safeClose(client, 4404, err instanceof Error ? err.message.slice(0, 100) : 'no-sandbox');
        return;
      }

      const upstreamUrl = endpoint.baseUrl.replace(/^http/, 'ws') + '/shell/pty';
      const upstream = new WebSocket(upstreamUrl, {
        headers: { Authorization: `Bearer ${endpoint.token}` },
      });

      // Buffer any client frames that arrive before upstream is open.
      const earlyFrames: Array<Buffer | string> = [];
      let upstreamOpen = false;

      client.on('message', (data) => {
        const frame = Array.isArray(data) ? Buffer.concat(data) : data;
        if (upstreamOpen) {
          try {
            upstream.send(frame);
          } catch {
            /* best effort */
          }
        } else {
          earlyFrames.push(frame as Buffer | string);
        }
      });

      upstream.on('open', () => {
        upstreamOpen = true;
        for (const frame of earlyFrames) {
          try {
            upstream.send(frame);
          } catch {
            /* drop */
          }
        }
        earlyFrames.length = 0;
      });

      upstream.on('message', (data) => {
        const frame = Array.isArray(data) ? Buffer.concat(data) : data;
        if (client.readyState === client.OPEN) {
          try {
            client.send(frame);
          } catch {
            /* drop */
          }
        }
      });

      const teardown = () => {
        try {
          client.close();
        } catch {
          /* ignore */
        }
        try {
          upstream.close();
        } catch {
          /* ignore */
        }
      };

      upstream.on('close', teardown);
      upstream.on('error', (err) => {
        try {
          client.send(
            JSON.stringify({
              type: 'output',
              data: `\r\n\x1b[31m[pty upstream error: ${err.message}]\x1b[0m\r\n`,
            }),
          );
        } catch {
          /* ignore */
        }
        teardown();
      });
      client.on('close', teardown);
      client.on('error', teardown);
    },
  );
}

function safeClose(socket: WebSocket, code: number, reason: string): void {
  try {
    socket.close(code, reason);
  } catch {
    /* ignore */
  }
}
