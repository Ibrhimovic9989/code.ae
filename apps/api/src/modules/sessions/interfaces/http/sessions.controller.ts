import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
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
    @Body() body: { content?: string } | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const content = body?.content ?? '';

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders?.();

    try {
      for await (const ev of this.sendMessage.execute(sessionId, user.sub, content)) {
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
