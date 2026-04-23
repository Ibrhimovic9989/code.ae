'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/dialog';
import { Button, Input, Label, Spinner } from '../../../../components/ui';

interface Props {
  projectId: string | null;
  /** Persisted per-project link — hydrated from the Project entity on reload. */
  linkedProjectRef?: string | null;
}

interface SupabaseProject {
  ref: string;
  name: string;
  region: string;
  status: string;
}

export function SupabaseButton({ projectId, linkedProjectRef }: Props) {
  const { status: authStatus } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [projects, setProjects] = useState<SupabaseProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  // Seed from the Project entity so the "linked to …" chip survives reloads,
  // even if the global integration fetch below hasn't returned yet (or fails).
  const [linkedRef, setLinkedRef] = useState<string | null>(linkedProjectRef ?? null);

  // If the project prop changes (e.g. navigating between projects) keep
  // linkedRef in sync with what the server said.
  useEffect(() => {
    setLinkedRef(linkedProjectRef ?? null);
  }, [linkedProjectRef]);

  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const { projects } = await api.listSupabaseProjects();
      setProjects(projects);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    // Wait for auth-context to finish hydrating before polling the
    // integration. Without this gate the fetch can race the token refresh,
    // hit an unauthenticated path, and leave the button stuck on "Connect"
    // even though the integration exists server-side.
    if (authStatus !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const { integration } = await api.getSupabaseIntegration();
        if (cancelled) return;
        setConnected(Boolean(integration));
        if (integration) await refreshProjects();
      } catch {
        if (!cancelled) setConnected(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus, refreshProjects]);

  async function onConnect(e: FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setConnecting(true);
    try {
      await api.connectSupabase(token.trim());
      setConnected(true);
      setToken('');
      toast.success('Supabase connected');
      await refreshProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }

  async function onLink(ref: string) {
    if (!projectId) return;
    const dbPassword = window.prompt(
      'Paste your Supabase database password (set when you created the project) to compose DATABASE_URL. Leave blank to skip — you can set it later in Secrets.',
      '',
    );
    if (dbPassword === null) return;
    setLinking(ref);
    try {
      const res = await api.linkSupabaseProject(projectId, ref, dbPassword.trim() || undefined);
      setLinkedRef(res.supabaseProjectRef);
      toast.success(`Linked — wrote ${res.secretsWritten.length} secrets`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLinking(null);
    }
  }

  async function onUnlink() {
    if (!projectId) return;
    try {
      await api.unlinkSupabaseProject(projectId);
      setLinkedRef(null);
      toast.success('Unlinked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function onDisconnect() {
    try {
      await api.disconnectSupabase();
      setConnected(false);
      setProjects([]);
      setLinkedRef(null);
      toast.success('Supabase disconnected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  // While we're still waiting on the integration fetch, keep the button
  // visible if we already know the project is linked (Project.supabaseProjectRef
  // was populated on the server). That way a fast reload doesn't flash an
  // empty toolbar — the linked chip stays in place.
  if (connected === null && !linkedRef) return null;

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {linkedRef ? `Supabase: ${linkedRef.slice(0, 10)}…` : connected ? 'Link Supabase' : 'Connect Supabase'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{connected ? 'Link a Supabase project' : 'Connect Supabase'}</DialogTitle>
            <DialogDescription>
              {connected ? (
                <>
                  Pick a Supabase project to link. We&apos;ll inject{' '}
                  <span className="font-mono">SUPABASE_URL</span>,{' '}
                  <span className="font-mono">ANON_KEY</span>, and{' '}
                  <span className="font-mono">SERVICE_ROLE_KEY</span> into this project&apos;s secrets and
                  enable the Supabase MCP tools for the agent.
                </>
              ) : (
                <>
                  Paste a Supabase personal access token. Create one at{' '}
                  <a
                    href="https://supabase.com/dashboard/account/tokens"
                    target="_blank"
                    rel="noopener"
                    className="text-brand-600 underline"
                  >
                    supabase.com/dashboard/account/tokens
                  </a>
                  .
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {!connected ? (
            <form onSubmit={onConnect} className="grid gap-4">
              <div>
                <Label>Access token</Label>
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="sbp_xxx…"
                  required
                  dir="ltr"
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div className="flex flex-row-reverse gap-2">
                <Button type="submit" disabled={connecting || !token.trim()}>
                  {connecting ? <Spinner /> : 'Connect'}
                </Button>
                <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid gap-3">
              {loadingProjects ? (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Spinner /> Loading projects…
                </div>
              ) : projects.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No Supabase projects found. Create one at{' '}
                  <a
                    href="https://supabase.com/dashboard/projects"
                    target="_blank"
                    rel="noopener"
                    className="text-brand-600 underline"
                  >
                    supabase.com
                  </a>{' '}
                  and refresh.
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto rounded border border-neutral-200 dark:border-neutral-800">
                  {projects.map((p) => {
                    const isLinked = linkedRef === p.ref;
                    return (
                      <div
                        key={p.ref}
                        className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 last:border-0 dark:border-neutral-900"
                      >
                        <div>
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="font-mono text-xs text-neutral-500" dir="ltr">
                            {p.ref} · {p.region} · {p.status}
                          </div>
                        </div>
                        <Button
                          variant={isLinked ? 'ghost' : 'secondary'}
                          disabled={linking !== null}
                          onClick={() => (isLinked ? onUnlink() : onLink(p.ref))}
                        >
                          {linking === p.ref ? <Spinner /> : isLinked ? 'Unlink' : 'Link'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-row-reverse gap-2">
                <Button variant="secondary" onClick={refreshProjects} disabled={loadingProjects}>
                  Refresh
                </Button>
                <Button variant="ghost" onClick={onDisconnect}>
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
