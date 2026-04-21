import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { MessageEntity, type MessageRole, type MessageToolCall } from '../domain/message.entity';
import { MessageRepository } from '../domain/session.repository';

@Injectable()
export class PrismaMessageRepository extends MessageRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async append(message: MessageEntity): Promise<void> {
    const m = message.toObject();
    await this.prisma.message.create({
      data: {
        id: m.id,
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
        ...(m.toolCalls ? { toolCalls: m.toolCalls as unknown as object } : {}),
      },
    });
  }

  async listBySession(sessionId: string, limit = 200): Promise<MessageEntity[]> {
    const rows = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((r) =>
      MessageEntity.create({
        id: r.id,
        sessionId: r.sessionId,
        role: r.role as MessageRole,
        content: r.content,
        toolCalls: (r.toolCalls as unknown as MessageToolCall[] | null) ?? null,
        toolCallId: null,
        createdAt: r.createdAt,
      }),
    );
  }
}
