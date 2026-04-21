import type { SandboxEntity } from './sandbox.entity';

export abstract class SandboxRepository {
  abstract findById(id: string): Promise<SandboxEntity | null>;
  abstract findActiveByProject(projectId: string): Promise<SandboxEntity | null>;
  abstract save(sandbox: SandboxEntity): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
