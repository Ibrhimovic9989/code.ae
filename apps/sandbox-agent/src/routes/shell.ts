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
      const startedAt = Date.now();

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
          // Log so callers (the chat agent) can stop blaming the platform
          // when long warm-up loops outrun the per-exec budget. Surface in
          // stderr so the heal/detect recipes see why their output ended.
          const msg = `[sandbox-agent] exec timed out after ${timeout}ms — SIGKILL parent shell. Detached background processes (setsid/nohup) survive; foreground loops do not.`;
          app.log.warn(msg);
          stderr += `\n${msg}\n`;
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
          const took = Date.now() - startedAt;
          if (timedOut) {
            app.log.warn(
              `[sandbox-agent] exec finished after ${took}ms with timeout=${timeout}ms (signal=${signal})`,
            );
          }
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

    app.post('/shell/exec-stream', async (req, reply) => {
      const parsed = ExecSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      const timeout = parsed.data.timeoutMs ?? config.SHELL_TIMEOUT_MS;
      const cwd = parsed.data.cwd === '.' ? config.WORKSPACE_ROOT : parsed.data.cwd;

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.raw.flushHeaders?.();

      const write = (event: string, data: unknown) => {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const proc = spawn('bash', ['-lc', parsed.data.command], { cwd, env: process.env });
      let timedOut = false;
      const killTimer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
      }, timeout);

      proc.stdout.on('data', (chunk: Buffer) => write('stdout', { chunk: chunk.toString('utf-8') }));
      proc.stderr.on('data', (chunk: Buffer) => write('stderr', { chunk: chunk.toString('utf-8') }));

      req.raw.on('close', () => {
        if (proc.exitCode === null) proc.kill('SIGTERM');
      });

      return new Promise<void>((resolve) => {
        proc.on('close', (code, signal) => {
          clearTimeout(killTimer);
          write('exit', { exitCode: code, signal, timedOut });
          reply.raw.end();
          resolve();
        });
        proc.on('error', (err) => {
          clearTimeout(killTimer);
          write('error', { message: err.message });
          reply.raw.end();
          resolve();
        });
      });
    });
  };
}
