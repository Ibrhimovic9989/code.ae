import type { FastifyPluginAsync } from 'fastify';
import { timingSafeEqual } from 'node:crypto';

export function createAuthHook(expectedToken: string): FastifyPluginAsync {
  const expected = Buffer.from(expectedToken, 'utf-8');

  return async (app) => {
    app.addHook('onRequest', async (req, reply) => {
      if (req.url === '/health') return;

      const header = req.headers.authorization;
      if (!header?.toLowerCase().startsWith('bearer ')) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED' } });
      }
      const provided = Buffer.from(header.slice(7).trim(), 'utf-8');

      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED' } });
      }
    });
  };
}
