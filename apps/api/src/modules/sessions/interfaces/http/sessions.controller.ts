import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../../auth/interfaces/http/jwt-auth.guard';
import { CurrentUser } from '../../../auth/interfaces/http/current-user.decorator';
import type { AccessTokenPayload } from '../../../auth/infrastructure/jwt.service';
import { CreateSessionUseCase } from '../../application/create-session.usecase';
import { SendMessageUseCase } from '../../application/send-message.usecase';
import { ListMessagesUseCase } from '../../application/list-messages.usecase';

@Controller()
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(
    private readonly createSession: CreateSessionUseCase,
    private readonly sendMessage: SendMessageUseCase,
    private readonly listMessages: ListMessagesUseCase,
  ) {}

  @Post('projects/:projectId/sessions')
  async create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    const session = await this.createSession.execute(projectId, user.sub);
    return { session: session.toObject() };
  }

  @Get('sessions/:sessionId/messages')
  async list(@Param('sessionId') sessionId: string, @CurrentUser() user: AccessTokenPayload) {
    const messages = await this.listMessages.execute(sessionId, user.sub);
    return { messages: messages.map((m) => m.toObject()) };
  }

  @Post('sessions/:sessionId/messages')
  async send(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() body:
      | {
          content?: string;
          locale?: 'ar' | 'en';
          mode?: 'plan' | 'build';
          toolResponses?: Array<{ id: string; content: unknown }>;
          /** Inline image data URLs attached to THIS user turn. Ephemeral —
           *  not persisted; the model only sees them on the current request. */
          images?: string[];
          /** User-selected reasoning tier. */
          tier?: 'standard' | 'smart';
        }
      | undefined,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const content = body?.content ?? '';
    const toolResponses = body?.toolResponses ?? [];
    const locale: 'ar' | 'en' =
      body?.locale === 'en' ? 'en'
      : body?.locale === 'ar' ? 'ar'
      : user.locale === 'en' ? 'en'
      : 'ar';
    const mode: 'plan' | 'build' = body?.mode === 'plan' ? 'plan' : 'build';
    const images = Array.isArray(body?.images)
      ? body!.images.filter((u): u is string => typeof u === 'string').slice(0, 6)
      : [];
    const tier: 'standard' | 'smart' = body?.tier === 'smart' ? 'smart' : 'standard';

    applySseHeaders(req, reply);

    try {
      for await (const ev of this.sendMessage.execute(
        sessionId,
        user.sub,
        content,
        locale,
        toolResponses,
        mode,
        images,
        tier,
      )) {
        reply.raw.write(`event: ${ev.type}\n`);
        reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      reply.raw.write(`event: error\n`);
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
    } finally {
      reply.raw.end();
    }
  }
}

/**
 * SSE responses bypass Nest/Fastify's reply pipeline because we write directly to
 * reply.raw — so we have to re-apply the same CORS headers that enableCors() would.
 */
function applySseHeaders(req: FastifyRequest, reply: FastifyReply): void {
  const origin = req.headers.origin;
  if (origin) {
    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Vary', 'Origin');
  }
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.flushHeaders?.();
}
