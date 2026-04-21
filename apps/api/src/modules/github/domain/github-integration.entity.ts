export interface GitHubIntegrationProps {
  id: string;
  userId: string;
  githubLogin: string;
  githubId: number;
  accessToken: string;
  scopes: string;
  createdAt: Date;
  updatedAt: Date;
}

export class GitHubIntegrationEntity {
  private constructor(private props: GitHubIntegrationProps) {}

  static create(props: GitHubIntegrationProps): GitHubIntegrationEntity {
    return new GitHubIntegrationEntity(props);
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

  get githubLogin(): string {
    return this.props.githubLogin;
  }

  rotate(accessToken: string, scopes: string): void {
    this.props.accessToken = accessToken;
    this.props.scopes = scopes;
    this.props.updatedAt = new Date();
  }

  toObject(): GitHubIntegrationProps {
    return { ...this.props };
  }

  /** Never leaks the access token. */
  toPublic() {
    return {
      id: this.props.id,
      githubLogin: this.props.githubLogin,
      githubId: this.props.githubId,
      scopes: this.props.scopes,
      connectedAt: this.props.createdAt,
    };
  }
}
