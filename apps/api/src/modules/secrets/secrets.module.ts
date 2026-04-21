import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { SecretRepository, SecretStore } from './domain/secret.repository';
import { PrismaSecretRepository } from './infrastructure/prisma-secret.repository';
import { KeyVaultSecretStore } from './infrastructure/key-vault-secret-store';
import { UpsertSecretUseCase } from './application/upsert-secret.usecase';
import { ListSecretsUseCase } from './application/list-secrets.usecase';
import { DeleteSecretUseCase } from './application/delete-secret.usecase';
import { ResolveSecretsForSandboxUseCase } from './application/resolve-secrets-for-sandbox.usecase';
import { SecretsController } from './interfaces/http/secrets.controller';

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [SecretsController],
  providers: [
    { provide: SecretRepository, useClass: PrismaSecretRepository },
    { provide: SecretStore, useClass: KeyVaultSecretStore },
    UpsertSecretUseCase,
    ListSecretsUseCase,
    DeleteSecretUseCase,
    ResolveSecretsForSandboxUseCase,
  ],
  exports: [ResolveSecretsForSandboxUseCase, SecretRepository, SecretStore],
})
export class SecretsModule {}
