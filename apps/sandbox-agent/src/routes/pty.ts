import type { FastifyPluginAsync } from 'fastify';
import { spawn as spawnPty } from 'node-pty';
import type { AgentConfig } from '../config.js';

/**
 * Persistent interactive shell via WebSocket. One bash pty per WS connection;
 * closing the connection kills the shell. The API proxies the browser's WS to
 * this endpoint after authenticating the user — we trust the bearer.
 *
 * Wire protocol (both directions are JSON messages):
 *   Client → server:
 *     { type: 'input', data: '<utf-8 keystrokes>' }
 *     { type: 'resize', cols: number, rows: number }
 *   Server → client:
 *     { type: 'output', data: '<raw pty output>' }
 *     { type: 'exit', code: number }
 *
 * We pick bash (not sh) so prompt aliases / history / line editing work.
 */
export function createPtyRoutes(config: AgentConfig): FastifyPluginAsync {
  return async (app) => {
    app.get('/shell/pty', { websocket: true }, (connection) => {
      const shell = spawnPty('bash', ['-l'], {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd: config.WORKSPACE_ROOT,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          // Force a visible minimal prompt even if no bashrc loads.
          PS1: '\\[\\e[38;5;79m\\]\\w\\[\\e[0m\\] $ ',
        },
      });

      // @fastify/websocket hands us a ws.WebSocket-compatible duplex. We avoid
      // importing the `ws` type directly so sandbox-agent doesn't need it as
      // a dep (it only consumes WS via fastify).
      interface PtyWs {
        readyState: number;
        OPEN: number;
        send: (data: string) => void;
        close: () => void;
        on: (event: string, cb: (data: unknown) => void) => void;
      }
      const socket = connection as unknown as PtyWs;

      shell.onData((data: string) => {
        if (socket.readyState === socket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: 'output', data }));
          } catch {
            /* socket buffer full; drop */
          }
        }
      });

      shell.onExit(({ exitCode }: { exitCode: number }) => {
        try {
          if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify({ type: 'exit', code: exitCode }));
          }
        } catch {
          /* ignore */
        }
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      });

      socket.on('message', (raw: unknown) => {
        let text: string;
        if (Array.isArray(raw)) text = Buffer.concat(raw as Buffer[]).toString('utf-8');
        else if (raw instanceof ArrayBuffer) text = Buffer.from(raw).toString('utf-8');
        else text = String(raw);

        let msg: { type?: string; data?: string; cols?: number; rows?: number };
        try {
          msg = JSON.parse(text);
        } catch {
          return;
        }

        if (msg.type === 'input' && typeof msg.data === 'string') {
          shell.write(msg.data);
        } else if (
          msg.type === 'resize' &&
          typeof msg.cols === 'number' &&
          typeof msg.rows === 'number'
        ) {
          try {
            shell.resize(Math.max(1, msg.cols | 0), Math.max(1, msg.rows | 0));
          } catch {
            /* ignore */
          }
        }
      });

      const cleanup = () => {
        try {
          shell.kill();
        } catch {
          /* already dead */
        }
      };
      socket.on('close', cleanup);
      socket.on('error', cleanup);
    });
  };
}
