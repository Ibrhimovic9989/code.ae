import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { promises as fsp } from 'node:fs';
import { loadConfig } from './config.js';
import { Workspace } from './workspace.js';
import { createAuthHook } from './auth.js';
import { createFsRoutes } from './routes/fs.js';
import { createShellRoutes } from './routes/shell.js';
import { createPtyRoutes } from './routes/pty.js';

async function main() {
  const config = loadConfig();
  await fsp.mkdir(config.WORKSPACE_ROOT, { recursive: true });

  const ws = new Workspace(config.WORKSPACE_ROOT);
  const app = Fastify({ logger: { level: 'info' } });

  app.get('/health', async () => ({ status: 'ok', workspace: config.WORKSPACE_ROOT }));

  // Websockets must be registered before any route that uses `{ websocket: true }`.
  await app.register(fastifyWebsocket);
  await app.register(createAuthHook(config.SANDBOX_TOKEN));
  await app.register(createFsRoutes(ws));
  await app.register(createShellRoutes(config));
  await app.register(createPtyRoutes(config));

  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  app.log.info(`[sandbox-agent] listening on :${config.PORT} (workspace=${config.WORKSPACE_ROOT})`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
