import type { FastifyPluginAsync } from 'fastify';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import type { AgentConfig } from '../config.js';

const ExecSchema = z.object({
  command: z.string().min(1).max(8000),
  cwd: z.string().default('.'),
  timeoutMs: z.number().int().min(1000).max(600_000).optional(),
});

export function createShellRoutes(config: AgentConfig): FastifyPluginAsync {
  return async (app) => {
    app.post('/shell/exec', async (req, reply) => {
      const parsed = ExecSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      const timeout = parsed.data.timeoutMs ?? config.SHELL_TIMEOUT_MS;
      const cwd = parsed.data.cwd === '.' ? config.WORKSPACE_ROOT : parsed.data.cwd;

      return new Promise((resolve) => {
        const proc = spawn('bash', ['-lc', parsed.data.command], {
          cwd,
          env: process.env,
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;

        const killTimer = setTimeout(() => {
          timedOut = true;
          proc.kill('SIGKILL');
        }, timeout);

        proc.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf-8');
          if (stdout.length > 1_000_000) stdout = stdout.slice(-1_000_000);
        });
        proc.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf-8');
          if (stderr.length > 1_000_000) stderr = stderr.slice(-1_000_000);
        });

        proc.on('close', (code, signal) => {
          clearTimeout(killTimer);
          resolve(
            reply.send({
              exitCode: code,
              signal,
              timedOut,
              stdout,
              stderr,
            }),
          );
        });

        proc.on('error', (err) => {
          clearTimeout(killTimer);
          resolve(
            reply.status(500).send({
              error: { code: 'SHELL_ERROR', message: err.message },
            }),
          );
        });
      });
    });
  };
}
