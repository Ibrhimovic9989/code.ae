import { z } from 'zod';

export const SessionStatusSchema = z.enum([
  'initializing',
  'running',
  'idle',
  'stopped',
  'error',
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const AgentMessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);

export const AgentMessageSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: AgentMessageRoleSchema,
  content: z.string(),
  toolCalls: z.array(z.unknown()).optional(),
  createdAt: z.date(),
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  status: SessionStatusSchema,
  sandboxId: z.string().optional(),
  startedAt: z.date(),
  lastActivityAt: z.date(),
});
export type Session = z.infer<typeof SessionSchema>;
