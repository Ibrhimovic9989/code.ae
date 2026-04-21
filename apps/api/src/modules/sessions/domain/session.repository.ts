import type { SessionEntity } from './session.entity';
import type { MessageEntity } from './message.entity';

export abstract class SessionRepository {
  abstract findById(id: string): Promise<SessionEntity | null>;
  abstract findActiveByProject(projectId: string): Promise<SessionEntity | null>;
  abstract save(session: SessionEntity): Promise<void>;
}

export abstract class MessageRepository {
  abstract append(message: MessageEntity): Promise<void>;
  abstract listBySession(sessionId: string, limit?: number): Promise<MessageEntity[]>;
}
