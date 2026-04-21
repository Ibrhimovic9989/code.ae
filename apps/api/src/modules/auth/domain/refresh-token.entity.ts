export interface RefreshTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

export class RefreshTokenEntity {
  private constructor(private props: RefreshTokenProps) {}

  static create(props: RefreshTokenProps): RefreshTokenEntity {
    return new RefreshTokenEntity(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get isActive(): boolean {
    return this.props.revokedAt === null && this.props.expiresAt > new Date();
  }

  revoke(replacedByTokenId: string | null = null): void {
    this.props.revokedAt = new Date();
    this.props.replacedByTokenId = replacedByTokenId;
  }

  toObject(): RefreshTokenProps {
    return { ...this.props };
  }
}
