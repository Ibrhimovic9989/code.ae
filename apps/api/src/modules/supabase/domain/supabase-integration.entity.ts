export interface SupabaseIntegrationProps {
  id: string;
  userId: string;
  accessToken: string;
  supabaseEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SupabaseIntegrationEntity {
  private constructor(private props: SupabaseIntegrationProps) {}

  static create(props: SupabaseIntegrationProps): SupabaseIntegrationEntity {
    return new SupabaseIntegrationEntity(props);
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

  get supabaseEmail(): string | null {
    return this.props.supabaseEmail;
  }

  rotate(accessToken: string, supabaseEmail: string | null): void {
    this.props.accessToken = accessToken;
    this.props.supabaseEmail = supabaseEmail;
    this.props.updatedAt = new Date();
  }

  toObject(): SupabaseIntegrationProps {
    return { ...this.props };
  }

  toPublic() {
    return {
      id: this.props.id,
      supabaseEmail: this.props.supabaseEmail,
      connectedAt: this.props.createdAt,
    };
  }
}
