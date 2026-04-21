import type { UserEntity } from './user.entity';
import type { RefreshTokenEntity } from './refresh-token.entity';

export abstract class UserRepository {
  abstract findById(id: string): Promise<UserEntity | null>;
  abstract findByEmail(email: string): Promise<UserEntity | null>;
  abstract save(user: UserEntity): Promise<void>;
}

export abstract class RefreshTokenRepository {
  abstract findById(id: string): Promise<RefreshTokenEntity | null>;
  abstract findByHash(tokenHash: string): Promise<RefreshTokenEntity | null>;
  abstract save(token: RefreshTokenEntity): Promise<void>;
  abstract revokeAllForUser(userId: string): Promise<void>;
}
