import type { SandboxSpec, Sandbox } from '@code-ae/shared';

export interface SandboxDriver {
  create(spec: SandboxSpec): Promise<Sandbox>;
  get(id: string): Promise<Sandbox | null>;
  stop(id: string): Promise<void>;
  listByProject(projectId: string): Promise<Sandbox[]>;
}
