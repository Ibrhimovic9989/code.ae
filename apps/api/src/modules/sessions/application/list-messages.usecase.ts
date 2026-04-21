import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '@code-ae/shared';
import { ProjectRepository } from '../../projects/domain/project.repository';
import { SessionRepository, MessageRepository } from '../domain/session.repository';
import type { MessageEntity } from '../domain/message.entity';

@Injectable()
export class ListMessagesUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly sessions: SessionRepository,
    private readonly messages: MessageRepository,
  ) {}

  async execute(sessionId: string, ownerId: string): Promise<MessageEntity[]> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundError('Session', sessionId);
    const project = await this.projects.findById(session.projectId);
    if (!project) throw new NotFoundError('Project', session.projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenError('Not your session');

    return this.messages.listBySession(session.id);
  }
}
