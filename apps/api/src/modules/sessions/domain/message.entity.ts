export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface MessageToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface MessageProps {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  toolCalls: MessageToolCall[] | null;
  toolCallId: string | null;
  createdAt: Date;
}

export class MessageEntity {
  private constructor(private props: MessageProps) {}

  static create(props: MessageProps): MessageEntity {
    return new MessageEntity(props);
  }

  get id(): string {
    return this.props.id;
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get role(): MessageRole {
    return this.props.role;
  }

  get content(): string {
    return this.props.content;
  }

  get toolCalls(): MessageToolCall[] | null {
    return this.props.toolCalls;
  }

  toObject(): MessageProps {
    return { ...this.props };
  }
}
