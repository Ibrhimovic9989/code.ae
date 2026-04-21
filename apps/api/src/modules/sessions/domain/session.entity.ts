import type { SessionStatus } from '@code-ae/shared';

export interface SessionProps {
  id: string;
  projectId: string;
  status: SessionStatus;
  sandboxId: string | null;
  startedAt: Date;
  lastActivityAt: Date;
}

export class SessionEntity {
  private constructor(private props: SessionProps) {}

  static create(props: SessionProps): SessionEntity {
    return new SessionEntity(props);
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get status(): SessionStatus {
    return this.props.status;
  }

  get sandboxId(): string | null {
    return this.props.sandboxId;
  }

  touch(): void {
    this.props.lastActivityAt = new Date();
  }

  attachSandbox(sandboxId: string): void {
    this.props.sandboxId = sandboxId;
    this.props.status = 'running';
    this.props.lastActivityAt = new Date();
  }

  markStopped(): void {
    this.props.status = 'stopped';
    this.props.lastActivityAt = new Date();
  }

  markError(): void {
    this.props.status = 'error';
    this.props.lastActivityAt = new Date();
  }

  toObject(): SessionProps {
    return { ...this.props };
  }
}
