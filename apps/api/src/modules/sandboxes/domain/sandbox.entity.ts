import type { SandboxStatus } from '@code-ae/shared';

export interface SandboxProps {
  id: string;
  projectId: string;
  status: SandboxStatus;
  previewUrl: string | null;
  agentUrl: string | null;
  agentToken: string | null;
  createdAt: Date;
  stoppedAt: Date | null;
}

export class SandboxEntity {
  private constructor(private props: SandboxProps) {}

  static create(props: SandboxProps): SandboxEntity {
    return new SandboxEntity(props);
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get status(): SandboxStatus {
    return this.props.status;
  }

  get previewUrl(): string | null {
    return this.props.previewUrl;
  }

  get agentUrl(): string | null {
    return this.props.agentUrl;
  }

  get agentToken(): string | null {
    return this.props.agentToken;
  }

  get isActive(): boolean {
    return this.props.status === 'running' || this.props.status === 'creating';
  }

  markStopped(): void {
    this.props.status = 'stopped';
    this.props.stoppedAt = new Date();
  }

  updateStatus(status: SandboxStatus, previewUrl: string | null): void {
    this.props.status = status;
    this.props.previewUrl = previewUrl;
  }

  toObject(): SandboxProps {
    return { ...this.props };
  }

  /** Redacts the agent token — use when returning sandbox to the client. */
  toPublic(): Omit<SandboxProps, 'agentToken'> {
    const { agentToken: _, ...rest } = this.props;
    return rest;
  }
}
