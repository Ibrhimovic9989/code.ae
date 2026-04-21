import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { DomainError } from '@code-ae/shared';
import type { FastifyReply } from 'fastify';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    if (exception instanceof DomainError) {
      if (exception.status >= 500) {
        this.logger.error(
          `Domain 5xx: ${exception.code} — ${exception.message}`,
          exception.stack,
        );
      }
      reply.status(exception.status).send({
        error: { code: exception.code, message: exception.message },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      reply.status(status).send(
        typeof response === 'string' ? { error: { code: 'HTTP_ERROR', message: response } } : response,
      );
      return;
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : exception);
    reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
}
