import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyWebsocket from '@fastify/websocket';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { registerPtyProxy } from './modules/workspace/interfaces/http/pty-proxy';

async function bootstrap() {
  const adapter = new FastifyAdapter({ trustProxy: true, logger: false });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  // Websocket support is registered directly on the underlying Fastify instance
  // because NestJS controllers don't speak WS on the Fastify adapter. The pty
  // proxy reaches into the Nest IoC to resolve JWT + sandbox services.
  // Cast: @nestjs/platform-fastify bundles its own FastifyInstance types which
  // drift from fastify@5's; the runtime is compatible.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fastify = adapter.getInstance() as any;
  await fastify.register(fastifyWebsocket);
  await registerPtyProxy(app, fastify);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: '0.0.0.0' });

  // eslint-disable-next-line no-console
  console.log(`[api] listening on :${port}`);
}

void bootstrap();
