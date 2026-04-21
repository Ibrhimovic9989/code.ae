import Fastify from 'fastify';
import { SandboxSpecSchema } from '@code-ae/shared';
import { loadConfig } from './config.js';
import { AciSandboxDriver } from './infrastructure/aci-sandbox-driver.js';

async function main() {
  const config = loadConfig();
  const driver = new AciSandboxDriver(config);
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/sandboxes', async (req, reply) => {
    const parsed = SandboxSpecSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: { code: 'VALIDATION', details: parsed.error.flatten() } });
    }
    const sandbox = await driver.create(parsed.data);
    return reply.status(201).send({ sandbox });
  });

  app.get('/sandboxes/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sandbox = await driver.get(id);
    if (!sandbox) return reply.status(404).send({ error: { code: 'NOT_FOUND' } });
    return { sandbox };
  });

  app.delete('/sandboxes/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await driver.stop(id);
    return reply.status(204).send();
  });

  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  app.log.info(`[orchestrator] listening on :${config.PORT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
