import type { AgentToolDefinition } from '@code-ae/agent-runtime';

/**
 * OpenAI-compatible tool schemas. Names and params deliberately mirror
 * the workspace use cases so the dispatcher is a 1:1 map.
 */
export const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    name: 'write_file',
    description:
      'Write (or overwrite) a file at the given path. Creates intermediate directories as needed. Use for creating or editing source files.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path inside the workspace (e.g. "src/index.ts"). Absolute paths are rejected.',
        },
        content: { type: 'string', description: 'Full file content to write.' },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the workspace. Returns utf-8 text.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path inside the workspace.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_files',
    description: 'List entries in a workspace directory. Defaults to the workspace root.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative directory path. Default ".".' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'exec',
    description:
      'Run a bash command inside the sandbox workspace. Returns stdout, stderr, and exit code. Use for package install, running scripts, tests, etc.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Bash command to run.' },
        cwd: { type: 'string', description: 'Working directory relative to workspace. Default ".".' },
      },
      required: ['command'],
      additionalProperties: false,
    },
  },
];
