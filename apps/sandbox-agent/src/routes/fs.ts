import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { promises as fsp, constants } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { Workspace, WorkspaceError } from '../workspace.js';

const WritePathSchema = z.object({
  path: z.string().min(1).max(2048),
  content: z.string().max(5_000_000),
  encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
});

const ReadPathSchema = z.object({
  path: z.string().min(1).max(2048),
  encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
});

const ListSchema = z.object({
  path: z.string().default('.'),
});

const DeleteSchema = z.object({
  path: z.string().min(1).max(2048),
  recursive: z.boolean().default(false),
});

export function createFsRoutes(ws: Workspace): FastifyPluginAsync {
  return async (app) => {
    app.post('/fs/write', async (req, reply) => {
      const parsed = WritePathSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      try {
        const full = ws.resolve(parsed.data.path);
        await fsp.mkdir(dirname(full), { recursive: true });
        const buf =
          parsed.data.encoding === 'base64'
            ? Buffer.from(parsed.data.content, 'base64')
            : Buffer.from(parsed.data.content, 'utf-8');
        await fsp.writeFile(full, buf);
        const stat = await fsp.stat(full);
        return { path: parsed.data.path, bytes: stat.size };
      } catch (err) {
        return handle(err, reply);
      }
    });

    app.post('/fs/read', async (req, reply) => {
      const parsed = ReadPathSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      try {
        const full = ws.resolve(parsed.data.path);
        const buf = await fsp.readFile(full);
        return {
          path: parsed.data.path,
          content: parsed.data.encoding === 'base64' ? buf.toString('base64') : buf.toString('utf-8'),
          encoding: parsed.data.encoding,
          bytes: buf.length,
        };
      } catch (err) {
        return handle(err, reply);
      }
    });

    app.post('/fs/list', async (req, reply) => {
      const parsed = ListSchema.safeParse(req.body ?? {});
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      try {
        const full = ws.resolve(parsed.data.path);
        const entries = await fsp.readdir(full, { withFileTypes: true });
        return {
          path: parsed.data.path,
          entries: entries.map((e) => ({
            name: e.name,
            type: e.isDirectory() ? 'dir' : e.isFile() ? 'file' : 'other',
          })),
        };
      } catch (err) {
        return handle(err, reply);
      }
    });

    app.post('/fs/delete', async (req, reply) => {
      const parsed = DeleteSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      try {
        const full = ws.resolve(parsed.data.path);
        await fsp.rm(full, { recursive: parsed.data.recursive, force: false });
        return { path: parsed.data.path, deleted: true };
      } catch (err) {
        return handle(err, reply);
      }
    });

    app.post('/fs/exists', async (req, reply) => {
      const parsed = ReadPathSchema.pick({ path: true }).safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ error: parsed.error.flatten() });

      try {
        const full = ws.resolve(parsed.data.path);
        await fsp.access(full, constants.F_OK);
        return { path: parsed.data.path, exists: true };
      } catch {
        return { path: parsed.data.path, exists: false };
      }
    });
  };
}

function handle(err: unknown, reply: FastifyReply) {
  if (err instanceof WorkspaceError) {
    return reply.status(err.status).send({ error: { code: 'WORKSPACE', message: err.message } });
  }
  const e = err as NodeJS.ErrnoException;
  if (e.code === 'ENOENT') return reply.status(404).send({ error: { code: 'NOT_FOUND', message: e.message } });
  if (e.code === 'EACCES') return reply.status(403).send({ error: { code: 'FORBIDDEN', message: e.message } });
  return reply.status(500).send({ error: { code: 'FS_ERROR', message: (err as Error).message ?? String(err) } });
}
