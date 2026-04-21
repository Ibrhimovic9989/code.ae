export interface VercelIntegrationProps {
  id: string;
  userId: string;
  accessToken: string;
  vercelUserId: string;
  vercelUsername: string;
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class VercelIntegrationEntity {
  private constructor(private props: VercelIntegrationProps) {}

  static create(props: VercelIntegrationProps): VercelIntegrationEntity {
    return new VercelIntegrationEntity(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get accessToken(): string {
    return this.props.accessToken;
  }

  get teamId(): string | null {
    return this.props.teamId;
  }

  get vercelUsername(): string {
    return this.props.vercelUsername;
  }

  rotate(accessToken: string, vercelUserId: string, vercelUsername: string, teamId: string | null): void {
    this.props.accessToken = accessToken;
    this.props.vercelUserId = vercelUserId;
    this.props.vercelUsername = vercelUsername;
    this.props.teamId = teamId;
    this.props.updatedAt = new Date();
  }

  toObject(): VercelIntegrationProps {
    return { ...this.props };
  }

  toPublic() {
    return {
      id: this.props.id,
      vercelUsername: this.props.vercelUsername,
      teamId: this.props.teamId,
      connectedAt: this.props.createdAt,
    };
  }
}
