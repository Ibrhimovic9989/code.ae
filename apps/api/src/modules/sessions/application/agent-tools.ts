import type { AgentToolDefinition } from '@code-ae/agent-runtime';

/**
 * Combines the built-in workspace tools with any dynamically discovered MCP tools.
 * MCP tools are prefixed `mcp__<server>__<tool>` so the dispatcher can route them
 * back to the registry without ambiguity.
 */
export function buildAgentTools(mcpTools: AgentToolDefinition[] = []): AgentToolDefinition[] {
  return [...AGENT_TOOLS, ...mcpTools];
}

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
  {
    name: 'ask_user',
    description:
      'Pause and ask the user a structured question before continuing. Use ONLY when the decision is load-bearing and cannot be resolved by a sensible default. Execution halts and waits for the user to answer via a form. Prefer picking defaults and building.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question in the user\'s locale. One sentence, concrete.' },
        options: {
          type: 'array',
          description:
            'Offered choices. Between 2 and 6 items. Each option is a short label the user can tap.',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Short label shown on the chip (≤ 40 chars).' },
              description: {
                type: 'string',
                description: 'Optional one-line hint under the label (≤ 120 chars).',
              },
            },
            required: ['label'],
            additionalProperties: false,
          },
          minItems: 2,
          maxItems: 6,
        },
        allowMultiple: {
          type: 'boolean',
          description: 'If true, user can pick more than one option. Default false.',
        },
        allowFreeText: {
          type: 'boolean',
          description:
            'If true, a free-text field is also shown so the user can add context beyond the options. Default true.',
        },
      },
      required: ['question', 'options'],
      additionalProperties: false,
    },
  },
];
