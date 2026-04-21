import type { Sandbox, SandboxSpec } from '@code-ae/shared';

export abstract class OrchestratorClient {
  abstract createSandbox(spec: SandboxSpec): Promise<Sandbox>;
  abstract getSandbox(id: string): Promise<Sandbox | null>;
  abstract stopSandbox(id: string): Promise<void>;
}
