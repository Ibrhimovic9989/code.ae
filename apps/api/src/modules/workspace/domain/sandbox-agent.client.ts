export interface WriteFileInput {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
}

export interface ReadFileResult {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
  bytes: number;
}

export interface ListResult {
  path: string;
  entries: Array<{ name: string; type: 'file' | 'dir' | 'other' }>;
}

export interface ExecInput {
  command: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface ExecResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

export interface SandboxAgentEndpoint {
  baseUrl: string;
  token: string;
}

export abstract class SandboxAgentClient {
  abstract writeFile(ep: SandboxAgentEndpoint, input: WriteFileInput): Promise<{ path: string; bytes: number }>;
  abstract readFile(ep: SandboxAgentEndpoint, path: string, encoding?: 'utf-8' | 'base64'): Promise<ReadFileResult>;
  abstract listFiles(ep: SandboxAgentEndpoint, path: string): Promise<ListResult>;
  abstract deleteFile(ep: SandboxAgentEndpoint, path: string, recursive: boolean): Promise<void>;
  abstract moveFile(ep: SandboxAgentEndpoint, from: string, to: string, overwrite: boolean): Promise<void>;
  abstract exec(ep: SandboxAgentEndpoint, input: ExecInput): Promise<ExecResult>;
  abstract execStream(ep: SandboxAgentEndpoint, input: ExecInput): Promise<Response>;
}
