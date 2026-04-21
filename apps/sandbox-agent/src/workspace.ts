import { resolve, relative, isAbsolute, sep } from 'node:path';

/**
 * Prevents path traversal. Every filesystem op inside the sandbox goes through this:
 * user supplies a relative path → we resolve under WORKSPACE_ROOT → reject if it escapes.
 * The sandbox is already isolated, but defense-in-depth costs nothing.
 */
export class Workspace {
  constructor(private readonly root: string) {}

  resolve(userPath: string): string {
    if (!userPath || typeof userPath !== 'string') {
      throw new WorkspaceError('Path is required');
    }
    if (isAbsolute(userPath)) {
      throw new WorkspaceError('Absolute paths are not allowed');
    }
    const full = resolve(this.root, userPath);
    const rel = relative(this.root, full);
    if (rel.startsWith('..' + sep) || rel === '..') {
      throw new WorkspaceError('Path escapes workspace');
    }
    return full;
  }
}

export class WorkspaceError extends Error {
  readonly status = 400;
}
