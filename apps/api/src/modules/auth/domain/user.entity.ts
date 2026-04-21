export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  locale: 'ar' | 'en';
  createdAt: Date;
  updatedAt: Date;
}

export class UserEntity {
  private constructor(private props: UserProps) {}

  static create(props: UserProps): UserEntity {
    return new UserEntity(props);
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get locale(): 'ar' | 'en' {
    return this.props.locale;
  }

  changePassword(newHash: string): void {
    this.props.passwordHash = newHash;
    this.props.updatedAt = new Date();
  }

  changeLocale(locale: 'ar' | 'en'): void {
    this.props.locale = locale;
    this.props.updatedAt = new Date();
  }

  toObject(): UserProps {
    return { ...this.props };
  }

  toPublic() {
    const { passwordHash: _, ...rest } = this.props;
    return rest;
  }
}
